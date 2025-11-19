import json
import boto3
import os
from datetime import datetime
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')
bucket_name = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Update case status (active/inactive)
    """
    # Handle CORS preflight OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return build_response(200, {})
    
    try:
        # Extract case ID from path parameters
        case_id = event.get('pathParameters', {}).get('caseId')
        
        if not case_id:
            return build_response(400, {
                'error': 'Case ID is required'
            })
        
        # Parse request body
        body = json.loads(event['body'])
        new_status = body.get('status')
        
        # Validate status
        if new_status not in ['active', 'inactive']:
            return build_response(400, {
                'error': 'Invalid status. Must be "active" or "inactive"'
            })
        
        # Get existing case data
        case_key = f"cases/{case_id}/case.json"
        try:
            response = s3_client.get_object(Bucket=bucket_name, Key=case_key)
            case_data = json.loads(response['Body'].read().decode('utf-8'))
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                return build_response(404, {
                    'error': f'Case {case_id} not found'
                })
            else:
                raise e
        
        # Update case status and lastUpdated
        case_data['status'] = new_status
        case_data['lastUpdated'] = datetime.utcnow().isoformat() + 'Z'
        
        # Save updated case data back to S3
        s3_client.put_object(
            Bucket=bucket_name,
            Key=case_key,
            Body=json.dumps(case_data, indent=2),
            ContentType='application/json'
        )
        
        print(f"Successfully updated case {case_id} status to {new_status}")
        
        return build_response(200, case_data)
        
    except Exception as e:
        print(f"Error updating case status: {str(e)}")
        return build_response(500, {
            'error': 'Failed to update case status',
            'details': str(e)
        })

def build_response(status_code, body):
    """Build standardized API response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, Content-Length',
            'Access-Control-Allow-Credentials': 'false',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }