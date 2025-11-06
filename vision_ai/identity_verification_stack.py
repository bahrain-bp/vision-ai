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

class IdentityVerificationStack(Stack):
    """
    Identity Verification Stack - Adds routes to SHARED API Gateway
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
        # CREATE SEPARATE ROLES TO AVOID CIRCULAR DEPENDENCIES
        # ==========================================
        
        # Base role for Lambda functions (without API Gateway permissions)
        base_lambda_role = iam.Role(
            self, "IdentityVerificationLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Base role for Identity Verification Lambda functions"
        )
        
        # CloudWatch Logs permissions
        base_lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "logs:CreateLogGroup",
                "logs:CreateLogStream", 
                "logs:PutLogEvents"
            ],
            resources=[
                f"arn:aws:logs:{env.region}:{env.account}:log-group:/aws/lambda/*"
            ]
        ))
        
        # S3 permissions - scoped to the specific bucket
        base_lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:HeadObject",
                "s3:CopyObject"
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/*"
            ]
        ))
        
        base_lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["s3:ListBucket"],
            resources=[investigation_bucket.bucket_arn]
        ))
        
        # Textract permissions
        base_lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "textract:DetectDocumentText",
                "textract:AnalyzeDocument"
            ],
            resources=["*"]
        ))
        
        # Rekognition permissions
        base_lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "rekognition:DetectFaces",
                "rekognition:CompareFaces"
            ],
            resources=["*"]
        ))
        
        # ==========================================
        # LAMBDA FUNCTIONS (Individual Components)
        # ==========================================
        
        get_upload_url_lambda = _lambda.Function(
            self, "GetUploadUrlFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="get_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=base_lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Generate presigned URL for document upload"
        )
        
        extract_cpr_lambda = _lambda.Function(
            self, "ExtractCPRFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="extract_cpr.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=base_lambda_role,
            timeout=Duration.seconds(60),
            memory_size=512,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Extract CPR number from document using Textract"
        )
        
        check_reference_lambda = _lambda.Function(
            self, "CheckReferencePhotoFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="check_reference_photo.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=base_lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Check if reference photo exists in global-assets"
        )
        
        extract_face_lambda = _lambda.Function(
            self, "ExtractFaceFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="extract_face.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=base_lambda_role,
            timeout=Duration.seconds(60),
            memory_size=1024,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Extract face from document using Rekognition face detection"
        )
        
        compare_faces_lambda = _lambda.Function(
            self, "CompareFacesFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="compare_faces.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=base_lambda_role,
            timeout=Duration.seconds(30),
            memory_size=512,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Compare faces using Rekognition"
        )
        
        # ==========================================
        # ORCHESTRATOR FUNCTION 
        # ==========================================
        
        orchestrator_role = iam.Role(
            self, "OrchestratorRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Identity Verification Orchestrator"
        )
        
        # Copy all base permissions
        orchestrator_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "logs:CreateLogGroup",
                "logs:CreateLogStream", 
                "logs:PutLogEvents"
            ],
            resources=[
                f"arn:aws:logs:{env.region}:{env.account}:log-group:/aws/lambda/*"
            ]
        ))
        
        # S3 permissions - scoped to the specific bucket
        orchestrator_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:HeadObject",
                "s3:CopyObject"
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/*"
            ]
        ))
        
        orchestrator_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["s3:ListBucket"],
            resources=[investigation_bucket.bucket_arn]
        ))
        
        # Add Lambda invoke permissions
        orchestrator_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["lambda:InvokeFunction"],
            resources=[
                extract_cpr_lambda.function_arn,
                check_reference_lambda.function_arn,
                extract_face_lambda.function_arn,
                compare_faces_lambda.function_arn
            ]
        ))
        
        orchestrator_lambda = _lambda.Function(
            self, "IdentityVerificationOrchestratorFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="identity_verification_orchestrator.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=orchestrator_role,
            timeout=Duration.seconds(180),  # 3 minutes for complete workflow
            memory_size=512,  
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "EXTRACT_CPR_FUNCTION": extract_cpr_lambda.function_name,
                "CHECK_REFERENCE_FUNCTION": check_reference_lambda.function_name,
                "EXTRACT_FACE_FUNCTION": extract_face_lambda.function_name,
                "COMPARE_FACES_FUNCTION": compare_faces_lambda.function_name
            },
            description="Orchestrate complete identity verification workflow"
        )
        
        # ==========================================
        # ADD ROUTES TO SHARED API GATEWAY
        # ==========================================
        
        # /identity resource on SHARED API
        identity_resource = self.shared_api.root.add_resource("identity")
        
        # POST /identity/verify (Orchestrated workflow)
        verify_resource = identity_resource.add_resource("verify")
        verify_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(orchestrator_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /identity/upload-url (Individual function)
        upload_url_resource = identity_resource.add_resource("upload-url")
        upload_url_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(get_upload_url_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /identity/extract-cpr (Individual function)
        extract_cpr_resource = identity_resource.add_resource("extract-cpr")
        extract_cpr_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(extract_cpr_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # GET /identity/check-reference/{cpr} (Individual function)
        check_reference_resource = identity_resource.add_resource("check-reference")
        check_reference_cpr = check_reference_resource.add_resource("{cpr}")
        check_reference_cpr.add_method(
            "GET",
            apigateway.LambdaIntegration(check_reference_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE,
            request_parameters={"method.request.path.cpr": True}
        )
        
        # POST /identity/extract-face (Individual function)
        extract_face_resource = identity_resource.add_resource("extract-face")
        extract_face_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(extract_face_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /identity/compare-faces (Individual function)
        compare_faces_resource = identity_resource.add_resource("compare-faces")
        compare_faces_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(compare_faces_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "IdentityVerificationReady",
            value="Identity verification routes added to shared API",
            description="Confirmation that identity verification features were deployed",
            export_name="IdentityVerificationReady"
        )
        
        CfnOutput(
            self, "IndividualFunctionsAvailable",
            value="All individual functions accessible via /identity/* routes",
            description="Individual functions can be called directly if needed"
        )