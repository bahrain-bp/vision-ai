from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_apigateway as apigateway,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct

class SharedInfrastructureStack(Stack):
    """
    Shared Infrastructure Stack - Contains ONLY shared resources
    """
    
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
            cors=[s3.CorsRule(
                allowed_methods=[
                    s3.HttpMethods.GET,
                    s3.HttpMethods.PUT,
                    s3.HttpMethods.POST,
                    s3.HttpMethods.DELETE,
                    s3.HttpMethods.HEAD
                ],
                allowed_origins=[
                "http://localhost:3000",
                "https://d1beit5kpeumzc.cloudfront.net"  
                ],
                allowed_headers=["*"],
                exposed_headers=["ETag"],
                max_age=3000
            )]
        )
        
        # ==========================================
        # API GATEWAY - SHARED ACROSS ALL FEATURES
        # ==========================================
        self.shared_api = apigateway.RestApi(
            self, "SharedAPI",
            rest_api_name="Vision AI Shared API",
            description="Shared API Gateway for ALL Vision AI features",
            binary_media_types=['image/jpeg', 'image/png', 'application/octet-stream'],
            deploy=False,  # Deployed separately in APIDeploymentStack
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
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
        # OUTPUTS
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
            self, "SharedAPIId",
            value=self.shared_api.rest_api_id,
            description="Shared API Gateway ID for ALL teams",
            export_name="VisionAISharedAPIId"
        )
        
        CfnOutput(
            self, "SharedAPIRootResourceId",
            value=self.shared_api.rest_api_root_resource_id,
            description="Shared API Gateway root resource ID",
            export_name="VisionAISharedAPIRootResourceId"
        )