"""
Lambda 1: Rewrite Initiator
Receives rewrite requests from API Gateway, invokes the worker Lambda asynchronously,
and immediately returns a job ID to the client.
"""

import json
import boto3
import os
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
lambda_client = boto3.client("lambda")
s3_client = boto3.client("s3")

# Configuration
WORKER_LAMBDA_ARN = os.environ.get("WORKER_LAMBDA_ARN")
BUCKET_NAME = os.environ.get("BUCKET_NAME")


def create_response(status_code: int, body: Dict[str, Any]) -> Dict:
    """Return API Gateway compatible response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body, ensure_ascii=False)
    }


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    """
    Main handler for rewrite initiator Lambda.
    
    1. Generates a unique job ID
    2. Creates initial status file in S3
    3. Invokes worker Lambda asynchronously
    4. Returns job ID immediately to client
    """
    
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return create_response(200, {"status": "ok"})
    
    try:
        # Parse request body
        body = {}
        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except Exception as e:
                logger.error(f"Failed to parse request body: {e}")
                return create_response(400, {
                    "error": "Invalid JSON in request body"
                })
        
        # Validate required fields
        text = body.get("text")
        s3_key = body.get("s3Key")
        
        if not text and not s3_key:
            return create_response(400, {
                "error": "Either 'text' or 's3Key' must be provided"
            })
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        session_id = body.get("sessionId", "unknown")
        language = body.get("language", "ar")  # Default to Arabic
        
        logger.info(f"≡ƒô¥ Starting rewrite job {job_id} for session {session_id} in {language}")
        
        # Create initial status in S3
        status_key = f"rewrite-jobs/{job_id}/status.json"
        initial_status = {
            "jobId": job_id,
            "status": "PROCESSING",
            "createdAt": datetime.utcnow().isoformat(),
            "sessionId": session_id
        }
        
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=status_key,
            Body=json.dumps(initial_status, ensure_ascii=False),
            ContentType="application/json"
        )
        
        # Prepare payload for worker Lambda
        worker_payload = {
            "jobId": job_id,
            "text": text,
            "s3Key": s3_key,
            "sessionId": session_id,
            "language": language
        }
        
        # Invoke worker Lambda asynchronously
        lambda_client.invoke(
            FunctionName=WORKER_LAMBDA_ARN,
            InvocationType="Event",  # Async invocation
            Payload=json.dumps(worker_payload)
        )
        
        logger.info(f"Γ£à Worker Lambda invoked for job {job_id}")
        
        # Return job ID immediately
        return create_response(200, {
            "jobId": job_id,
            "status": "PROCESSING",
            "message": "Rewrite job started successfully"
        })
        
    except Exception as e:
        logger.error(f"Γ¥î Error in initiator Lambda: {e}", exc_info=True)
        return create_response(500, {
            "error": "Internal server error",
            "message": str(e)
        })
