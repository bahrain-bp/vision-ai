#!/usr/bin/env python3
import os
import aws_cdk as cdk
from vision_ai.cognito_stack import CognitoStack

# for testing only hhhhhh -------------
app = cdk.App()

# Environment configuration
env = cdk.Environment(
    account=os.getenv('CDK_DEFAULT_ACCOUNT'),
    region=os.getenv('CDK_DEFAULT_REGION', 'us-east-1')
)

app_name = "vision-ai"

# Create Cognito Stack for Login/Signup
cognito_stack = CognitoStack(
    app,
    f"{app_name}-cognito-stack",
    app_name=app_name,
    env=env,
    description="Cognito User Pool for Login and Signup"
)

# Add tags
cdk.Tags.of(app).add("Project", "VisionAI")
cdk.Tags.of(app).add("ManagedBy", "CDK")

app.synth()