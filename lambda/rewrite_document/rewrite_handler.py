import json
import boto3
import os
from datetime import datetime

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
s3 = boto3.client('s3')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'vision-investigation-system-052804446370')
MODEL_ID = 'amazon.nova-lite-v1:0'

def lambda_handler(event, context):
    try:
        body = json.loads(event['body'])
        document_text = body.get('document_text', '')
        
        if not document_text:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'document_text is required'})
            }
        
        prompt = f"""Enhance this investigation report by improving clarity, structure, and professional presentation while maintaining all factual information:

{document_text}

Provide the enhanced version:"""
        
        request_body = {
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"maxTokens": 4096, "temperature": 0.3}
        }
        
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        rewritten_text = response_body['output']['message']['content'][0]['text']
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        s3_key = f"rewritten/{timestamp}_report.txt"
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=rewritten_text.encode('utf-8'),
            ContentType='text/plain'
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'rewritten_text': rewritten_text,
                's3_location': f"s3://{BUCKET_NAME}/{s3_key}"
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
