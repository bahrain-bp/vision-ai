import json
import boto3
import os
from datetime import datetime
from decimal import Decimal

s3_client = boto3.client('s3')

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def handler(event, context):
    try:
        print("=== TRANSLATION SAVE LAMBDA ===")
        
        # Parse request body
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        print(f"Request received: {json.dumps(body, default=decimal_default)[:200]}...")
        
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        translations = body.get('translations', [])
        metadata = body.get('metadata', {})
        
        if not all([case_id, session_id]):
            return build_response(400, {
                'error': 'Missing required fields: caseId, sessionId'
            })
        
        bucket_name = os.environ.get('BUCKET_NAME')
        if not bucket_name:
            return build_response(500, {
                'error': 'BUCKET_NAME environment variable not set'
            })
        
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        
        # Create translation text from translations array
        translation_text = ""
        for trans in translations:
            # Parse timestamp
            timestamp_str = trans.get('timestamp', '')
            time_formatted = '[--:--:--]'
            if timestamp_str:
                try:
                    if 'Z' in timestamp_str:
                        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        dt = datetime.fromisoformat(timestamp_str)
                    time_formatted = dt.strftime('[%H:%M:%S]')
                except:
                    pass
            
            speaker = trans.get('speaker', 'Unknown')
            
            # Use investigatorDisplay for Investigator, witnessDisplay for Witness
            if speaker == 'Investigator':
                text = trans.get('investigatorDisplay', trans.get('originalText', ''))
            elif speaker == 'Witness':
                text = trans.get('witnessDisplay', trans.get('originalText', ''))
            else:
                text = trans.get('originalText', '')
            
            if text.strip():  # Only add non-empty lines
                translation_text += f"{time_formatted} {speaker}: {text.strip()}\n"
        
        # If no translations or empty text, create a placeholder
        if not translation_text.strip():
            translation_text = "No translations recorded for this session.\n"
        
        print(f"Translation text length: {len(translation_text)} characters")
        
        # Save to S3 
        translation_key = f"cases/{case_id}/sessions/{session_id}/translation/transcript-{timestamp}.txt"
        metadata_key = f"cases/{case_id}/sessions/{session_id}/translation/metadata-{timestamp}.json"
        
        # Save translation text file
        print(f"Saving TXT to: s3://{bucket_name}/{translation_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=translation_key,
            Body=translation_text,
            ContentType='text/plain'
        )
        print("✓ TXT file saved")
        
        # Save metadata
        metadata_with_info = {
            'caseId': case_id,
            'sessionId': session_id,
            'translationKey': translation_key,
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'translationCount': len(translations),
            'investigatorLanguage': metadata.get('investigatorLanguage', 'en'),
            'witnessLanguage': metadata.get('witnessLanguage', 'ar'),
            'totalMessages': metadata.get('totalMessages', len(translations)),
            **metadata
        }
        
        print(f"Saving metadata to: s3://{bucket_name}/{metadata_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=metadata_key,
            Body=json.dumps(metadata_with_info, indent=2, default=decimal_default),
            ContentType='application/json'
        )
        print("✓ Metadata saved")
        
        return build_response(200, {
            'message': 'Translation saved successfully',
            'translationKey': translation_key,
            'metadataKey': metadata_key,
            'fileType': 'txt'
        })
        
    except Exception as e:
        print(f"✗ Error saving translation: {str(e)}")
        import traceback
        traceback.print_exc()
        
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
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, default=decimal_default)
    }