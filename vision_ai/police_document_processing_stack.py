# vision_ai/police_document_processing_stack.py
from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_iam as iam,
    Duration,
    CfnOutput,
)
from constructs import Construct

class PoliceDocumentProcessingStack(Stack):
    """
    Police Document Processing Stack (Requirement 0)
    
    Automatically extracts text from Arabic police PDF reports and generates
    structured summaries using Amazon Bedrock Nova Lite.
    """
    
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str,
        investigation_bucket: s3.IBucket, 
        env,  
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # ==========================================
        # LAMBDA: Process Police Documents
        # ==========================================
        process_police_doc_lambda = _lambda.Function(
            self, "ProcessPoliceDocumentFunction",
            function_name="vision-ai-process-police-document",
            runtime=_lambda.Runtime.PYTHON_3_11,
            handler="process_police_document.handler",
            code=_lambda.Code.from_asset("lambda/police_document_processing"),
            
            # ==========================================
            # LAYERS: Only PyMuPDF needed
            # ==========================================
            layers=[
                _lambda.LayerVersion.from_layer_version_arn(
                    self, "PyMuPDFLayer",
                    "arn:aws:lambda:us-east-1:770693421928:layer:Klayers-p311-PyMuPDF:10"
                )
            ],
            
            # ==========================================
            # CONFIGURATION
            # ==========================================
            timeout=Duration.seconds(120),  # 2 minutes sufficient for Nova Lite
            memory_size=1024,  # Reduced memory (Nova Lite is lighter)
            
            environment={
                "BUCKET_NAME": investigation_bucket.bucket_name,
                "BEDROCK_MODEL_ID": "amazon.nova-lite-v1:0",  # ✅ Nova Lite
            },
            description="Processes police PDFs and generates AI summaries via Bedrock Nova Lite"
        )
        
        # ==========================================
        # IAM PERMISSIONS
        # ==========================================
        
        # S3: Read PDFs from police-documents folder
        investigation_bucket.grant_read(
            process_police_doc_lambda,
            "cases/*/police-documents/*.pdf"
        )
        
        # S3: Write summaries to case root (both TXT and HTML)
        investigation_bucket.grant_write(
            process_police_doc_lambda,
            "cases/*/police-summary.*"
        )
        
        # Bedrock: Invoke Nova Lite model
        process_police_doc_lambda.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["bedrock:InvokeModel"],
                resources=[
                    f"arn:aws:bedrock:{Stack.of(self).region}::foundation-model/amazon.nova-lite-v1:0"
                ]
            )
        )
        
        # ==========================================
        # EXPOSE LAMBDA FOR S3 EVENT WIRING
        # ==========================================
        self.process_police_doc_lambda = process_police_doc_lambda
        
        # ==========================================
        # OUTPUTS
        # ==========================================
        CfnOutput(
            self, "ProcessPoliceDocLambdaName",
            value=process_police_doc_lambda.function_name,
            description="Name of police document processing Lambda function"
        )
        
        CfnOutput(
            self, "TriggerPath",
            value="cases/{caseId}/police-documents/*.pdf",
            description="S3 path pattern that triggers PDF processing"
        )
        
        CfnOutput(
            self, "OutputPath",
            value="cases/{caseId}/police-summary.txt and police-summary.html",
            description="S3 paths where summaries are saved (TXT and HTML)"
        )