import json
import boto3
import os
from datetime import datetime

# Connect to AWS services
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
s3 = boto3.client('s3', region_name='us-east-1')

def lambda_handler(event, context):
    """
    Main function - AWS calls this when API is triggered
    """
    try:
        # Get data from request
        body = json.loads(event['body'])
        report_text = body['report_text']
        user_id = body.get('user_id', 'test-user')
        case_id = body.get('case_id', 'CASE-001')
        session_id = body.get('session_id', 'SESSION-001')
        length = body.get('summary_length', 'medium')
        language = body.get('language', 'en')
        
        # Generate summary using Bedrock
        summary = generate_summary(report_text, length, language)
        
        # Save to S3
        summary_id = save_to_s3(summary, user_id, case_id, session_id)
        
        # Return response
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'summary': summary,
                'summary_id': summary_id,
                'case_id': case_id,
                'session_id': session_id,
                'user_id': user_id
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def generate_summary(text, length, language):
    """
    Call Bedrock Nova Lite to generate summary
    """
    prompt = f"Summarize this investigation transcript in {length} length in {language}:\n\n{text}"
    
    response = bedrock.invoke_model(
        modelId='amazon.nova-lite-v1:0',
        body=json.dumps({
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"maxTokens": 1000, "temperature": 0.3}
        })
    )
    
    result = json.loads(response['body'].read())
    return result['output']['message']['content'][0]['text']

def save_to_s3(summary, user_id, case_id, session_id):
    """
    Save summary to S3 bucket
    """
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    summary_id = f"{case_id}_{timestamp}"
    bucket = os.environ.get('BUCKET_NAME')
    key = f"summaries/{case_id}/{session_id}/{summary_id}.json"
    
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps({
            'summary': summary,
            'case_id': case_id,
            'session_id': session_id,
            'user_id': user_id,
            'created_at': str(datetime.now())
        })
    )
    
    return summary_id