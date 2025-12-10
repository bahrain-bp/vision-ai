import json
import boto3
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
lambda_client = boto3.client('lambda')

BUCKET_NAME = os.environ['BUCKET_NAME']
PROCESSOR_FUNCTION_NAME = os.environ['PROCESSOR_FUNCTION_NAME']

def handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        s3_key = body.get('key')
        
        if not s3_key:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'key is required'})
            }
        
        result_key = f"{s3_key}.result.json"
        
        # Write PROCESSING status
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=result_key,
            Body=json.dumps({'status': 'PROCESSING'}),
            ContentType='application/json'
        )
        
        # Invoke processor async
        lambda_client.invoke(
            FunctionName=PROCESSOR_FUNCTION_NAME,
            InvocationType='Event',
            Payload=json.dumps({'s3Key': s3_key, 'resultKey': result_key})
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'status': 'PROCESSING',
                'resultKey': result_key
            })
        }
    
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
