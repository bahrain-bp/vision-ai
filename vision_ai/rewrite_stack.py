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
        
        # Lambda Function
        rewrite_lambda = _lambda.Function(
            self, "RewriteFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="rewrite_handler.lambda_handler",
            code=_lambda.Code.from_asset("lambda/rewrite_document"),
            timeout=Duration.seconds(300),
            memory_size=512,
            environment={
                'BUCKET_NAME': investigation_bucket.bucket_name
            }
        )
        
        # Grant permissions to S3 bucket
        # Allow reading from any key (for original/extracted reports)
        # Allow writing to rewritten/* prefix
        investigation_bucket.grant_read(rewrite_lambda)
        investigation_bucket.grant_write(rewrite_lambda, "rewritten/*")
        
        rewrite_lambda.add_to_role_policy(iam.PolicyStatement(
            actions=['bedrock:InvokeModel'],
            resources=[f'arn:aws:bedrock:{self.region}::foundation-model/amazon.nova-lite-v1:0']
        ))
        
        # Import shared API
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # Add /rewrite route
        rewrite_resource = shared_api.root.add_resource("rewrite")
        
        # Add OPTIONS method for CORS preflight
        rewrite_resource.add_method(
            "OPTIONS",
            apigateway.LambdaIntegration(rewrite_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Add POST method for rewrite requests
        rewrite_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(rewrite_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Outputs
        CfnOutput(
            self, "RewriteLambdaArn",
            value=rewrite_lambda.function_arn,
            description="Rewrite Lambda function ARN"
        )
