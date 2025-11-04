#!/usr/bin/env python3
import os
from dotenv import load_dotenv 
import aws_cdk as cdk
from vision_ai.cognito_stack import CognitoStack
from vision_ai.shared_infrastructure_stack import SharedInfrastructureStack


load_dotenv()

app = cdk.App()

# Environment configuration
env = cdk.Environment(
    account="128663321866", 
    region="us-east-1" 
)

app_name = "vision-ai"

# ==========================================
# 1. COGNITO STACK - Authentication
# ==========================================
cognito_stack = CognitoStack(
    app,
    f"{app_name}-cognito-stack",
    app_name=app_name,
    env=env,
    description="Cognito User Pool for Login and Signup"
)

# ==========================================
# 2. SHARED INFRASTRUCTURE STACK
# S3 Bucket + API Gateway
# ==========================================
shared_stack = SharedInfrastructureStack(
    app,
    f"{app_name}-shared-infrastructure-stack",
    env=env,
    description="Shared resources: S3 bucket and API Gateway for all features"
)



# Add tags
cdk.Tags.of(app).add("Project", "VisionAI")
cdk.Tags.of(app).add("ManagedBy", "CDK")

app.synth()