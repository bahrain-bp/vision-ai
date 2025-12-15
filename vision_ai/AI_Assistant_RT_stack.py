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

class AIAssistantRTStack(Stack):
    """
    AI Assistant Real-Time Stack (Requirement 1)
    
    Provides Lambda functions for AI-powered question generation during live testimony:
    - Lambda 1: Get Case Summary (fetch police-summary.txt from S3)
    - Lambda 2: Get Victim Testimony (fetch victim session transcripts from S3)
    - Lambda 3: Generate Questions (call Bedrock Nova Lite with full context)
    - Lambda 4: Save Questions (save confirmed questions to S3)
    - Lambda 5: Evaluate Question (evaluate manually entered questions)
    
    API Routes:
    - GET /cases/{caseId}/police-summary
    - GET /cases/{caseId}/victim-testimony
    - POST /questions/generate
    - POST /ai-questions/save
    - POST /questions/evaluate
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        investigation_bucket: s3.IBucket,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        cases_resource_id: str,
        case_by_id_resource_id: str,
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
        # IAM ROLE FOR LAMBDA FUNCTIONS
        # ==========================================
        lambda_role = iam.Role(
            self, "AIAssistantLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for AI Assistant Lambda functions",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                )
            ]
        )
        
        # S3 permissions - scoped to the specific bucket
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:ListBucket"
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/*",
                investigation_bucket.bucket_arn
            ]
        ))
        
        # S3 permissions for save-questions Lambda (read questions.json, write JSON and HTML)
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "s3:GetObject",
                "s3:PutObject"
            ],
            resources=[
                f"{investigation_bucket.bucket_arn}/cases/*/sessions/*/ai-questions/*"
            ]
        ))
        
        # Bedrock permissions (for question generation and evaluation)
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["bedrock:InvokeModel"],
            resources=[
                f"arn:aws:bedrock:{Stack.of(self).region}::foundation-model/amazon.nova-lite-v1:0"
            ]
        ))
        
        # ==========================================
        # LAMBDA 1: GET CASE SUMMARY
        # ==========================================
        get_case_summary_lambda = _lambda.Function(
            self, "GetCaseSummaryFunction",
            function_name="vision-ai-get-case-summary",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="get_case_summary.lambda_handler",
            code=_lambda.Code.from_asset("lambda/AI_Assistant_RT"),
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO"
            },
            description="Fetches pre-uploaded police case summary from S3 for question generation"
        )
        
        # ==========================================
        # LAMBDA 2: GET VICTIM TESTIMONY
        # ==========================================
        get_victim_testimony_lambda = _lambda.Function(
            self, "GetVictimTestimonyFunction",
            function_name="vision-ai-get-victim-testimony",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="get_victim_testimony.lambda_handler",
            code=_lambda.Code.from_asset("lambda/AI_Assistant_RT"),
            role=lambda_role,
            timeout=Duration.seconds(60),
            memory_size=512,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO"
            },
            description="Fetches victim testimony transcripts from past sessions for cross-referencing"
        )
        
        # ==========================================
        # LAMBDA 3: GENERATE QUESTIONS
        # ==========================================
        generate_questions_lambda = _lambda.Function(
            self, "GenerateQuestionsFunction",
            function_name="vision-ai-generate-questions",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="generate_questions.lambda_handler",
            code=_lambda.Code.from_asset("lambda/AI_Assistant_RT"),
            role=lambda_role,
            timeout=Duration.seconds(90),
            memory_size=1024,
            environment={
                "BEDROCK_MODEL_ID": "amazon.nova-lite-v1:0",
                "LOG_LEVEL": "INFO"
            },
            description="Generates AI-powered investigation questions using Amazon Bedrock Nova Lite"
        )
        
        # ==========================================
        # LAMBDA 4: SAVE QUESTIONS
        # ==========================================
        save_questions_lambda = _lambda.Function(
            self, "SaveQuestionsFunction",
            function_name="vision-ai-save-questions",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="save_questions.lambda_handler",
            code=_lambda.Code.from_asset("lambda/AI_Assistant_RT"),
            role=lambda_role,
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "LOG_LEVEL": "INFO"
            },
            description="Saves confirmed question attempts to S3 with metrics and audit trail"
        )
        
        # ==========================================
        # LAMBDA 5: EVALUATE QUESTION
        # ==========================================
        evaluate_question_lambda = _lambda.Function(
            self, "EvaluateQuestionFunction",
            function_name="vision-ai-evaluate-question",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="evaluate_question.lambda_handler",
            code=_lambda.Code.from_asset("lambda/AI_Assistant_RT"),
            role=lambda_role,
            timeout=Duration.seconds(60),
            memory_size=512,
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "BEDROCK_MODEL_ID": "amazon.nova-lite-v1:0",
                "LOG_LEVEL": "INFO"
            },
            description="Evaluates manually entered questions using Bedrock AI"
        )
        
        # ==========================================
        # API ROUTES TO SHARED API GATEWAY
        # ==========================================
        
        # Import the case_by_id resource using its ID
        case_by_id_resource = apigateway.Resource.from_resource_attributes(
            self, "ImportedCaseByIdResource",
            resource_id=case_by_id_resource_id,
            rest_api=self.shared_api,
            path="/cases/{caseId}"
        )
        
        # Endpoint 1: /cases/{caseId}/police-summary
        police_summary_resource = case_by_id_resource.add_resource("police-summary")
        police_summary_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["GET", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )
        police_summary_resource.add_method(
            "GET",
            apigateway.LambdaIntegration(
                get_case_summary_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Endpoint 2: /cases/{caseId}/victim-testimony
        victim_testimony_resource = case_by_id_resource.add_resource("victim-testimony")
        victim_testimony_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["GET", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )
        victim_testimony_resource.add_method(
            "GET",
            apigateway.LambdaIntegration(
                get_victim_testimony_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Create /questions resource (shared by generate and evaluate)
        questions_resource = self.shared_api.root.add_resource("questions")
        
        # Endpoint 3: /questions/generate
        generate_resource = questions_resource.add_resource("generate")
        generate_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )
        generate_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                generate_questions_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Endpoint 5: /questions/evaluate (NEW)
        evaluate_resource = questions_resource.add_resource("evaluate")
        evaluate_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )
        evaluate_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                evaluate_question_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Endpoint 4: /ai-questions/save
        ai_questions_resource = self.shared_api.root.add_resource("ai-questions")
        save_resource = ai_questions_resource.add_resource("save")
        save_resource.add_cors_preflight(
            allow_origins=apigateway.Cors.ALL_ORIGINS,
            allow_methods=["POST", "OPTIONS"],
            allow_headers=[
                "Content-Type",
                "X-Amz-Date",
                "Authorization",
                "X-Api-Key",
                "X-Amz-Security-Token"
            ],
            allow_credentials=False,
            max_age=Duration.days(1)
        )
        save_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(
                save_questions_lambda,
                proxy=True
            ),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "GetCaseSummaryEndpoint",
            value="GET /cases/{caseId}/police-summary",
            description="Endpoint for fetching police case summaries",
            export_name="GetCaseSummaryEndpoint"
        )
        
        CfnOutput(
            self, "GetVictimTestimonyEndpoint",
            value="GET /cases/{caseId}/victim-testimony",
            description="Endpoint for fetching victim testimony transcripts",
            export_name="GetVictimTestimonyEndpoint"
        )
        
        CfnOutput(
            self, "GenerateQuestionsEndpoint",
            value="POST /questions/generate",
            description="Endpoint for generating AI-powered investigation questions",
            export_name="GenerateQuestionsEndpoint"
        )
        
        CfnOutput(
            self, "EvaluateQuestionEndpoint",
            value="POST /questions/evaluate",
            description="Endpoint for evaluating manually entered questions",
            export_name="EvaluateQuestionEndpoint"
        )
        
        CfnOutput(
            self, "SaveQuestionsEndpoint",
            value="POST /ai-questions/save",
            description="Endpoint for saving confirmed questions to S3",
            export_name="SaveQuestionsEndpoint"
        )
        
        CfnOutput(
            self, "SavedQuestionsS3Path",
            value="cases/{caseId}/sessions/{sessionId}/ai-questions/questions.json",
            description="S3 path where questions are saved"
        )