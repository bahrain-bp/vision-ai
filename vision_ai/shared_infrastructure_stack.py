from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_apigateway as apigateway,
    RemovalPolicy,
    Duration,
    CfnOutput,
)
from constructs import Construct

class SharedInfrastructureStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, env, **kwargs) -> None: 
        super().__init__(scope, construct_id, env=env, **kwargs) 
        
        # ==========================================
        # S3 BUCKET - SHARED ACROSS ALL FEATURES
        # ==========================================
        self.investigation_bucket = s3.Bucket(
            self, "InvestigationBucket",
            bucket_name="vision-rt-investigation-system",  
            versioned=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.RETAIN,
            lifecycle_rules=[
                # Auto-delete temporary uploads after 7 days if not processed
                s3.LifecycleRule(
                    id="DeleteUnprocessedUploads",
                    prefix="*/uploaded/",
                    expiration=Duration.days(7),
                    enabled=True
                )
            ],
            cors=[s3.CorsRule(
                allowed_methods=[
                    s3.HttpMethods.GET,
                    s3.HttpMethods.PUT,
                    s3.HttpMethods.POST,
                    s3.HttpMethods.DELETE
                ],
                allowed_origins=["*"],  # TODO: Should Restrict to frontend domain in production
                allowed_headers=["*"],
                exposed_headers=["ETag"],
                max_age=3000
            )]
        )
        
        # ==========================================
        # API GATEWAY - SHARED ACROSS ALL FEATURES
        # ==========================================
        self.api = apigateway.RestApi(
            self, "VisionAIAPI",
            rest_api_name="Vision AI Investigation System API",
            description="Unified API for all investigation system features",
            #  base64 image support
            binary_media_types=['image/jpeg', 'image/png', 'application/octet-stream'],
            deploy_options=apigateway.StageOptions(
                stage_name="prod",
                throttling_rate_limit=100,
                throttling_burst_limit=200,
                # 🚨 TEMPORARILY DISABLE LOGGING TO FIX DEPLOYMENT
                logging_level=apigateway.MethodLoggingLevel.OFF,  
                # 🚨 TEMPORARILY DISABLE THESE TO FIX CLOUDWATCH ROLE ISSUE
                data_trace_enabled=False,  
                metrics_enabled=False,     
            ),
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,  # TODO: Restrict in production
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=[
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token'
                ],
                allow_credentials=True,
            )
        )
        
        # ==========================================
        # API RESOURCES - Base paths for each feature
        # ==========================================
        
        # /identity - For identity verification feature
        self.identity_resource = self.api.root.add_resource("identity")
        
        # ==========================================
        # OUTPUTS - Export for other stacks
        # ==========================================
        CfnOutput(
            self, "BucketName",
            value=self.investigation_bucket.bucket_name,
            description="Investigation system S3 bucket name",
            export_name="InvestigationBucketName"
        )
        
        CfnOutput(
            self, "BucketArn",
            value=self.investigation_bucket.bucket_arn,
            description="Investigation system S3 bucket ARN",
            export_name="InvestigationBucketArn"
        )
        
        CfnOutput(
            self, "APIEndpoint",
            value=self.api.url,
            description="API Gateway endpoint URL",
            export_name="VisionAIAPIEndpoint"
        )
        
        CfnOutput(
            self, "APIId",
            value=self.api.rest_api_id,
            description="API Gateway ID",
            export_name="VisionAIAPIId"
        )