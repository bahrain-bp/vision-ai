from aws_cdk import (
    Stack,
    aws_apigateway as apigateway,
    CfnOutput,
)
from constructs import Construct
import time

class APIDeploymentStack(Stack):
    """
    API Deployment Stack - Deploys the shared API Gateway
    """
    
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # Import the shared API 
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # ==========================================
        # API GATEWAY DEPLOYMENT
        # ==========================================
        deployment = apigateway.Deployment(
            self, 
            f"APIDeployment{int(time.time())}", 
            api=shared_api,
            description=f"Deployment at {int(time.time())}"
        )
        
        stage = apigateway.Stage(
            self, "ProdStage",
            deployment=deployment,
            stage_name="prod",
            throttling_rate_limit=100,
            throttling_burst_limit=200,
            description="Production stage for Vision AI API",
            metrics_enabled=True
        )
        
        # Set the stage as default
        shared_api.deployment_stage = stage
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        api_endpoint = f"https://{shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod"
        
        CfnOutput(
            self, "SharedAPIEndpoint",
            value=api_endpoint,
            description="Shared API Gateway endpoint URL - Use this for all API calls",
            export_name="VisionAISharedAPIEndpoint"
        )
        
        CfnOutput(
            self, "IdentityVerifyEndpoint",
            value=f"{api_endpoint}/identity/verify",
            description="POST endpoint for identity verification"
        )
        
        CfnOutput(
            self, "IdentityUploadUrlEndpoint",
            value=f"{api_endpoint}/identity/upload-url",
            description="POST endpoint for getting upload URLs"
        )
        
        CfnOutput(
            self, "APIId",
            value=shared_api.rest_api_id,
            description="API Gateway ID"
        )
        
        CfnOutput(
            self, "StageName",
            value="prod",
            description="API Gateway stage name"
        )
        
        CfnOutput(
            self, "CloudWatchLogsEnabled",
            value="true",
            description="CloudWatch Logs enabled for API Gateway"
        )