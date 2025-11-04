from aws_cdk import (
    Stack,
    aws_apigateway as apigateway,
    CfnOutput,
)
from constructs import Construct

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
        deployment = apigateway.Deployment(self, "APIDeployment", api=shared_api)
        
        stage = apigateway.Stage(
            self, "ProdStage",
            deployment=deployment,
            stage_name="prod",
            throttling_rate_limit=100,
            throttling_burst_limit=200,
        )
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "SharedAPIEndpoint",
            value=f"https://{shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod",
            description="Shared API Gateway endpoint URL for ALL teams",
            export_name="VisionAISharedAPIEndpoint"
        )