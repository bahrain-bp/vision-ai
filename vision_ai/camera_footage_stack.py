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


class CameraFootageAnalysisStack(Stack):
    """
    Camera Footage Analysis Stack - Video processing
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        investigation_bucket: s3.IBucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        env,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)

        # ==========================================
        # IMPORT SHARED API GATEWAY
        # ==========================================
        self.shared_api = apigateway.RestApi.from_rest_api_attributes(
            self,
            "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id,
        )

        # ==========================================
        # S3 BUCKET POLICY FOR BEDROCK ACCESS
        # ==========================================
        # Add bucket policy to allow Bedrock to read/write
        investigation_bucket.add_to_resource_policy(
            iam.PolicyStatement(
                sid="AllowBedrockDataAutomation",
                effect=iam.Effect.ALLOW,
                principals=[iam.ServicePrincipal("bedrock.amazonaws.com")],
                actions=["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
                resources=[
                    investigation_bucket.bucket_arn,
                    f"{investigation_bucket.bucket_arn}/*",
                ],
                conditions={"StringEquals": {"aws:SourceAccount": self.account}},
            )
        )

        # ==========================================
        # IAM ROLE FOR LAMBDA FUNCTIONS
        # ==========================================
        lambda_role = iam.Role(
            self,
            "CameraFootageLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Camera Footage Analysis Lambda functions",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ],
        )

        # ---------- S3 PERMISSIONS ----------
        # Bedrock Data Automation requires BOTH:
        #   - ListBucket on the BUCKET
        #   - GetObject on BUCKET/*
        #   - PutObject if writing output
        lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["s3:ListBucket"],
                resources=[investigation_bucket.bucket_arn],
            )
        )

        lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
                resources=[f"{investigation_bucket.bucket_arn}/*"],
            )
        )

        # ---------- AMAZON TRANSLATE PERMISSIONS ----------
        lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "translate:TranslateText",
                ],
                resources=["*"],
            )
        )

        # ---------- BEDROCK DATA AUTOMATION PERMISSIONS ----------
        lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "bedrock:GetDataAutomationJob",
                    "bedrock:InvokeDataAutomationAsync",
                ],
                resources=[
                    # self.node.try_get_context("bedrockProjectArn"),
                    # self.node.try_get_context("bedrockProfileArn"),
                    f"arn:aws:bedrock:us-east-1:{self.account}:data-automation-project/f39dfca84c8e",
                    f"arn:aws:bedrock:us-east-1:{self.account}:data-automation-profile/us.data-automation-v1",
                    f"arn:aws:bedrock:us-east-2:{self.account}:data-automation-profile/us.data-automation-v1",
                    f"arn:aws:bedrock:us-west-1:{self.account}:data-automation-profile/us.data-automation-v1",
                    f"arn:aws:bedrock:us-west-2:{self.account}:data-automation-profile/us.data-automation-v1",
                    f"arn:aws:bedrock:us-east-1:{self.account}:data-automation-invocation/*",
                    f"arn:aws:bedrock:*:{self.account}:data-automation-invocation/*",
                ],
            )
        )

        # ==========================================
        # LAMBDA FUNCTION: Video Upload URL
        # ==========================================
        video_upload_url_lambda = _lambda.Function(
            self,
            "VideoUploadUrlFunction",
            function_name=f"vision-ai-video-upload-url-{self.stack_name}",
            runtime=_lambda.Runtime.PYTHON_3_13,
            handler="video_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/camera_footage_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO",
            },
            description="Generate presigned URL for video uploads",
        )

        # ==========================================
        # LAMBDA FUNCTION: Video analysis
        # bedrock data automation (bda)
        # ==========================================
        video_analysis_lambda = _lambda.Function(
            self,
            "VideoAnalysisFunction",
            function_name=f"vision-ai-video-analysis-{self.stack_name}",
            runtime=_lambda.Runtime.PYTHON_3_13,
            handler="video_analysis.handler",
            code=_lambda.Code.from_asset("lambda/camera_footage_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(120),
            memory_size=512,
            environment={
                "LOG_LEVEL": "INFO",
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "BEDROCK_PROJECT_ARN": f"arn:aws:bedrock:us-east-1:{self.account}:data-automation-project/f39dfca84c8e",
                "BEDROCK_PROFILE_ARN": f"arn:aws:bedrock:us-east-1:{self.account}:data-automation-profile/us.data-automation-v1",
            },
            description="Trigger Bedrock Data Automation job for video analysis",
        )

        # ==========================================
        # LAMBDA FUNCTION:  Get bda results from
        # JSON file in S3
        # ==========================================
        get_bda_results_lambda = _lambda.Function(
            self,
            "GetBdaResultsFunction",
            function_name=f"vision-ai-get-bda-results-{self.stack_name}",
            runtime=_lambda.Runtime.PYTHON_3_9,
            handler="get-bda-results.lambda_handler",
            code=_lambda.Code.from_asset("lambda/camera_footage_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(60),
            memory_size=256,
            environment={
                "RESULTS_BUCKET": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO",
            },
            description="Fetch and transform Bedrock Data Automation results",
        )

        # ==========================================
        # ADD ROUTES TO SHARED API GATEWAY
        # ==========================================

        # 1. Upload / presigned URL resource
        # /footage resource on SHARED API
        footage_resource = self.shared_api.root.add_resource("footage")

        # POST /footage/upload-url
        upload_url_resource = footage_resource.add_resource("upload-url")
        upload_url_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(video_upload_url_lambda),
            method_responses=[
                apigateway.MethodResponse(status_code="200"),
                apigateway.MethodResponse(status_code="400"),
                apigateway.MethodResponse(status_code="500"),
            ],
        )

        # enable CORS for the resource 1
        upload_url_resource.add_cors_preflight(
            allow_origins=["*"],
            allow_methods=["OPTIONS", "POST", "PUT"],
            allow_headers=["Content-Type", "Authorization"],
        )

        # 2. Video analysis resource
        # /analyze resource on SHARED API
        analyze_resource = footage_resource.add_resource("analyze")
        analyze_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(video_analysis_lambda),
            method_responses=[
                apigateway.MethodResponse(status_code="200"),
                apigateway.MethodResponse(status_code="400"),
                apigateway.MethodResponse(status_code="500"),
            ],
        )

        # enable CORS for the resource 2
        analyze_resource.add_cors_preflight(
            allow_origins=["*"],
            allow_methods=["OPTIONS", "POST"],
            allow_headers=["Content-Type", "Authorization"],
        )

        # 3. Fetching BDA results resource
        results_resource = footage_resource.add_resource("results")
        results_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(get_bda_results_lambda),
            method_responses=[
                apigateway.MethodResponse(status_code="200"),
                apigateway.MethodResponse(status_code="404"),
                apigateway.MethodResponse(status_code="500"),
                apigateway.MethodResponse(status_code="202"),
            ],
        )

        # enable CORS for resource 3
        results_resource.add_cors_preflight(
            allow_origins=["*"],
            allow_methods=["OPTIONS", "GET", "POST"],
            allow_headers=["Content-Type", "Authorization"],
        )

        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self,
            "VideoUploadUrlEndpoint",
            value=f"https://{self.shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/footage/upload-url",
            description="POST endpoint for getting video upload URLs",
        )

        CfnOutput(
            self,
            "VideoAnalysisEndpoint",
            value=f"https://{self.shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/footage/analyze",
            description="POST endpoint for triggering video analysis",
        )

        CfnOutput(
            self,
            "GetBdaResultsEndpoint",
            value=f"https://{self.shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/footage/results",
            description="GET endpoint for fetching BDA results",
        )
