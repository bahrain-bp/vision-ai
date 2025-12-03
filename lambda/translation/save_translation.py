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
        translations = body.get('translations')
        metadata = body.get('metadata', {})
        
        if not all([case_id, session_id, translations]):
            return build_response(400, {
                'error': 'Missing required fields: caseId, sessionId, translations'
            })
        
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        
        # Save to translation folder (parallel to transcribe folder)
        translation_key = f"cases/{case_id}/sessions/{session_id}/translation/translations-{timestamp}.json"
        metadata_key = f"cases/{case_id}/sessions/{session_id}/translation/metadata-{timestamp}.json"
        
        # Save translations as JSON
        translation_data = {
            'caseId': case_id,
            'sessionId': session_id,
            'translations': translations,
            'investigatorLanguage': metadata.get('investigatorLanguage'),
            'witnessLanguage': metadata.get('witnessLanguage'),
            'savedAt': datetime.utcnow().isoformat() + 'Z'
        }
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=translation_key,
            Body=json.dumps(translation_data, indent=2, ensure_ascii=False),
            ContentType='application/json'
        )
        
        # Save metadata
        metadata_with_info = {
            'caseId': case_id,
            'sessionId': session_id,
            'translationKey': translation_key,
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'translationCount': len(translations) if isinstance(translations, list) else 0,
            **metadata
        }
        
        s3_client.put_object(
            Bucket=bucket_name,
            Key=metadata_key,
            Body=json.dumps(metadata_with_info, indent=2),
            ContentType='application/json'
        )
        
        return build_response(200, {
            'message': 'Translation saved successfully',
            'translationKey': translation_key,
            'metadataKey': metadata_key
        })
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return build_response(500, {
            'error': 'Failed to save translation',
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
            'Content-Type': 'application/json; charset=utf-8'
        },
        'body': json.dumps(body, ensure_ascii=False)
    }