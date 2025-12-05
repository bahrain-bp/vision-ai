import json
import boto3
import os
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Generate presigned URL for audio upload
    Input: { "fileName": "audio.mp3", "fileType": "audio/mpeg" }
    Output: { "uploadUrl": "...", "key": "..." }
    """
    try:
        logger.info("=== Starting audio upload URL generation ===")
        
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName', 'audio.mp3')
        file_type = body.get('fileType', 'audio/mpeg')
        
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        key = f"audio/uploads/{timestamp}-{file_name}"
        
        logger.info(f"Generated S3 key: {key}")
        
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': key,
                'ContentType': file_type
            },
            ExpiresIn=600
        )
        
        logger.info("Successfully generated presigned URL")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'uploadUrl': presigned_url,
                's3Key': key,
                'bucket': BUCKET_NAME,
                'expiresIn': 600
            })
        }
    
    except Exception as e:
        logger.error(f"Error generating upload URL: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
