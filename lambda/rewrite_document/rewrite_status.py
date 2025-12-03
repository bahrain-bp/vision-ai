"""
Lambda 3: Rewrite Status Checker
Polls S3 to check if a rewrite job is complete and returns the result.
This is called by the frontend every 10 seconds.
"""

import json
import boto3
import os
import logging
from typing import Dict, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
s3_client = boto3.client("s3")

# Configuration
BUCKET_NAME = os.environ.get("BUCKET_NAME")


def create_response(status_code: int, body: Dict[str, Any]) -> Dict:
    """Return API Gateway compatible response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS"
        },
        "body": json.dumps(body, ensure_ascii=False)
    }


def get_job_status(job_id: str) -> Optional[Dict]:
    """Retrieve job status from S3."""
    try:
        status_key = f"rewrite-jobs/{job_id}/status.json"
        obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=status_key)
        status_data = json.loads(obj["Body"].read().decode("utf-8"))
        return status_data
    except s3_client.exceptions.NoSuchKey:
        logger.warning(f"Status file not found for job {job_id}")
        return None
    except Exception as e:
        logger.error(f"Error reading status for job {job_id}: {e}")
        raise


def get_result_text(job_id: str) -> Optional[str]:
    """Retrieve rewritten text from S3."""
    try:
        result_key = f"rewrite-jobs/{job_id}/result.txt"
        obj = s3_client.get_object(Bucket=BUCKET_NAME, Key=result_key)
        return obj["Body"].read().decode("utf-8")
    except s3_client.exceptions.NoSuchKey:
        logger.warning(f"Result file not found for job {job_id}")
        return None
    except Exception as e:
        logger.error(f"Error reading result for job {job_id}: {e}")
        raise


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict:
    """
    Main handler for status checker Lambda.
    
    Endpoint: GET /rewrite/status/{jobId}
    
    Returns:
    - PROCESSING: Job is still being processed
    - COMPLETED: Job completed successfully (includes rewritten text)
    - FAILED: Job failed (includes error message)
    - NOT_FOUND: Job ID not found
    """
    
    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return create_response(200, {"status": "ok"})
    
    try:
        # Extract job ID from path parameters
        path_params = event.get("pathParameters", {})
        job_id = path_params.get("jobId")
        
        if not job_id:
            logger.warning("No job ID provided in request")
            return create_response(400, {
                "error": "Job ID is required"
            })
        
        logger.info(f"📊 Checking status for job {job_id}")
        
        # Get job status from S3
        status_data = get_job_status(job_id)
        
        if not status_data:
            return create_response(404, {
                "status": "NOT_FOUND",
                "jobId": job_id,
                "message": "Job not found"
            })
        
        job_status = status_data.get("status")
        
        # If job is completed, fetch the result
        if job_status == "COMPLETED":
            result_text = get_result_text(job_id)
            
            if result_text:
                response_data = {
                    "status": "COMPLETED",
                    "jobId": job_id,
                    "rewrittenText": result_text,
                    "resultKey": status_data.get("resultKey"),
                    "resultLength": status_data.get("resultLength"),
                    "originalLength": status_data.get("originalLength"),
                    "model": status_data.get("model"),
                    "validationPassed": status_data.get("validationPassed", True),
                    "violations": status_data.get("violations", []),
                    "createdAt": status_data.get("createdAt"),
                    "updatedAt": status_data.get("updatedAt")
                }
                
                logger.info(f"✅ Job {job_id} completed - returning result")
                return create_response(200, response_data)
            else:
                # Status says completed but no result found
                logger.error(f"Job {job_id} marked as completed but result not found")
                return create_response(500, {
                    "status": "ERROR",
                    "jobId": job_id,
                    "error": "Result file not found despite job being marked as completed"
                })
        
        # If job failed, return error details
        elif job_status == "FAILED":
            response_data = {
                "status": "FAILED",
                "jobId": job_id,
                "error": status_data.get("error", "Unknown error"),
                "errorType": status_data.get("errorType"),
                "createdAt": status_data.get("createdAt"),
                "updatedAt": status_data.get("updatedAt")
            }
            
            logger.info(f"❌ Job {job_id} failed")
            return create_response(200, response_data)
        
        # Job still processing
        else:
            response_data = {
                "status": "PROCESSING",
                "jobId": job_id,
                "createdAt": status_data.get("createdAt"),
                "message": "Job is still being processed"
            }
            
            logger.info(f"🔄 Job {job_id} still processing")
            return create_response(200, response_data)
        
    except Exception as e:
        logger.error(f"❌ Error checking job status: {e}", exc_info=True)
        return create_response(500, {
            "status": "ERROR",
            "error": "Internal server error",
            "message": str(e)
        })
