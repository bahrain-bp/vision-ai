from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as _lambda,
    aws_s3 as s3,
    aws_apigateway as apigateway,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct

class RewriteStack(Stack):
    
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        investigation_bucket: s3.IBucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # ========== Lambda 2: Worker Lambda (performs the actual rewrite) ==========
        rewrite_worker_lambda = _lambda.Function(
            self, "RewriteWorkerFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="rewrite_worker.lambda_handler",
            code=_lambda.Code.from_asset("lambda/rewrite_document"),
            timeout=Duration.seconds(300),
            memory_size=512,
            environment={
                'BUCKET_NAME': investigation_bucket.bucket_name
            }
        )
        
        # Grant permissions to S3 bucket
        investigation_bucket.grant_read(rewrite_worker_lambda)
        investigation_bucket.grant_write(rewrite_worker_lambda, "rewrite-jobs/*")
        investigation_bucket.grant_write(rewrite_worker_lambda, "rewritten/*")
        
        # Grant Bedrock permissions
        rewrite_worker_lambda.add_to_role_policy(iam.PolicyStatement(
            actions=['bedrock:InvokeModel'],
            resources=[f'arn:aws:bedrock:{self.region}::foundation-model/amazon.nova-lite-v1:0']
        ))
        
        # ========== Lambda 1: Initiator Lambda (receives requests, returns job ID) ==========
        rewrite_initiator_lambda = _lambda.Function(
            self, "RewriteInitiatorFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="rewrite_initiator.lambda_handler",
            code=_lambda.Code.from_asset("lambda/rewrite_document"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                'BUCKET_NAME': investigation_bucket.bucket_name,
                'WORKER_LAMBDA_ARN': rewrite_worker_lambda.function_arn
            }
        )
        
        # Grant permissions
        investigation_bucket.grant_write(rewrite_initiator_lambda, "rewrite-jobs/*")
        rewrite_worker_lambda.grant_invoke(rewrite_initiator_lambda)
        
        # ========== Lambda 3: Status Checker Lambda (polls S3 for results) ==========
        rewrite_status_lambda = _lambda.Function(
            self, "RewriteStatusFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="rewrite_status.lambda_handler",
            code=_lambda.Code.from_asset("lambda/rewrite_document"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                'BUCKET_NAME': investigation_bucket.bucket_name
            }
        )
        
        # Grant S3 read permissions for job status and results
        investigation_bucket.grant_read(rewrite_status_lambda, "rewrite-jobs/*")
        investigation_bucket.grant_read(rewrite_status_lambda, "rewritten/*")
        
        # Import shared API
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # Add /rewrite route for initiating rewrite jobs
        rewrite_resource = shared_api.root.add_resource(
            "rewrite",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=["POST", "GET", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"]
            )
        )
        
        # POST /rewrite - Initiates a rewrite job and returns job ID
        rewrite_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                rewrite_initiator_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Add /rewrite/status/{jobId} route for checking job status
        status_resource = rewrite_resource.add_resource(
            "status",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=["GET", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"]
            )
        )
        job_id_resource = status_resource.add_resource(
            "{jobId}",
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=["GET", "OPTIONS"],
                allow_headers=["Content-Type", "Authorization"]
            )
        )
        
        # GET /rewrite/status/{jobId} - Checks the status of a rewrite job
        job_id_resource.add_method(
            "GET",
            apigateway.LambdaIntegration(
                rewrite_status_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Outputs
        CfnOutput(
            self, "RewriteInitiatorLambdaArn",
            value=rewrite_initiator_lambda.function_arn,
            description="Rewrite Initiator Lambda function ARN"
        )
        
        CfnOutput(
            self, "RewriteWorkerLambdaArn",
            value=rewrite_worker_lambda.function_arn,
            description="Rewrite Worker Lambda function ARN"
        )
        
        CfnOutput(
            self, "RewriteStatusLambdaArn",
            value=rewrite_status_lambda.function_arn,
            description="Rewrite Status Checker Lambda function ARN"
        )
