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
from vision_ai.summarization_stack import SummarizationStack
from vision_ai.api_deployment_stack import APIDeploymentStack
from vision_ai.classification_stack import classificationStack
from vision_ai.transcription_stack import TranscriptionStack
from vision_ai.translation_stack import TranslationStack
from vision_ai.frontend_stack import FrontendStack
from vision_ai.detect_contradiction_stack import ContradictionStack
from vision_ai.camera_footage_stack import CameraFootageAnalysisStack
from vision_ai.audio_analysis_stack import AudioAnalysisStack
from vision_ai.outcome_stack import OutcomeStack
from vision_ai.police_document_processing_stack import PoliceDocumentProcessingStack
from vision_ai.s3_event_wiring_stack import S3EventWiringStack
from vision_ai.AI_Assistant_RT_stack import AIAssistantRTStack


load_dotenv()
app = cdk.App()

# Validate required environment variables
required_vars = {
    "AWS_ACCOUNT_ID": os.getenv("AWS_ACCOUNT_ID"),
    "AWS_REGION": os.getenv("AWS_REGION"),
    "INVESTIGATION_BUCKET_NAME": os.getenv("INVESTIGATION_BUCKET_NAME"),
}

missing_vars = [var for var, value in required_vars.items() if not value]
if missing_vars:
    print(f"ERROR: Missing required environment variables: {', '.join(missing_vars)}")
    print("Please check your .env file")
    sys.exit(1)

# Environment configuration
env = cdk.Environment(
    account=required_vars["AWS_ACCOUNT_ID"], region=required_vars["AWS_REGION"]
)

app_name = "vision-ai"
environment = app.node.try_get_context("environment") or "prod"
# ==========================================
# 1. COGNITO STACK - Authentication
# ==========================================
cognito_stack = CognitoStack(
    app,
    f"{app_name}-cognito-stack",
    app_name=app_name,
    env=env,
    description="Cognito User Pool for Login and Signup",
)

# ==========================================
# 2. SHARED INFRASTRUCTURE STACK
# S3 Bucket + API Gateway (not deployed)
# ==========================================
shared_stack = SharedInfrastructureStack(
    app,
    f"{app_name}-shared-infrastructure-stack",
    env=env,
    bucket_name=required_vars["INVESTIGATION_BUCKET_NAME"],
    description="Shared resources: S3 bucket and API Gateway for all features",
)

# ==========================================
# 3. IDENTITY VERIFICATION STACK
# Deploy FIRST to create /identity routes
# ==========================================
identity_stack = IdentityVerificationStack(
    app,
    f"{app_name}-identity-verification-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Identity verification: CPR extraction, name extraction, and face comparison with CloudWatch logging",
)

# Ensure identity stack depends on shared stack
identity_stack.add_dependency(shared_stack)

# ==========================================
# 4. CASE MANAGEMENT STACK
# Deploy AFTER identity stack to create /cases routes
# ==========================================
case_management_stack = CaseManagementStack(
    app,
    f"{app_name}-case-management-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Case management: create cases, display cases, and create sessions",
)

# Ensure case management depends on identity stack
case_management_stack.add_dependency(shared_stack)
case_management_stack.add_dependency(identity_stack)

# ==========================================
# 5. ADVANCED ANALYSIS STACK
# AI Suggested Questions feature
# ==========================================
advanced_analysis_stack = AdvancedAnalysisStack(
    app,
    f"{app_name}-advanced-analysis-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Advanced Analysis: AI suggested questions and analysis",
)
advanced_analysis_stack.add_dependency(shared_stack)

# ==========================================
# 6. CLASSIFICATION STACK
# extract text from document and classify the case
# ==========================================
classification_stack = classificationStack(
    app,
    f"{app_name}-classification-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Classification Stack: Document upload to extract text and classify",
)
classification_stack.add_dependency(shared_stack)

# ==========================================
# 7. REWRITE STACK
# Document rewriting with AWS Bedrock
# ==========================================
rewrite_stack = RewriteStack(
    app,
    f"{app_name}-rewrite-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Rewrite Stack: Document rewriting using AWS Bedrock Nova Lite",
)
rewrite_stack.add_dependency(shared_stack)

# ==========================================
# 8. TRANSCRIPTION STACK
# ==========================================
transcription_stack = TranscriptionStack(
    app,
    f"{app_name}-transcription-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Transcription Stack: Save live transcriptions",
)
transcription_stack.add_dependency(shared_stack)

# ==========================================
# POLICE DOCUMENT PROCESSING STACK
# PDF summarization using Bedrock Nova Lite
# ==========================================
police_doc_stack = PoliceDocumentProcessingStack(
    app, f"{app_name}-police-document-processing-stack",
    investigation_bucket=shared_stack.investigation_bucket,
    env=env,
    description="Police Document Processing: Automated PDF summarization using Amazon Bedrock"
)
police_doc_stack.add_dependency(shared_stack)

