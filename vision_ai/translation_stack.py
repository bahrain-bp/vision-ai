from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    Duration,
)
from constructs import Construct

class TranslationStack(Stack):
    """
    Translation Stack - Handles saving real-time translations to S3
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
        
        # Import shared API Gateway
        self.shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # Lambda: Save Translation
        save_lambda = _lambda.Function(
            self, "SaveTranslationFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="save_translation.handler",
            code=_lambda.Code.from_asset("lambda/translation"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Saves real-time translation data to S3 when session ends"
        )
        
        # Grant S3 permissions
        investigation_bucket.grant_read_write(save_lambda)
        
        # Create /translation resource
        translation_resource = self.shared_api.root.add_resource("translation")
        
        # /translation/save resource
        save_resource = translation_resource.add_resource("save")
        save_resource.add_cors_preflight(
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
        
        # POST /translation/save
        save_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(save_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )