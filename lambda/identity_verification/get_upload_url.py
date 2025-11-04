import json
import boto3
import os
from datetime import datetime
import uuid

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Generate presigned URL for document upload
    
    POST /identity/upload-url
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "fileType": "image/jpeg",
        "fileName": "citizen-id.jpg"
    }
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        file_type = body.get('fileType', 'image/jpeg')
        file_name = body.get('fileName', 'document.jpg')
        
        # Validate inputs
        if not case_id or not session_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'caseId and sessionId are required'
                })
            }
        
        # Generate unique file name to avoid collisions
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        safe_file_name = f"{timestamp}_{unique_id}_{file_name}"
        
        # S3 key for uploaded document
        s3_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/documents/uploaded/{safe_file_name}"
        
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
                'expiresIn': 600
            })
        }
        
    except Exception as e:
        print(f"Error generating upload URL: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to generate upload URL',
                'details': str(e)
            })
        }