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

class AdvancedAnalysisStack(Stack):
    """
    Advanced Analysis Stack - AI Suggested Questions feature
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
        
        # Import shared API Gateway
        self.shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # IAM Role for Lambda
        lambda_role = iam.Role(
            self, "AdvancedAnalysisLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Role for Advanced Analysis Lambda functions"
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
        
        # Bedrock permissions
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=[
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream"
            ],
            resources=["*"]
        ))
        
        # Generate Questions Lambda
        generate_questions_lambda = _lambda.Function(
            self, "GenerateQuestionsFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="generate_questions.handler",
            code=_lambda.Code.from_asset("lambda/advanced_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(180),
            memory_size=512,
            environment={
                "QUESTIONS_BUCKET": investigation_bucket.bucket_name,
                "INFERENCE_PROFILE_ARN": "us.amazon.nova-lite-v1:0"
            },
            description="Generate AI suggested questions for investigation sessions"
        )
        
        # Generate Focus Areas Lambda
        generate_focus_areas_lambda = _lambda.Function(
            self, "GenerateFocusAreasFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="generate_focus_areas.handler",
            code=_lambda.Code.from_asset("lambda/advanced_analysis"),
            role=lambda_role,
            timeout=Duration.seconds(180),
            memory_size=512,
            environment={
                "QUESTIONS_BUCKET": investigation_bucket.bucket_name,
                "INFERENCE_PROFILE_ARN": "us.amazon.nova-lite-v1:0"
            },
            description="Generate Areas of Focus for investigation reports"
        )
        
        # Add routes to shared API Gateway
        advanced_analysis_resource = self.shared_api.root.add_resource("advanced-analysis")
        questions_resource = advanced_analysis_resource.add_resource("questions")
        
        questions_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(generate_questions_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # POST /advanced-analysis/focus-areas
        focus_areas_resource = advanced_analysis_resource.add_resource("focus-areas")
        focus_areas_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(generate_focus_areas_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Add OPTIONS for CORS preflight
        questions_resource.add_method(
            "OPTIONS",
            apigateway.MockIntegration(
                integration_responses=[{
                    'statusCode': '200',
                    'responseParameters': {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'"
                    }
                }],
                passthrough_behavior=apigateway.PassthroughBehavior.NEVER,
                request_templates={"application/json": '{"statusCode": 200}'}
            ),
            method_responses=[{
                'statusCode': '200',
                'responseParameters': {
                    'method.response.header.Access-Control-Allow-Headers': True,
                    'method.response.header.Access-Control-Allow-Origin': True,
                    'method.response.header.Access-Control-Allow-Methods': True
                }
            }]
        )
        
        focus_areas_resource.add_method(
            "OPTIONS",
            apigateway.MockIntegration(
                integration_responses=[{
                    'statusCode': '200',
                    'responseParameters': {
                        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'"
                    }
                }],
                passthrough_behavior=apigateway.PassthroughBehavior.NEVER,
                request_templates={"application/json": '{"statusCode": 200}'}
            ),
            method_responses=[{
                'statusCode': '200',
                'responseParameters': {
                    'method.response.header.Access-Control-Allow-Headers': True,
                    'method.response.header.Access-Control-Allow-Origin': True,
                    'method.response.header.Access-Control-Allow-Methods': True
                }
            }]
        )
        
        # Store inference profile ARN for other stacks
        self.inference_profile_arn = "us.amazon.nova-lite-v1:0"
        
        # Outputs
        CfnOutput(
            self, "AdvancedAnalysisReady",
            value="Advanced Analysis routes added to shared API",
            description="Confirmation that advanced analysis features were deployed",
            export_name="AdvancedAnalysisReady"
        )