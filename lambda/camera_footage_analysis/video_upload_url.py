import json
import boto3
import os
from datetime import datetime
import logging
import uuid
import mimetypes
import re

# configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME')
# sessionID validation helper function
def is_valid_session_id(session_id):
    """
    Valid sessionId example: session-20251119134654-450ca997
    Format: session-YYYYMMDDHHMMSS-XXXXXXXX
    """
    pattern = r'^session-\d{14}-[a-fA-F0-9]{8}$'
    return bool(re.match(pattern, session_id))


def handler(event, context):
    """
    Generate presigned URL for video upload
    
    POST /footage/upload-url
    Body: {
        "sessionId": "session-20251119134654-450ca997",
        "fileName": "surveillance_video.mp4"
    }
    """
    try:
        logger.info("=== Starting video upload URL generation ===")
        
        # parse request body
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId')
        file_name = body.get('fileName')
        
        logger.info(f"Parameters - sessionId: {session_id}, fileName: {file_name}")
        
        # validate field inputs
        if not session_id or not file_name:
            return error_response(400, 'sessionId and fileName are required')
    
        
        # validate sessionId format 
        if not is_valid_session_id(session_id):
            return error_response(400, 'Invalid sessionId format {session_id} (expected YYYY-INV-XXXX)')
        
        # extract video file extension 
        _, file_extension = os.path.splitext(file_name)
        file_extension = file_extension.lower()

        # fallback extension
        if not file_extension:
            file_extension = ".mp4"

        # detect mime type dynamically using Python's mimetypes library
        content_type = mimetypes.types_map.get(file_extension, "application/octet-stream")
        logger.info(f"Detected MIME type: {content_type}")   

        # generate descriptive file name with timestamp (with unique id to avoid collisions)
        unique_id = uuid.uuid4().hex[:12]  
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        safe_file_name = f"footage_{timestamp}_{unique_id}{file_extension}"
        
        # S3 key for uploaded video
        s3_key = f"camera-footage/videos/{safe_file_name}"

        
        logger.info(f"Generated S3 key: {s3_key}")
        
        # generate presigned URL (valid for 30 minutes)
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': 'video/mp4'
            },
            ExpiresIn=1800  # 30 minutes
        )
        
        logger.info("Successfully generated presigned URL for video upload")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,PUT',  
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'uploadUrl': presigned_url,
                's3Key': s3_key,
                'expiresIn': 1800,
                'message': 'Presigned URL generated successfully'
            })
        }
        
    except Exception as e:
        logger.error(f"Error generating video upload URL: {str(e)}", exc_info=True)
        return error_response(500, 'Failed to generate video upload URL')


def error_response(status_code, message):
    """Helper function to create error responses"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }