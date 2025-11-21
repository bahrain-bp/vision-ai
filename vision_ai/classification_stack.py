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
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ]
        )


        # Add permissions for S3 bucket access
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject",
            ],
            resources=[f"{investigation_bucket.bucket_arn}/*"]
        ))

        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
            "bedrock:Converse",
        ],
        resources=["*"],  
    )
        )

        get_upload_url_lambda = _lambda.Function(
            self, "GetUploadUrlFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="classification_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/classification"),
            role=lambda_role,
            timeout=Duration.seconds(60),
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Generate presigned URL for document uploads"
        )

        #Lambda #2: extract text using Bedrock Nova Lite
        extract_text_lambda = _lambda.Function(
            self,
            "ExtractTextLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="extract_text.handler",       
            code=_lambda.Code.from_asset("lambda/classification"),
            role=lambda_role,
            memory_size=512,
            timeout = Duration.seconds(600),  
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "BEDROCK_REGION": "us-east-1",             
                "NOVA_MODEL_ID": "amazon.nova-lite-v1:0",  
            },
        )

        # Allow lambda to read uploaded files from S3
        investigation_bucket.grant_read(extract_text_lambda)

        # Allow lambda to call Bedrock Nova Lite
        extract_text_lambda.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream", 
                ],
                resources=[
                    "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
            
                ],
            )
        )



        # === Add routes to shaed API ===
        # /classification
        classification_resource = shared_api.root.add_resource("classification")

        classification_resource.add_cors_preflight(
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

        #1- /classification/upload
        upload_resource= classification_resource.add_resource("upload")

        upload_resource.add_cors_preflight(
            allow_origins=["http://localhost:3000"],
            allow_methods=["OPTIONS", "POST"],
            allow_headers=[
                "Content-Type",
                "Authorization",
                "X-Amz-Date",
                "X-Api-Key",
                "X-Amz-Security-Token",
                "X-Requested-With"
            ]
        )


        upload_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(get_upload_url_lambda)
        )

        #2- for text extraction /classification/exreact
        extract_resource= classification_resource.add_resource("extract")
        extract_resource.add_cors_preflight(
            allow_origins=["http://localhost:3000"],
            allow_methods=["OPTIONS", "POST"],
            allow_headers=[
                "Content-Type",
                "Authorization",
                "X-Amz-Date",
                "X-Api-Key",
                "X-Amz-Security-Token",
                "X-Requested-With"
            ]
        )

        extract_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(extract_text_lambda),
        )
        

        CfnOutput(
            self,
            "ClassificationUploadUrlEndpoint",
            value=f"https://{shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/classification/upload",
            description="POST endpoint for getting document upload URLs",
        )

        CfnOutput(
            self,
            "TextExtractEndpoint",
            value=f"https://{shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/classification/extract",
            description="POST endpoint for text extraction",
        )

        
    