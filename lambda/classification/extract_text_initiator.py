import json
import os
import uuid
import boto3
from urllib.parse import unquote_plus

lambda_client = boto3.client("lambda")
s3 = boto3.client("s3")

WORKER_FUNCTION_NAME = os.environ["WORKER_FUNCTION_NAME"]
BUCKET_NAME = os.environ["BUCKET_NAME"]


def handler(event, context):
    """
    Initiates an async extraction job.
    Input: { "key": "...", "sessionId": "..." }
    Output: { "jobId": "..." }
    """
    try:
        body = json.loads(event.get("body", "{}"))
        s3_key = unquote_plus(body["key"])
        session_id = body.get("sessionId")

        if not session_id or not s3_key:
            return error_response("sessionId and key are required", 400)

        # Generate unique job ID
        job_id = str(uuid.uuid4())

        # Store initial job status in S3
        status_key = f"classification/jobs/{job_id}/status.json"
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=status_key,
            Body=json.dumps({
                "status": "PROCESSING",
                "sessionId": session_id,
                "s3Key": s3_key,
            }),
            ContentType="application/json"
        )

        # Invoke worker asynchronously
        lambda_client.invoke(
            FunctionName=WORKER_FUNCTION_NAME,
            InvocationType="Event",  # Async
            Payload=json.dumps({"jobId": job_id, "key": s3_key, "sessionId": session_id}),
        )

        return {
            "statusCode": 202,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "POST,OPTIONS"
            },
            "body": json.dumps({"jobId": job_id}),
        }

    except Exception as e:
        return error_response(str(e), 500)


def error_response(message, status):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps({"error": message}),
    }
