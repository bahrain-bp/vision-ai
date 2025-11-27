from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct

class OutcomeStack(Stack):
    """
    Outcome Stack - Generates verdict confidence score and rationale
    """
    
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        investigation_bucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        inference_profile_arn: str,
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # Import shared API
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # IAM Role for Lambda
        lambda_role = iam.Role(
            self, "OutcomeLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Outcome Lambda function",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ]
        )
        
        # S3 permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket"
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/*",
                investigation_bucket.bucket_arn
            ]
        ))
        
        # Bedrock permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            resources=["*"]
        ))
        
        # Lambda function
        generate_verdict_lambda = _lambda.Function(
            self, "GenerateVerdictFunction",
            function_name="vision-ai-generate-verdict",
            handler="generate_verdict.handler",
            code=_lambda.Code.from_asset("lambda/outcome"),
            runtime=_lambda.Runtime.PYTHON_3_12,
            role=lambda_role,
            timeout=Duration.seconds(60),
            memory_size=512,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "INFERENCE_PROFILE_ARN": inference_profile_arn
            }
        )
        
        # API Gateway routes
        outcome_resource = shared_api.root.add_resource("outcome")
        verdict_resource = outcome_resource.add_resource("verdict")
        
        # CORS for verdict endpoint
        verdict_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token",
                "Content-Length"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )
        
        verdict_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(generate_verdict_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Outputs
        CfnOutput(
            self, "GenerateVerdictEndpoint",
            value="POST /outcome/verdict",
            description="Endpoint to generate verdict and rationale"
        )
        
        CfnOutput(
            self, "OutcomeReady",
            value="Outcome routes added to shared API",
            description="Outcome stack deployment status"
        )
