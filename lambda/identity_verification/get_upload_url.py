import json
import boto3
import os
from datetime import datetime
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Generate presigned URL for document or photo upload
    
    POST /identity/upload-url
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "fileType": "image/jpeg",
        "fileName": "citizen-id.jpg",
        "uploadType": "document",  # or "witness", "accused", "victim"
        "personType": "witness"  # Required for photo uploads: "witness", "accused", or "victim"
    }
    """
    try:
        logger.info("=== Starting upload URL generation ===")
        logger.info(f"Request event: {json.dumps(event, default=str)}")
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        file_type = body.get('fileType', 'image/jpeg')
        file_name = body.get('fileName', 'document.jpg')
        upload_type = body.get('uploadType', 'document')
        person_type = body.get('personType')  # witness, accused, or victim
        
        logger.info(f"Parameters - caseId: {case_id}, sessionId: {session_id}, uploadType: {upload_type}, personType: {person_type}")
        
        # Validate inputs
        if not case_id or not session_id:
            logger.error("Missing required fields: caseId or sessionId")
            return error_response(400, 'caseId and sessionId are required')
        
        # Validate uploadType
        valid_upload_types = ['document', 'witness', 'accused', 'victim']
        if upload_type not in valid_upload_types:
            logger.error(f"Invalid uploadType: {upload_type}")
            return error_response(
                400, 
                f'uploadType must be one of: {", ".join(valid_upload_types)}'
            )
        
        # For photo uploads, validate personType
        if upload_type in ['witness', 'accused', 'victim']:
            if not person_type or person_type not in ['witness', 'accused', 'victim']:
                logger.error(f"Invalid or missing personType for photo upload: {person_type}")
                return error_response(
                    400, 
                    'personType must be specified as "witness", "accused", or "victim" for photo uploads'
                )
        
        # Generate descriptive file name based on upload type
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        file_extension = os.path.splitext(file_name)[1] or '.jpg'
        
        # S3 key for uploaded file - different paths based on upload type
        if upload_type == 'document':
           
            safe_file_name = f"citizen-id-document_{timestamp}{file_extension}"
            s3_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/documents/{safe_file_name}"
        else:
          
            safe_file_name = f"{person_type}-photo_{timestamp}{file_extension}"
            s3_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/photos/{safe_file_name}"
        
        logger.info(f"Generated S3 key: {s3_key}")
        
        # Generate presigned URL (valid for 10 minutes)
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': file_type
            },
            ExpiresIn=600  # 10 minutes
        )
        
        logger.info(f"Successfully generated presigned URL for {upload_type} upload")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'uploadUrl': presigned_url,
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


def error_response(status_code, message, additional_data=None):
    """Helper function to create error responses"""
    body = {'error': message}
    if additional_data:
        body.update(additional_data)
    
    logger.error(f"Returning error response: {status_code} - {message}")
    
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }