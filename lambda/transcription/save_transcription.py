import json
import boto3
import os
from datetime import datetime
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')
bucket_name = os.environ['BUCKET_NAME']

def handler(event, context):
    try:        
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        transcription = body.get('transcription')
        metadata = body.get('metadata', {})
        
        if not all([case_id, session_id, transcription]):
            return build_response(400, {
                'error': 'Missing required fields: caseId, sessionId, transcription'
            })
        
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        
        # This path auto-creates the "transcribe" folder
        transcription_key = f"cases/{case_id}/sessions/{session_id}/transcribe/transcript-{timestamp}.txt"
        metadata_key = f"cases/{case_id}/sessions/{session_id}/transcribe/metadata-{timestamp}.json"
        
        # Save transcription text
        s3_client.put_object(
            Bucket=bucket_name,
            Key=transcription_key,
            Body=transcription,
            ContentType='text/plain'
        )
        
        # Save metadata
        metadata_with_info = {
            'caseId': case_id,
            'sessionId': session_id,
            'transcriptionKey': transcription_key,
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            **metadata
        }
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=metadata_key,
            Body=json.dumps(metadata_with_info, indent=2),
            ContentType='application/json'
        )
        
        return build_response(200, {
            'message': 'Transcription saved successfully',
            'transcriptionKey': transcription_key,
            'metadataKey': metadata_key
        })
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return build_response(500, {
            'error': 'Failed to save transcription',
            'details': str(e)
        })


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