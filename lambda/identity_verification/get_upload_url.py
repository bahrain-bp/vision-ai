import json
import boto3
import re
import os
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    try:
        logger.info("=== Starting upload URL generation ===")
        logger.info(f"Request event: {json.dumps(event, default=str)}")

        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        file_type = body.get('fileType', 'image/jpeg')
        file_name = body.get('fileName', 'document.jpg')
        upload_type = body.get('uploadType', 'document')
        person_type = body.get('personType')

        logger.info(f"Parameters - caseId: {case_id}, sessionId: {session_id}, uploadType: {upload_type}, personType: {person_type}")

        if not case_id or not session_id:
            logger.error("Missing required fields: caseId or sessionId")
            return error_response(400, 'caseId and sessionId are required')
        

        valid_upload_types = ['document', 'witness', 'accused', 'victim']
        if upload_type not in valid_upload_types:
            logger.error(f"Invalid uploadType: {upload_type}")
            return error_response(400, f'uploadType must be one of: {", ".join(valid_upload_types)}')

        if upload_type in ['witness', 'accused', 'victim']:
            if not person_type or person_type not in ['witness', 'accused', 'victim']:
                logger.error(f"Invalid or missing personType for photo upload: {person_type}")
                return error_response(400, 'personType must be specified as "witness", "accused", or "victim" for photo uploads')


        file_extension = os.path.splitext(file_name)[1] or '.jpg'
        allowed_extensions = ['.jpg', '.jpeg', '.png']
        if file_extension.lower() not in allowed_extensions:
            logger.error(f"Invalid file extension uploaded: {file_extension}")
            return error_response(400, f'Invalid file extension. Allowed: {", ".join(allowed_extensions)}')

        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')

        if upload_type == 'document':
            safe_file_name = f"citizen-id-document_{timestamp}{file_extension}"
            s3_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/documents/{safe_file_name}"
        else:
            safe_file_name = f"{person_type}-photo_{timestamp}{file_extension}"
            s3_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/photos/{safe_file_name}"

        logger.info(f"Generated S3 key: {s3_key}")

        presigned_post = s3.generate_presigned_post(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Fields={'Content-Type': file_type},
            Conditions=[
                {'Content-Type': file_type},
                ['content-length-range', 0, 10485760]  # 10MB limit
            ],
            ExpiresIn=600
        )

        # Extract the URL and fields
        upload_url = presigned_post['url']
        upload_fields = presigned_post['fields']

        logger.info(f"Successfully generated presigned URL for {upload_type} upload")

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({
                'uploadUrl': upload_url,
                'uploadFields': upload_fields,
                's3Key': s3_key,
                'bucket': BUCKET_NAME,
                'uploadType': upload_type,
                'personType': person_type,
                'expiresIn': 600
            })
        }
    except Exception as e:
        logger.error(f"✗ Error generating upload URL: {str(e)}", exc_info=True)
        return error_response(500, 'Failed to generate upload URL', {'details': str(e)})


    
    # For case IDs: CASE-202512-A525ED1B format
    if field_name == 'caseId':
        if not re.match(r'^CASE-\d{6}-[A-F0-9]{8}$', value):
            logger.error(f"Invalid {field_name} format: {value}")
            return False
    
    # For session IDs: session-20241207123456-a1b2c3d4 format
    elif field_name == 'sessionId':
        if not re.match(r'^session-\d{14}-[a-fA-F0-9]{8}$', value):
            logger.error(f"Invalid {field_name} format: {value}")
            return False
    
    # For any other IDs: allow alphanumeric, hyphens, underscores
    else:
        if not re.match(r'^[a-zA-Z0-9_-]+$', value):
            logger.error(f"Invalid {field_name} format: {value}")
            return False
    
    # Always prevent path traversal
    if '..' in value or '/' in value or '\\' in value:
        logger.error(f"Path traversal attempt in {field_name}: {value}")
        return False
    
    return True


def error_response(status_code, message, additional_data=None):
    body = {'error': message}
    if additional_data:
        body.update(additional_data)
    logger.error(f"Returning error response: {status_code} - {message}")
    return {'statusCode': status_code, 'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, 'body': json.dumps(body)}