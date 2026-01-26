import json
import os
import boto3
from botocore.exceptions import ClientError

s3 = boto3.client("s3")
BUCKET_NAME = os.environ["BUCKET_NAME"]


def handler(event, context):
    """
    Check job status from S3.
    Query param: jobId
    Returns: { "status": "PROCESSING|COMPLETED|FAILED", "extractedText": "...", "error": "..." }
    """
    try:
        job_id = event.get("queryStringParameters", {}).get("jobId")
        
        if not job_id:
            return error_response("jobId query parameter is required", 400)

        status_key = f"classification/jobs/{job_id}/status.json"
        
        try:
            response = s3.get_object(Bucket=BUCKET_NAME, Key=status_key)
            status_data = json.loads(response["Body"].read().decode("utf-8"))
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                return error_response("Job not found", 404)
            raise

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "*"
            },
            "body": json.dumps(status_data, ensure_ascii=False),
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
            "Access-Control-Allow-Methods": "*"
        },
        "body": json.dumps({"error": message}),
    }
