from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    Duration,
)
from constructs import Construct

class TranscriptionStack(Stack):
    """
    Transcription Stack - Handles saving live transcriptions to S3
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
        # LAMBDA: Save Transcription
        # ==========================================
        save_lambda = _lambda.Function(
            self, "SaveTranscriptionFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="save_transcription.handler",
            code=_lambda.Code.from_asset("lambda/transcription"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Saves live transcription to S3 when meeting ends"
        )

        # Grant S3 permissions
        investigation_bucket.grant_read_write(save_lambda)

        # ==========================================
        # LAMBDA: Get Transcription
        # ==========================================
        get_lambda = _lambda.Function(
            self, "GetTranscriptionFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_transcription.handler",
            code=_lambda.Code.from_asset("lambda/transcription"),
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Retrieves saved transcription from S3"
        )

        # Grant S3 read permissions
        investigation_bucket.grant_read(get_lambda)

        # ==========================================
        # API GATEWAY INTEGRATION
        # ==========================================

        # Create /transcription resource
        transcription_resource = self.shared_api.root.add_resource("transcription")

        # /transcription/save resource
        save_resource = transcription_resource.add_resource("save")
        
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
        
        # POST /transcription/save
        save_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(save_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )