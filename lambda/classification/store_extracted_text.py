import json
import os
import logging
import uuid
from datetime import datetime

import boto3


logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
BUCKET_NAME = os.environ["BUCKET_NAME"]


def error_response(status_code, message):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST",
        },
        "body": json.dumps({"error": message}),
    }


def get_user_sub(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {}) or {}
    claims = authorizer.get("claims") or authorizer.get("jwt", {}).get("claims") or {}
    return claims.get("sub")


def handler(event, context):
    """
    Store extracted text from the classification flow into S3 as a .txt object.

    Expected body:
      { "sessionId": "...", "extracted_text": "..." }
    """
    try:
        caller_sub = get_user_sub(event)
        if not caller_sub:
            return error_response(401, "Unauthorized")

        body = json.loads(event.get("body", "{}"))
        session_id = body.get("sessionId")
        extracted_text = body.get("extracted_text")

        if not session_id or extracted_text is None:
            return error_response(400, "sessionId and extracted_text are required")

        safe_session = str(session_id).replace("/", "_")
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        unique_id = uuid.uuid4()
        key = f"classification/extracted/{caller_sub}/{safe_session}/{timestamp}-{unique_id}.txt"

        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=key,
            Body=extracted_text.encode("utf-8"),
            ContentType="text/plain; charset=utf-8",
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST",
            },
            "body": json.dumps({"key": key, "success": True}),
        }
    except Exception as e:
        logger.exception("Failed to store extracted text")
        return error_response(500, str(e))
