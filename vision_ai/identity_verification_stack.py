from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_iam as iam,
    aws_logs as logs,
    Duration,
    CfnOutput,
    RemovalPolicy,
)
from constructs import Construct

class IdentityVerificationStack(Stack):
    """
    Identity Verification Stack - Simplified with only 2 Lambda functions
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
        # IAM ROLE FOR LAMBDA FUNCTIONS
        # ==========================================
        lambda_role = iam.Role(
            self, "IdentityVerificationLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Identity Verification Lambda functions",
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
                "s3:DeleteObject",
                "s3:HeadObject",
                "s3:CopyObject"
            ],
            resources=[f"{investigation_bucket.bucket_arn}/*"]
        ))
        
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["s3:ListBucket"],
            resources=[investigation_bucket.bucket_arn]
        ))
        
        # Textract permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "textract:DetectDocumentText",
                "textract:AnalyzeDocument"
            ],
            resources=["*"]
        ))
        
        # Rekognition permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "rekognition:DetectFaces",
                "rekognition:CompareFaces",
                "rekognition:DetectLabels"
            ],
            resources=["*"]
        ))
        
        # CloudWatch Logs permissions 
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            resources=["arn:aws:logs:*:*:*"]
        ))
        
        # ==========================================
        # CLOUDWATCH LOG GROUPS
        # ==========================================
        upload_url_log_group = logs.LogGroup(
            self, "GetUploadUrlLogGroup",
            log_group_name="/aws/lambda/vision-ai-identity-upload-url",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=RemovalPolicy.DESTROY
        )
        
        orchestrator_log_group = logs.LogGroup(
            self, "OrchestratorLogGroup",
            log_group_name="/aws/lambda/vision-ai-identity-orchestrator",
            retention=logs.RetentionDays.ONE_MONTH,
            removal_policy=RemovalPolicy.DESTROY
        )
        
        # ==========================================
        # LAMBDA FUNCTIONS
        # ==========================================
        
        # 1. Get Upload URL Function (Separate)
        get_upload_url_lambda = _lambda.Function(
            self, "GetUploadUrlFunction",
            function_name="vision-ai-get-upload-url",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="get_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO"
            },
            description="Generate presigned URL for document and photo uploads"
        )
        
        # Grant log group permissions
        upload_url_log_group.grant_write(get_upload_url_lambda)
        
        # 2. Identity Verification Orchestrator 
        orchestrator_lambda = _lambda.Function(
            self, "IdentityVerificationOrchestratorFunction",
            function_name="vision-ai-identity-verification-orchestrator",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="identity_verification_orchestrator.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=lambda_role,
            timeout=Duration.seconds(180),  # 3 minutes for complete workflow
            memory_size=1024, 
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO"
            },
            description="All-in-one identity verification: CPR extraction, name extraction, reference check, and face comparison"
        )
        
        # Grant log group permissions
        orchestrator_log_group.grant_write(orchestrator_lambda)
        
        # ==========================================
        #  ROUTES TO SHARED API GATEWAY
        # ==========================================
        
        # /identity resource on SHARED API
        identity_resource = self.shared_api.root.add_resource("identity")
        
        # POST /identity/verify (Main orchestrator endpoint)
        verify_resource = identity_resource.add_resource("verify")
        # ADD CORS preflight for verify endpoint
        verify_resource.add_cors_preflight(
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

        verify_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                orchestrator_lambda, 
                proxy=True  
            ),
            authorization_type=apigateway.AuthorizationType.NONE
         
        )
        
        # POST /identity/upload-url (Upload URL generator)
        upload_url_resource = identity_resource.add_resource("upload-url")

        # CORS preflight for OPTIONS requests
        upload_url_resource.add_cors_preflight(
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
            max_age= Duration.days(1)
        )

        upload_url_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                get_upload_url_lambda, 
                proxy=True, 
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "IdentityVerificationEndpoint",
            value="POST /identity/verify",
            description="Main endpoint for identity verification workflow",
            export_name="IdentityVerificationEndpoint"
        )
        
        CfnOutput(
            self, "UploadUrlEndpoint",
            value="POST /identity/upload-url",
            description="Endpoint for generating presigned upload URLs",
            export_name="UploadUrlEndpoint"
        )
        
        CfnOutput(
            self, "OrchestratorFunctionArn",
            value=orchestrator_lambda.function_arn,
            description="ARN of the identity verification orchestrator function",
            export_name="IdentityOrchestratorArn"
        )
        
        CfnOutput(
            self, "OrchestratorLogGroupOutput",
            value=orchestrator_log_group.log_group_name,
            description="CloudWatch Log Group for Identity Verification Orchestrator",
            export_name="IdentityOrchestratorLogGroup"
        )
        
        CfnOutput(
            self, "UploadUrlLogGroupOutput",
            value=upload_url_log_group.log_group_name,
            description="CloudWatch Log Group for Upload URL Generator",
            export_name="UploadUrlLogGroup"
        )