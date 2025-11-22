from datetime import datetime 
import json
import uuid
import boto3
import os
import logging

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def error_response(status_code, message):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }

def get_user_sub(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {}) or {}
    claims = authorizer.get("claims") or authorizer.get("jwt", {}).get("claims") or {}
    return claims.get("sub")

def handler(event, context):
    try:
        caller_sub = get_user_sub(event)
        if not caller_sub:
            return error_response(401, 'Unauthorized')
        #Parse the body
        body = json.loads(event.get('body', '{}'))
        sessionId = body.get('sessionId')
        file_name = body.get('fileName')
        file_type = body.get('fileType')

        if not sessionId or not file_name or not file_type:
            return error_response(400, 'sessionId, fileName and fileType are required')


        safe_session = str(sessionId).replace("/", "_")
        #Generate unique s3 key
        unique_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        unique_key = f"classification/upload/{caller_sub}/{safe_session}/{timestamp}-{unique_id}-{file_name}"

        logger.info("Generating upload URL for %s", unique_key)

        url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key,
                'ContentType': file_type
            },
            ExpiresIn=900 #30 minuts
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": json.dumps({
                "uploadUrl": url,
                "key": unique_key,
                "sucess": True,
                "expireIn": 900
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": json.dumps({"error": str(e)})
        }

