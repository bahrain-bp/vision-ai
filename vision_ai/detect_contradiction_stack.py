from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as _lambda,
    aws_apigateway as apigw,
    aws_s3 as s3,
    aws_iam as iam,
)
from constructs import Construct


class ContradictionStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        investigation_bucket: s3.IBucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        **kwargs
    ):
        super().__init__(scope, id, **kwargs)

        # =====================================================================
        # LAMBDA FUNCTION 1 — GET WITNESSES
        # =====================================================================
        get_witnesses_lambda = _lambda.Function(
            self,
            "GetWitnessesLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="get_witnesses.handler",
            code=_lambda.Code.from_asset("lambda/contradiction"),
            timeout=Duration.seconds(120),
            memory_size=512,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
            },
        )
        investigation_bucket.grant_read(get_witnesses_lambda)

        # =====================================================================
        # LAMBDA FUNCTION 2 — ANALYZE CONTRADICTIONS
        # =====================================================================
        analyze_lambda = _lambda.Function(
            self,
            "AnalyzeContradictionsLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="analyze_contradiction.handler",
            code=_lambda.Code.from_asset("lambda/contradiction"),
            timeout=Duration.seconds(300),
            memory_size=1024,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "BEDROCK_MODEL_ID": "amazon.nova-lite-v1:0",
            },
        )

        analyze_lambda.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream"
                ],
                resources=[
                    f"arn:aws:bedrock:{self.region}::foundation-model/amazon.nova-lite-v1:0"
                ]
            )
        )
        investigation_bucket.grant_read_write(analyze_lambda)

        # =====================================================================
        # IMPORT EXISTING API GATEWAY
        # =====================================================================
        api = apigw.RestApi.from_rest_api_attributes(
            self,
            "ImportedSharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id,
        )

        # =====================================================================
        # ROUTING SETUP
        # =====================================================================
        contradictions_resource = api.root.add_resource("contradictions")

        # GET /contradictions/witnesses
        witnesses_resource = contradictions_resource.add_resource("witnesses")
        witnesses_resource.add_method(
            "GET",
            apigw.LambdaIntegration(get_witnesses_lambda),
        )

        # POST /contradictions/analyze
        analyze_resource = contradictions_resource.add_resource("analyze")
        analyze_resource.add_method(
            "POST",
            apigw.LambdaIntegration(analyze_lambda),
        )
