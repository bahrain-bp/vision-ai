from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct


class classificationStack(Stack):
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        investigation_bucket: s3.IBucket,
        shared_api_id: str,  # Receive API ID
        shared_api_root_resource_id: str,  # Receive Root Resource ID
        env,
        **kwargs
    ) -> None: 
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # === Import the Shared API === 
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )        

        # === Create IAM Role for Lambda ===
        lambda_role = iam.Role(
            self, "ClassificationLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        )


        # Add permissions for S3 bucket access
        lambda_role.add_to_policy(iam.PolicyStatement(
            actions=[
                "s3:GetObject",
                "s3:PutObject"
            ],
            resources=[f"{investigation_bucket.bucket_arn}/*"]
        ))

        get_upload_url_lambda = _lambda.Function(
            self, "GetUploadUrlFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="classification_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/classification"),
            role=lambda_role,
            timeout=Duration.seconds(30),
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Generate presigned URL for document uploads"
        )

        # === Add routes to shaed API ===
        # /classification
        classification_resource = shared_api.root.add_resource("classification")

        #1- /classification/uploads
        upload_resource= classification_resource.add_resource("uploads")

        upload_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(get_upload_url_lambda)
        )

        