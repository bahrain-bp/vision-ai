import json
import boto3
import os
import uuid
from datetime import datetime

s3_client = boto3.client('s3')
bucket_name = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Create a new case
    """
    try:
        # Parse request body
        body = json.loads(event['body'])
        
        case_title = body.get('caseTitle')
        case_description = body.get('caseDescription')
        created_by = body.get('createdBy')
        
        # Validate required fields
        if not all([case_title, created_by]):
            return build_response(400, {
                'error': 'Missing required fields: caseTitle, createdBy'
            })
        
        # Generate unique case ID 
        case_id = generate_case_id()
        
        # Create case object
        case_data = {
            'caseId': case_id,
            'caseTitle': case_title,
            'caseDescription': case_description or '',
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'createdBy': created_by,
            'status': 'active',
            'totalSessions': 0,
            'lastUpdated': datetime.utcnow().isoformat() + 'Z'
        }
        
        # Save to S3
        case_key = f"cases/{case_id}/case.json"
        s3_client.put_object(
            Bucket=bucket_name,
            Key=case_key,
            Body=json.dumps(case_data, indent=2),
            ContentType='application/json'
        )
        
        print(f"Successfully created case: {case_id}")
        
        return build_response(201, case_data)
        
    except Exception as e:
        print(f"Error creating case: {str(e)}")
        return build_response(500, {
            'error': 'Failed to create case',
            'details': str(e)
        })

def generate_case_id():
    """Generate a unique case ID"""
    year = datetime.utcnow().year
    month = str(datetime.utcnow().month).zfill(2)
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"CASE-{year}{month}-{unique_id}"

def build_response(status_code, body):
    """Build standardized API response with CORS headers"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, Content-Length',
            'Access-Control-Allow-Credentials': 'false',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }


