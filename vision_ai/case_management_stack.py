from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_apigateway as apigateway,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct

class CaseManagementStack(Stack):
    """
    Case Management Stack - Handles cases and session creation only
    """
    
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        investigation_bucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # Import shared API
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # IAM Role for Lambda functions
        lambda_role = iam.Role(
            self, "CaseManagementLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Case Management Lambda functions",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ]
        )
        
        # S3 permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:HeadObject"
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/*",
                investigation_bucket.bucket_arn
            ]
        ))
        
        # Common Lambda configuration
        lambda_config = dict(
            runtime=_lambda.Runtime.PYTHON_3_11,
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name
            }
        )
        
        # Create Lambda functions
        get_all_cases_lambda = _lambda.Function(
            self, "GetAllCasesFunction",
            function_name="vision-ai-get-all-cases",
            handler="get_all_cases.handler",
            code=_lambda.Code.from_asset("lambda/case_management"),
            **lambda_config
        )
        
        create_case_lambda = _lambda.Function(
            self, "CreateCaseFunction",
            function_name="vision-ai-create-case",
            handler="create_case.handler",
            code=_lambda.Code.from_asset("lambda/case_management"),
            **lambda_config
        )
        
        create_session_lambda = _lambda.Function(
            self, "CreateSessionFunction",
            function_name="vision-ai-create-session",
            handler="create_session.handler",
            code=_lambda.Code.from_asset("lambda/case_management"),
            **lambda_config
        )

        update_case_status_lambda = _lambda.Function(
            self, "UpdateCaseStatusFunction",
            function_name="vision-ai-update-case-status",
            handler="update_case_status.handler",
            code=_lambda.Code.from_asset("lambda/case_management"),
            **lambda_config
        )
        
        # ==========================================
        # ROUTES TO SHARED API GATEWAY 
        # ==========================================
        
        # /cases resource on SHARED API
        cases_resource = shared_api.root.add_resource("cases")
        
        # SINGLE CORS preflight for /cases (covers both GET and POST)
        cases_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["GET", "POST", "OPTIONS"],
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
        
        # GET /cases - Get all cases
        cases_resource.add_method(
            "GET",
            apigateway.LambdaIntegration(get_all_cases_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /cases - Create new case
        cases_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(create_case_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # /cases/{caseId} resource
        case_resource = cases_resource.add_resource("{caseId}")
        
        # CORS preflight for /cases/{caseId} 
        case_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["PATCH", "OPTIONS"],
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
        
        # PATCH /cases/{caseId} - Update case status
        case_resource.add_method(
            "PATCH",
            apigateway.LambdaIntegration(update_case_status_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /cases/{caseId}/sessions - Create new session
        sessions_resource = case_resource.add_resource("sessions")
        
        # CORS preflight for /cases/{caseId}/sessions
        sessions_resource.add_cors_preflight(
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
        
        sessions_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(create_session_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "GetCasesEndpoint",
            value="GET /cases",
            description="Endpoint to get all cases"
        )
        
        CfnOutput(
            self, "CreateCaseEndpoint", 
            value="POST /cases",
            description="Endpoint to create new case"
        )
        
        CfnOutput(
            self, "CreateSessionEndpoint",
            value="POST /cases/{caseId}/sessions",
            description="Endpoint to create new session"
        )

        CfnOutput(
            self, "UpdateCaseStatusEndpoint",
            value="PATCH /cases/{caseId}",
            description="Endpoint to update case status"
        )