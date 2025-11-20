from datetime import datetime 
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
        file_type = body.get('contentType', 'application/pdf')

        
        #Generate unique s3 key
        unique_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        unique_key = f"classification/upload/{unique_id}_{timestamp}_{file_name}"

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
                "Access-Control-Allow-Origin": "http://localhost:3000",
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
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST"
            },
            "body": json.dumps({"error": str(e)})
        }