# ==========================================
# S3 EVENT WIRING STACK
# Configures S3 → Lambda event notifications
# ==========================================
s3_wiring_stack = S3EventWiringStack(
    app, f"{app_name}-s3-event-wiring-stack",
    env=env,
    investigation_bucket_name="vision-rt-investigation-system",  
    police_doc_lambda_name="vision-ai-process-police-document", 
    description="S3 event notifications: Triggers Lambda on PDF uploads"
)
s3_wiring_stack.add_dependency(shared_stack)
s3_wiring_stack.add_dependency(police_doc_stack)

# ==========================================
# AI ASSISTANT RT STACK
# Real-time question generation support
# ==========================================
ai_assistant_rt_stack = AIAssistantRTStack(
    app, f"{app_name}-ai-assistant-rt-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    cases_resource_id=case_management_stack.cases_resource.resource_id,
    case_by_id_resource_id=case_management_stack.case_by_id_resource.resource_id,
    description="AI Assistant RT: Question generation with case summary and victim testimony"
)
ai_assistant_rt_stack.add_dependency(shared_stack)

# ==========================================
# 9. TRANSLATION STACK
# Save real-time translations to S3
# ==========================================
translation_stack = TranslationStack(
    app,
    f"{app_name}-translation-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Translation Stack: Save real-time translations to S3",
)
translation_stack.add_dependency(shared_stack)


# ==========================================
# 10. SUMMARIZATION STACK
# AI Report Summarization with Bedrock
# ==========================================
summarization_stack = SummarizationStack(
    app,
    f"{app_name}-summarization-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Summarization Stack: AI report summarization using AWS Bedrock Nova Lite",
)

# Ensure summarization stack depends on shared stack
summarization_stack.add_dependency(shared_stack)


# ==========================================
# 10. Detect Contradiction STACK
# ==========================================
detect_contradiction_stack = ContradictionStack(
    app,
    f"{app_name}-detect-contradiction-stack",
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    env=env,
    description="Detect Contradiction using 2 Lambda and AWS Bedrock Nova Lite",
)
detect_contradiction_stack.add_dependency(shared_stack)

# ==========================================
# 11. CAMERA FOOTAGE ANALYSIS STACK
# Uses shared API by ID
# ==========================================
camera_footage_stack = CameraFootageAnalysisStack(
    app,
    f"{app_name}-camera-footage-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Camera Footage Analysis: Video upload and Bedrock analysis integration",
)

# Ensure camera footage stack depends on shared stack
camera_footage_stack.add_dependency(shared_stack)

# ==========================================
# 12. AUDIO ANALYSIS STACK
# ==========================================
audio_analysis_stack = AudioAnalysisStack(
    app,
    f"{app_name}-audio-analysis-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Audio Analysis: Transcribe and translate audio to Arabic",
)
audio_analysis_stack.add_dependency(shared_stack)

# ==========================================
# 13. OUTCOME STACK
# ==========================================
outcome_stack = OutcomeStack(
    app,
    f"{app_name}-outcome-stack",
    env=env,
    investigation_bucket=shared_stack.investigation_bucket,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="Outcome: Generate confidence score and verdict with rationale",
)
outcome_stack.add_dependency(shared_stack)

# ==========================================
# 14. API DEPLOYMENT STACK
# Deploys API after all routes are added
# ==========================================
deployment_stack = APIDeploymentStack(
    app,
    f"{app_name}-api-deployment-stack",
    env=env,
    shared_api_id=shared_stack.shared_api.rest_api_id,
    shared_api_root_resource_id=shared_stack.shared_api.rest_api_root_resource_id,
    description="API Gateway deployment with CloudWatch logging enabled",
)

# Ensure deployment happens after all feature stacks
deployment_stack.add_dependency(identity_stack)

deployment_stack.add_dependency(case_management_stack)

deployment_stack.add_dependency(advanced_analysis_stack)
deployment_stack.add_dependency(rewrite_stack)
deployment_stack.add_dependency(classification_stack)
deployment_stack.add_dependency(detect_contradiction_stack)
deployment_stack.add_dependency(transcription_stack)
deployment_stack.add_dependency(translation_stack)
deployment_stack.add_dependency(summarization_stack)
deployment_stack.add_dependency(camera_footage_stack)
deployment_stack.add_dependency(audio_analysis_stack)
deployment_stack.add_dependency(outcome_stack)
deployment_stack.add_dependency(police_doc_stack)
deployment_stack.add_dependency(s3_wiring_stack)
deployment_stack.add_dependency(ai_assistant_rt_stack)

# ==========================================
# 15. FRONTEND STACK
# CloudFront + S3 for React Frontend
# ==========================================
frontend_stack = FrontendStack(
    app,
    f"{app_name}-frontend-stack",
    environment=environment,
    env=env,
    description="CloudFront distribution and S3 bucket for React frontend with OAC security",
)


# Add tags
cdk.Tags.of(app).add("Project", "VisionAI")
cdk.Tags.of(app).add("ManagedBy", "CDK")
cdk.Tags.of(app).add("Environment", "Production")

app.synth()
