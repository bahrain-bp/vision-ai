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
        shared_api_id: str,  # Receive API ID
        shared_api_root_resource_id: str,  # Receive Root Resource ID
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # ==========================================
        # IMPORT SHARED API GATEWAY - CORRECT WAY
        # ==========================================
        self.shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # ==========================================
        # IAM ROLE FOR LAMBDA FUNCTIONS
        # ==========================================
        lambda_role = iam.Role(
            self, "IdentityVerificationLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Identity Verification Lambda functions"
        )
        
        # CloudWatch Logs permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
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
        
        # S3 permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:HeadObject",
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/*"
            ]
        ))
        
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["s3:ListBucket"],
            resources=[investigation_bucket.bucket_arn]
        ))
        
        # Textract permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "textract:DetectDocumentText",
                "textract:AnalyzeDocument"
            ],
            resources=["*"]
        ))
        
        # Rekognition permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "rekognition:DetectFaces",
                "rekognition:CompareFaces"
            ],
            resources=["*"]
        ))
        
        # ==========================================
        # LAMBDA FUNCTIONS
        # ==========================================
        
        get_upload_url_lambda = _lambda.Function(
            self, "GetUploadUrlFunction",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="get_upload_url.handler",
            code=_lambda.Code.from_asset("lambda/identity_verification"),
            role=lambda_role,
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
            role=lambda_role,
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
            role=lambda_role,
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
            role=lambda_role,
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
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=512,
            environment={"BUCKET_NAME": investigation_bucket.bucket_name},
            description="Compare faces using Rekognition"
        )
        
        # ==========================================
        # ADD ROUTES TO SHARED API GATEWAY
        # ==========================================
        
        # /identity resource on SHARED API
        identity_resource = self.shared_api.root.add_resource("identity")
        
        # POST /identity/upload-url
        upload_url_resource = identity_resource.add_resource("upload-url")
        upload_url_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(get_upload_url_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /identity/extract-cpr
        extract_cpr_resource = identity_resource.add_resource("extract-cpr")
        extract_cpr_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(extract_cpr_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # GET /identity/check-reference/{cpr}
        check_reference_resource = identity_resource.add_resource("check-reference")
        check_reference_cpr = check_reference_resource.add_resource("{cpr}")
        check_reference_cpr.add_method(
            "GET",
            apigateway.LambdaIntegration(check_reference_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE,
            request_parameters={"method.request.path.cpr": True}
        )
        
        # POST /identity/extract-face
        extract_face_resource = identity_resource.add_resource("extract-face")
        extract_face_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(extract_face_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /identity/compare-faces
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