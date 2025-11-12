import json
import uuid
import boto3
import os

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    try:
        #Parse the body
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName', 'document.pdf')
        file_type = body.get('fileType', 'application/pdf')

        
        #Generate unique s3 key
        unique_id = str(uuid.uuid4())
        unique_key = f"classification/uploads/{unique_id}_{file_name}"

        url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key,
                'ContentType': file_type
            },
            ExpiresIn=900
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "uploadUrl": url,
                "key": unique_key,
                })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
