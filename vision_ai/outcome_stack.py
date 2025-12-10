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

class OutcomeStack(Stack):
    
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
        
        self.shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        lambda_role = iam.Role(
            self, "OutcomeLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com")
        )
        
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
            resources=[f"arn:aws:logs:{env.region}:{env.account}:log-group:/aws/lambda/*"]
        ))
        
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
            resources=[f"{investigation_bucket.bucket_arn}/*", investigation_bucket.bucket_arn]
        ))
        
        lambda_role.add_to_policy(iam.PolicyStatement(
            effect=iam.Effect.ALLOW,
            actions=["bedrock:InvokeModel"],
            resources=["*"]
        ))
        
        generate_outcome_lambda = _lambda.Function(
            self, "GenerateOutcomeFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="generate_outcome.handler",
            code=_lambda.Code.from_asset("lambda/outcome"),
            role=lambda_role,
            timeout=Duration.seconds(180),
            memory_size=512,
            environment={
                "OUTCOME_BUCKET": investigation_bucket.bucket_name,
                "INFERENCE_PROFILE_ARN": "us.amazon.nova-lite-v1:0"
            }
        )
        
        outcome_resource = self.shared_api.root.add_resource("outcome")
        
        outcome_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(generate_outcome_lambda, proxy=True),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        outcome_resource.add_method(
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
        
        CfnOutput(
            self, "OutcomeReady",
            value="Outcome routes added to shared API",
            export_name="OutcomeReady"
        )
