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

        docx_layer = _lambda.LayerVersion(
            self,
            "DocxLayer",
            code=_lambda.Code.from_asset("./layers/docx-layer.zip"),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12],
            description="python-docx dependency layer",
        )

        tesseract_layer = _lambda.LayerVersion(
            self,
            "TesseractLayer",
            code=_lambda.Code.from_asset("./layers/tesseract-al2-layer.zip"),
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12],
            description="Tesseract OCR binary layer for Amazon Linux 2",
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

        store_text_lambda = _lambda.Function(
            self,
            "StoreExtractedTextLambda",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="store_extracted_text.handler",
            code=_lambda.Code.from_asset("lambda/classification"),
            role=lambda_role,
            timeout=Duration.seconds(60),
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Store extracted text into S3"
        )

        classify_lambda = _lambda.Function(
            self,
            "ClassificationRequestLambda",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="classification_request.handler",
            code=_lambda.Code.from_asset("lambda/classification"),
            role=lambda_role,
            timeout=Duration.seconds(120),
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "NOVA_MODEL_ID": "amazon.nova-lite-v1:0",
            },
            description="Classify extracted text into violation, misdemeanor, or felony",
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
            timeout = Duration.seconds(900),  
            layers=[
                tesseract_layer,
                _lambda.LayerVersion.from_layer_version_arn(
                    self, "PDFLayer", "arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p312-PyMuPDF:11"
                ),
                _lambda.LayerVersion.from_layer_version_arn(
                    self, "PillowLayer", "arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p312-Pillow:8"
                ),
                docx_layer,
            ],
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "BEDROCK_REGION": "us-east-1",             
                "MODEL_ID": "us.meta.llama3-2-90b-instruct-v1:0",  
                "TESSDATA_PREFIX": "/opt/tesseract/share",
                "TESSERACT_CMD": "/opt/bin/tesseract",
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
                    "*"
            
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
                "X-Requested-With",
                "Content-Length"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )

        #1- /classification/upload
        upload_resource= classification_resource.add_resource("upload")

        upload_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["OPTIONS", "POST"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "X-Requested-With"
            ]
        )


        upload_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(get_upload_url_lambda),
            authorization_type=apigateway.AuthorizationType.NONE,
        )

        #2- for text extraction /classification/exreact
        extract_resource= classification_resource.add_resource("extract")
        extract_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["OPTIONS", "POST"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "X-Requested-With"
            ]
        )

        extract_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(extract_text_lambda),
            authorization_type=apigateway.AuthorizationType.NONE,
        )

        extract_fn_url = extract_text_lambda.add_function_url(
            auth_type=_lambda.FunctionUrlAuthType.NONE,
            cors=_lambda.FunctionUrlCorsOptions(
                allowed_origins=["*"],
                allowed_methods=[_lambda.HttpMethod.POST],    
                allowed_headers=[
                    "content-type",
                    "x-amz-date",
                    "x-requested-with"
                ]
            )
        )

        store_resource = classification_resource.add_resource("store")
        store_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["OPTIONS", "POST"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "X-Requested-With"
            ]
        )

        store_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(store_text_lambda),
            authorization_type=apigateway.AuthorizationType.NONE,
        )

        classify_resource = classification_resource.add_resource("categorize")
        classify_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["OPTIONS", "POST"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "X-Requested-With"
            ]
        )

        classify_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(classify_lambda),
            authorization_type=apigateway.AuthorizationType.NONE,
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

        CfnOutput(
            self,
            "ExtractTextFunctionURL",
            value=extract_fn_url.url,
            description="Direct Lambda URL for text extraction",
        )

        CfnOutput(
            self,
            "StoreExtractedTextEndpoint",
            value=f"https://{shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/classification/store",
            description="POST endpoint for storing extracted text",
        )

        CfnOutput(
            self,
            "ClassificationCategorizeEndpoint",
            value=f"https://{shared_api.rest_api_id}.execute-api.{env.region}.amazonaws.com/prod/classification/categorize",
            description="POST endpoint for classifying extracted text",
        )

        
    
