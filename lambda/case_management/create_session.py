import json
import boto3
import os
import uuid
from datetime import datetime
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')
bucket_name = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Create a new session within a case
    """
    try:
        # Parse request body
        body = json.loads(event['body'])
        
        case_id = body.get('caseId')
        investigator = body.get('investigator')
        person_type = body.get('personType', 'witness')
        
        # Validate required fields
        if not all([case_id, investigator]):
            return build_response(400, {
                'error': 'Missing required fields: caseId, investigator'
            })
        
        # Validate person type
        if person_type not in ['witness', 'accused', 'victim']:
            return build_response(400, {
                'error': 'Invalid personType. Must be witness, accused, or victim'
            })
        
        # Generate unique session ID 
        session_id = generate_session_id()
        
        current_timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Create session metadata 
        session_metadata = {
            'caseId': case_id,
            'sessionId': session_id,
            'sessionStartDate': current_timestamp,
            'lastUpdated': current_timestamp,
            'investigator': investigator,
            'sessionStatus': 'active',
            'duration': '00:00',
            'createdAt': current_timestamp,
            'primaryPerson': {
                'cprNumber': '',
                'personName': '',
                'personType': '',
                'nationality': ''
            },
            'verifications': []
        }
        
        # Save session metadata to S3 
        session_metadata_key = f"cases/{case_id}/sessions/{session_id}/session-metadata.json"
        s3_client.put_object(
            Bucket=bucket_name,
            Key=session_metadata_key,
            Body=json.dumps(session_metadata, indent=2),
            ContentType='application/json'
        )
        
        print(f"Created session metadata: {session_id} for case: {case_id}")
        
        return build_response(201, session_metadata)
        
    except Exception as e:
        print(f"Error creating session: {str(e)}")
        return build_response(500, {
            'error': 'Failed to create session',
            'details': str(e)
        })

def generate_session_id():
    """Generate a unique session ID"""
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    return f"session-{timestamp}-{unique_id}"

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

