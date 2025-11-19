#!/usr/bin/env python3
import os
import sys
from dotenv import load_dotenv 
import aws_cdk as cdk
from vision_ai.cognito_stack import CognitoStack
from vision_ai.shared_infrastructure_stack import SharedInfrastructureStack
from vision_ai.case_management_stack import CaseManagementStack  
from vision_ai.identity_verification_stack import IdentityVerificationStack
from vision_ai.advanced_analysis_stack import AdvancedAnalysisStack
from vision_ai.rewrite_stack import RewriteStack
from vision_ai.api_deployment_stack import APIDeploymentStack

load_dotenv()
app = cdk.App()

# Validate required environment variables 
required_vars = {
    'AWS_ACCOUNT_ID': os.getenv('AWS_ACCOUNT_ID'),
    'AWS_REGION': os.getenv('AWS_REGION')
}

missing_vars = [var for var, value in required_vars.items() if not value]
if missing_vars:
    print(f"ERROR: Missing required environment variables: {', '.join(missing_vars)}")
    print("Please check your .env file")
    sys.exit(1)

# Environment configuration 
env = cdk.Environment(
    account=required_vars['AWS_ACCOUNT_ID'], 
    region=required_vars['AWS_REGION']
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
# 3. CASE MANAGEMENT STACK 
# Handles case creation, display, and session creation
# ==========================================
case_management_stack = CaseManagementStack(
    app, f"{app_name}-case-management-stack", env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Case management: create cases, display cases, and create sessions"
)

# Ensure case management depends on shared stack
case_management_stack.add_dependency(shared_stack)

# ==========================================
# 4. IDENTITY VERIFICATION STACK
# Uses shared API by ID 
# ==========================================
identity_stack = IdentityVerificationStack(
    app, f"{app_name}-identity-verification-stack", env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Identity verification: CPR extraction, name extraction, and face comparison with CloudWatch logging"
)

# Ensure identity stack depends on case management stack
identity_stack.add_dependency(case_management_stack)

# ==========================================

# 4. ADVANCED ANALYSIS STACK
# AI Suggested Questions feature
# ==========================================
advanced_analysis_stack = AdvancedAnalysisStack(
    app, f"{app_name}-advanced-analysis-stack", env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Advanced Analysis: AI suggested questions and analysis"
)

# Ensure advanced analysis stack depends on shared stack
advanced_analysis_stack.add_dependency(shared_stack)

# ==========================================
# 5. REWRITE STACK
# Document rewriting with AWS Bedrock
# ==========================================
rewrite_stack = RewriteStack(
    app, f"{app_name}-rewrite-stack", env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Rewrite Stack: Document rewriting using AWS Bedrock Nova Lite"
)

# Ensure rewrite stack depends on shared stack
rewrite_stack.add_dependency(shared_stack)

# ==========================================
# 6. API DEPLOYMENT STACK
# Deploys API after all routes are added
# ==========================================
deployment_stack = APIDeploymentStack(
    app, f"{app_name}-api-deployment-stack", env=env,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="API Gateway deployment with CloudWatch logging enabled"
)

# Ensure deployment happens after all feature stacks
deployment_stack.add_dependency(identity_stack)
deployment_stack.add_dependency(advanced_analysis_stack)
deployment_stack.add_dependency(rewrite_stack)

# Add tags
cdk.Tags.of(app).add("Project", "VisionAI")
cdk.Tags.of(app).add("ManagedBy", "CDK")
cdk.Tags.of(app).add("Environment", "Production")

app.synth()