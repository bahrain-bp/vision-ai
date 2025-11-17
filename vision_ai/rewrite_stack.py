from aws_cdk import (
    Stack,
    Duration,
    aws_lambda as _lambda,
    aws_s3 as s3,
    aws_apigateway as apigateway,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct

class RewriteStack(Stack):
    
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        shared_api_id: str,
        shared_api_root_resource_id: str,
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        bucket_name = f"vision-investigation-system-{self.account}"
        
        # Use existing S3 bucket
        rewrite_bucket = s3.Bucket.from_bucket_name(
            self, "RewriteBucket",
            bucket_name=bucket_name
        )
        
        # Lambda Function
        rewrite_lambda = _lambda.Function(
            self, "RewriteFunction",
            runtime=_lambda.Runtime.PYTHON_3_12,
            handler="rewrite_handler.lambda_handler",
            code=_lambda.Code.from_asset("lambda/rewrite_document"),
            timeout=Duration.seconds(300),
            memory_size=512,
            environment={
                'BUCKET_NAME': bucket_name
            }
        )
        
        # Grant permissions to existing bucket
        rewrite_lambda.add_to_role_policy(iam.PolicyStatement(
            actions=['s3:PutObject', 's3:GetObject'],
            resources=[f'arn:aws:s3:::{bucket_name}/rewritten/*']
        ))
        
        rewrite_lambda.add_to_role_policy(iam.PolicyStatement(
            actions=['bedrock:InvokeModel'],
            resources=[f'arn:aws:bedrock:{self.region}::foundation-model/amazon.nova-lite-v1:0']
        ))
        
        # Import shared API
        shared_api = apigateway.RestApi.from_rest_api_attributes(
            self, "SharedAPI",
            rest_api_id=shared_api_id,
            root_resource_id=shared_api_root_resource_id
        )
        
        # Add /rewrite route
        rewrite_resource = shared_api.root.add_resource("rewrite")
        
        rewrite_resource.add_method(
            "POST",
            apigateway.LambdaIntegration(rewrite_lambda),
            authorization_type=apigateway.AuthorizationType.NONE
        )
        
        # Outputs
        CfnOutput(
            self, "RewriteLambdaArn",
            value=rewrite_lambda.function_arn,
            description="Rewrite Lambda function ARN"
        )
