from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3_deployment as s3deploy,
    aws_iam as iam,
    RemovalPolicy,
    CfnOutput,
    Duration,
)
from constructs import Construct

class FrontendStack(Stack):
    """
    CloudFront + S3 stack for serving the React frontend application.
    
    This stack creates:
    - S3 bucket to store the built React application
    - CloudFront distribution with Origin Access Control (OAC) for secure access
    - Automatic deployment of frontend files to S3
    - HTTPS-only access with proper caching policies
    """
    
    def __init__(
        self, 
        scope: Construct, 
        id: str,
        environment: str = "dev",
        **kwargs
    ):
        super().__init__(scope, id, **kwargs)
        
        # =====================================================
        # S3 BUCKET FOR FRONTEND ASSETS
        # =====================================================
        self.website_bucket = s3.Bucket(
            self, 
            f"VisionAIWebsiteBucket-{environment}",
            bucket_name=f"vision-ai-frontend-{environment}-{self.account}",
            removal_policy=RemovalPolicy.DESTROY if environment == "dev" else RemovalPolicy.RETAIN,
            auto_delete_objects=True if environment == "dev" else False,
            # Block all public access 
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            # Enable versioning for production
            versioned=True if environment == "prod" else False,
            # Enable encryption at rest
            encryption=s3.BucketEncryption.S3_MANAGED,
            # Lifecycle rules to manage costs
            lifecycle_rules=[
                s3.LifecycleRule(
                    id="DeleteOldVersions",
                    enabled=True,
                    noncurrent_version_expiration=Duration.days(30)
                )
            ] if environment == "prod" else []
        )
        
        # =====================================================
        # CLOUDFRONT DISTRIBUTION
        # =====================================================
        
        # Create Origin Access Control (OAC) 
        cfn_origin_access_control = cloudfront.CfnOriginAccessControl(
            self,
            "OAC",
            origin_access_control_config=cloudfront.CfnOriginAccessControl.OriginAccessControlConfigProperty(
                name=f"vision-ai-oac-{environment}",
                origin_access_control_origin_type="s3",
                signing_behavior="always",
                signing_protocol="sigv4"
            )
        )
        
        # CloudFront Distribution
        self.distribution = cloudfront.Distribution(
            self, 
            f"VisionAIDistribution-{environment}",
            comment=f"VISION-AI Frontend Distribution - {environment}",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    self.website_bucket
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                # Caching policy optimized for SPAs
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                # Compress assets for faster delivery
                compress=True,
            ),
            # Default document for root access
            default_root_object="index.html",
            # Handle React Router - redirect all 404s to index.html
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_page_path="/index.html",
                    response_http_status=200,
                    ttl=Duration.minutes(5)
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_page_path="/index.html",
                    response_http_status=200,
                    ttl=Duration.minutes(5)
                )
            ],
            # Enable IPv6
            enable_ipv6=True,
            # Price class - middle east
            price_class=cloudfront.PriceClass.PRICE_CLASS_200,
            # Enable logging for production
            enable_logging=True if environment == "prod" else False,
        )
        
        # Add bucket policy to allow CloudFront OAC to access S3
        self.website_bucket.add_to_resource_policy(
            iam.PolicyStatement(
                actions=["s3:GetObject"],
                resources=[self.website_bucket.arn_for_objects("*")],
                principals=[iam.ServicePrincipal("cloudfront.amazonaws.com")],
                conditions={
                    "StringEquals": {
                        "AWS:SourceArn": f"arn:aws:cloudfront::{self.account}:distribution/{self.distribution.distribution_id}"
                    }
                }
            )
        )
        
        # =====================================================
        # DEPLOY FRONTEND TO S3
        # =====================================================
        self.deployment = s3deploy.BucketDeployment(
            self, 
            f"DeployVisionAIWebsite-{environment}",
            sources=[s3deploy.Source.asset("./frontend/build")],
            destination_bucket=self.website_bucket,
            distribution=self.distribution,
            # Invalidate CloudFront cache on deployment
            distribution_paths=["/*"],
            # Retain old versions in production
            prune=True if environment == "dev" else False,
            # Set cache control headers
            cache_control=[
                s3deploy.CacheControl.max_age(Duration.hours(1)),
                s3deploy.CacheControl.s_max_age(Duration.hours(1))
            ],
            # Memory allocated to the deployment Lambda
            memory_limit=1024,
        )
        
        # =====================================================
        # OUTPUTS
        # =====================================================
        CfnOutput(
            self, 
            "CloudFrontURL",
            description="CloudFront Distribution URL",
            value=f"https://{self.distribution.distribution_domain_name}",
            export_name=f"VisionAI-CloudFrontURL-{environment}"
        )
        
        CfnOutput(
            self, 
            "S3BucketName",
            description="S3 Bucket Name for Frontend",
            value=self.website_bucket.bucket_name,
            export_name=f"VisionAI-FrontendBucket-{environment}"
        )
        
        CfnOutput(
            self, 
            "DistributionId",
            description="CloudFront Distribution ID",
            value=self.distribution.distribution_id,
            export_name=f"VisionAI-DistributionId-{environment}"
        )