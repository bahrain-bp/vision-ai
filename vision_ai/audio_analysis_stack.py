from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_s3 as s3,
    aws_iam as iam,
)
from constructs import Construct


class AudioAnalysisStack(Stack):
    """
    Audio Analysis Stack - transcribe, translate, and analyze audio
    """

    def __init__(
        self,
        scope: Construct,
        id: str,
        investigation_bucket: s3.IBucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # =====================================================================
        # IAM ROLE FOR LAMBDA FUNCTIONS
        # =====================================================================
        lambda_role = iam.Role(
            self,
            "AudioAnalysisLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ],
        )

        lambda_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:HeadObject",
                    "s3:ListBucket",
                ],
                resources=[
                    f"{investigation_bucket.bucket_arn}/*",
                    investigation_bucket.bucket_arn,
                ],
            )
        )

        lambda_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "transcribe:StartTranscriptionJob",
                    "transcribe:GetTranscriptionJob",
                    "transcribe:DeleteTranscriptionJob",
                ],
                resources=["*"],
            )
        )

        lambda_role.add_to_policy(
            iam.PolicyStatement(actions=["translate:TranslateText"], resources=["*"])
        )

        lambda_role.add_to_policy(
            iam.PolicyStatement(actions=["lambda:InvokeFunction"], resources=["*"])
        )

        lambda_role.add_to_policy(
            iam.PolicyStatement(actions=["bedrock:InvokeModel"], resources=["*"])
        )

        # =====================================================================
        # LAMBDAS
        # =====================================================================

        # =====================================================================
        # LAMBDA FUNCTION: generate presigned audio upload URL
        # =====================================================================
        get_upload_url_lambda = _lambda.Function(
            self,
            "GetUploadUrlLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/audio_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
        )

        # =====================================================================
        # LAMBDA FUNCTION: process transcription and translate to Arabic
        # =====================================================================
        transcribe_processor_lambda = _lambda.Function(
            self,
            "TranscribeProcessorLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="transcribe_processor.handler",
            code=_lambda.Code.from_asset("lambda/audio_analysis"),
            role=lambda_role,
            timeout=Duration.minutes(15),
            memory_size=1024,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
        )

        # =====================================================================
        # LAMBDA FUNCTION: start audio transcription job
        # =====================================================================
        start_transcription_lambda = _lambda.Function(
            self,
            "StartTranscriptionLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="start_transcription.handler",
            code=_lambda.Code.from_asset("lambda/audio_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(10),
            memory_size=128,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "PROCESSOR_FUNCTION_NAME": transcribe_processor_lambda.function_name,
            },
        )

        # =====================================================================
        # LAMBDA FUNCTION: get audio analysis results
        # =====================================================================
        get_result_lambda = _lambda.Function(
            self,
            "GetResultLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_result.handler",
            code=_lambda.Code.from_asset("lambda/audio_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(10),
            memory_size=128,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
        )

        # =====================================================================
        # LAMBDA FUNCTION: audio analysis using bedrock nova lite
        # =====================================================================
        audio_assistant_lambda = _lambda.Function(
            self,
            "AudioAssistantLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="audio_assistant.handler",
            code=_lambda.Code.from_asset("lambda/audio_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(120),
            memory_size=512,
        )

        # =====================================================================
        # IMPORT SHARED API GATEWAY
        # =====================================================================
        api = apigw.RestApi.from_rest_api_attributes(
            self,
            "ImportedSharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id,
        )

        # add api root
        audio_resource = api.root.add_resource("audio")

        # add resources to root api and enable CORS for each

        # POST /audio/upload-url
        upload_url_resource = audio_resource.add_resource("upload-url")
        upload_url_resource.add_cors_preflight(
            allow_origins=apigw.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token",
                "Content-Length",
            ],
            allow_credentials=False,
            max_age=Duration.days(1),
        )
        upload_url_resource.add_method(
            "POST",
            apigw.LambdaIntegration(get_upload_url_lambda, proxy=True),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # POST /audio/transcribe
        transcribe_resource = audio_resource.add_resource("transcribe")
        transcribe_resource.add_cors_preflight(
            allow_origins=apigw.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token",
                "Content-Length",
            ],
            allow_credentials=False,
            max_age=Duration.days(1),
        )
        transcribe_resource.add_method(
            "POST",
            apigw.LambdaIntegration(start_transcription_lambda, proxy=True),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # GET /audio/result
        result_resource = audio_resource.add_resource("result")
        result_resource.add_cors_preflight(
            allow_origins=apigw.Cors.ALL_ORIGINS,
            allow_methods=["GET", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token",
            ],
            allow_credentials=False,
            max_age=Duration.days(1),
        )
        result_resource.add_method(
            "GET",
            apigw.LambdaIntegration(get_result_lambda, proxy=True),
            authorization_type=apigw.AuthorizationType.NONE,
        )

        # POST /audio/analyze
        analyze_resource = audio_resource.add_resource("analyze")
        analyze_resource.add_cors_preflight(
            allow_origins=apigw.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token",
                "Content-Length",
            ],
            allow_credentials=False,
            max_age=Duration.days(1),
        )
        analyze_resource.add_method(
            "POST",
            apigw.LambdaIntegration(audio_assistant_lambda, proxy=True),
            authorization_type=apigw.AuthorizationType.NONE,
        )
