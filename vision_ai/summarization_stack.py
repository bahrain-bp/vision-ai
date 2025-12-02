from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct

class SummarizationStack(Stack):
    """
    Summarization Stack - Generates AI summaries using Amazon Bedrock
    """
    
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
        
        # ==========================================
        # IMPORT SHARED API GATEWAY 
        # ==========================================
        self.shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # ==========================================
        # IAM ROLE FOR LAMBDA FUNCTION
        # ==========================================
        lambda_role = iam.Role(
            self, "SummarizationLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Summarization Lambda function",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ]
        )
        
        # S3 permissions - scoped to the specific bucket
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
                "bedrock:InvokeModel"
            ],
            resources=["*"]
        ))
        
        # ==========================================
        # LAMBDA FUNCTION
        # ==========================================
        summarization_function = _lambda.Function(
            self, "SummarizationFunction",
            function_name="vision-ai-summarization",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="summarization_handler.lambda_handler",
            code=_lambda.Code.from_asset("lambda/summarization"),
            role=lambda_role,
            timeout=Duration.seconds(300),
            memory_size=512,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO"
            },
            description="Generate AI summaries using Amazon Bedrock Nova Lite"
        )
        
        # ==========================================
        # ADD ROUTES TO SHARED API GATEWAY
        # ==========================================
        
        # /summarize resource on SHARED API
        summarize_resource = self.shared_api.root.add_resource("summarize")
        summarize_resource.add_cors_preflight(
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
        
        summarize_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                summarization_function,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "SummarizationEndpoint",
            value="POST /summarize",
            description="Endpoint for generating AI summaries",
            export_name="SummarizationEndpoint"
        )
        
        CfnOutput(
            self, "SummarizationFunctionArn",
            value=summarization_function.function_arn,
            description="ARN of the summarization function",
            export_name="SummarizationFunctionArn"
        )