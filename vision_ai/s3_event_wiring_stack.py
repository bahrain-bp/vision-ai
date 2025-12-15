# vision_ai/s3_event_wiring_stack.py

from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_lambda as _lambda,
    aws_s3_notifications as s3n,
)
from constructs import Construct

class S3EventWiringStack(Stack):
    """
    S3 Event Wiring Stack
    
    Configures S3 event notifications to trigger Lambda functions.
    This stack is separate to avoid cyclic dependencies.
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        investigation_bucket_name: str,  
        police_doc_lambda_name: str,     
        env,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, env=env, **kwargs)
        
        # Import S3 bucket by name
        investigation_bucket = s3.Bucket.from_bucket_name(
            self, "InvestigationBucket",
            investigation_bucket_name
        )
        
        # Import Lambda by function name
        police_doc_lambda = _lambda.Function.from_function_name(
            self, "PoliceDocLambda",
            police_doc_lambda_name
        )
        
        # ==========================================
        # S3 EVENT NOTIFICATION: Police Document Processing
        # ==========================================
        investigation_bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED,
            s3n.LambdaDestination(police_doc_lambda),
            s3.NotificationKeyFilter(
                prefix="cases/",
                suffix=".pdf"
            )
        )