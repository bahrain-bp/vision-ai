#!/usr/bin/env python3
import os
from dotenv import load_dotenv 
import aws_cdk as cdk
from vision_ai.cognito_stack import CognitoStack
from vision_ai.shared_infrastructure_stack import SharedInfrastructureStack
from vision_ai.identity_verification_stack import IdentityVerificationStack
from vision_ai.api_deployment_stack import APIDeploymentStack

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
    app, f"{app_name}-cognito-stack",
    app_name=app_name, env=env,
    description="Cognito User Pool for Login and Signup"
)

# ==========================================
# 2. SHARED INFRASTRUCTURE STACK
# S3 Bucket + API Gateway (not deployed)
# ==========================================
shared_stack = SharedInfrastructureStack(
    app, f"{app_name}-shared-infrastructure-stack", env=env,
    description="Shared resources: S3 bucket and API Gateway for all features"
)

# ==========================================
# 3. IDENTITY VERIFICATION STACK
# Uses shared API by ID 
# ==========================================
identity_stack = IdentityVerificationStack(
    app, f"{app_name}-identity-verification-stack", env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Identity verification: CPR extraction and face comparison"
)


# ==========================================
# 4. API DEPLOYMENT STACK
# Deploys API after all routes are added
# ==========================================
deployment_stack = APIDeploymentStack(
    app, f"{app_name}-api-deployment-stack", env=env,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="API Gateway deployment"
)

# Add tags
cdk.Tags.of(app).add("Project", "VisionAI")
cdk.Tags.of(app).add("ManagedBy", "CDK")

app.synth()