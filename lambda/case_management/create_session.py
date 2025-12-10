import json
import boto3
import re
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
        
        if not validate_id_format(case_id, 'caseId'):
            return build_response(400, {
                'error': 'Invalid caseId format'
            })
        
        if not validate_input_string(investigator, 'investigator', 100):
            return build_response(400, {
                'error': 'Invalid investigator format'
            })
        
        # Verify case exists
        if not verify_case_exists(case_id):
            return build_response(404, {
                'error': 'Case not found'
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

def validate_id_format(value, field_name):
    """Validate that ID contains only safe characters"""
    if not value:
        return False
    
    # For case IDs: CASE-202512-A525ED1B format
    if field_name == 'caseId':
        if not re.match(r'^CASE-\d{6}-[A-F0-9]{8}$', value):
            print(f"Invalid {field_name} format: {value}")
            return False
    
    # For session IDs: session-20251207123456-a1b2c3d4 format
    elif field_name == 'sessionId':
        if not re.match(r'^session-\d{14}-[a-fA-F0-9]{8}$', value):
            print(f"Invalid {field_name} format: {value}")
            return False
    else:
        if not re.match(r'^[a-zA-Z0-9_-]+$', value):
            print(f"Invalid {field_name} format: {value}")
            return False
    
    # Always prevent path traversal
    if '..' in value or '/' in value or '\\' in value:
        print(f"Path traversal attempt in {field_name}: {value}")
        return False
    
    return True

def validate_input_string(value, field_name, max_length=200):
    """Validate user input strings"""
    if not value:
        return False
    
    if len(value) > max_length:
        print(f"Invalid {field_name}: exceeds maximum length")
        return False
    
    # Prevent null bytes and control characters
    if '\x00' in value or any(ord(char) < 32 and char not in ['\n', '\r', '\t'] for char in value):
        print(f"Invalid {field_name}: contains invalid characters")
        return False
    
    return True

def verify_case_exists(case_id):
    """Verify that case exists"""
    try:
        case_key = f"cases/{case_id}/case.json"
        s3_client.head_object(Bucket=bucket_name, Key=case_key)
        return True
    except:
        return False