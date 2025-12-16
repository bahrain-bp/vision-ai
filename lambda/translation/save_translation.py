import json
import boto3
import os
from datetime import datetime
from decimal import Decimal

# Initialize S3 client - this will be used to upload files to S3 bucket
s3_client = boto3.client('s3')

def decimal_default(obj):
    """
    Helper function to convert Decimal objects to float for JSON serialization.
    AWS DynamoDB returns Decimal types which aren't JSON serializable by default.
    
    Args:
        obj: Object to check for Decimal type
        
    Returns:
        float: If object is Decimal, returns float value
        Raises: TypeError if object is not Decimal
    """
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def handler(event, context):
    """
    Main Lambda handler function triggered by API Gateway.
    
    This function:
    1. Receives translation data from the frontend when session ends
    2. Formats it into a clean transcript (Investigator's View)
    3. Saves transcript as .txt file to S3
    4. Saves metadata as .json file to S3
    
    Args:
        event: API Gateway event containing request data
        context: Lambda runtime context
        
    Returns:
        dict: API Gateway formatted response with status code and body
    """
    try:
        print("=== TRANSLATION SAVE LAMBDA ===")
        
        # Parse request body - handle both string and dict formats
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])  # Convert string to dict
        else:
            body = event.get('body', {})  # Already dict or empty dict
        
        print(f"Request received with {len(body.get('translations', []))} translations")
        
        # Extract required data from request
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        translations = body.get('translations', [])  # Array of translation objects
        metadata = body.get('metadata', {})  # Additional session metadata
        
        # Validate required fields
        if not all([case_id, session_id]):
            return build_response(400, {
                'error': 'Missing required fields: caseId, sessionId'
            })
        
        # Get bucket name from environment variables
        bucket_name = os.environ.get('BUCKET_NAME')
        if not bucket_name:
            return build_response(500, {
                'error': 'BUCKET_NAME environment variable not set'
            })
        
        # Create timestamp for unique filenames (prevents overwrites)
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        
        # ============================================================
        # CREATE TRANSCRIPT CONTENT (Investigator's View)
        # This shows what the investigator saw during the session
        # ============================================================
        translation_text = ""
        
        # Extract language settings from metadata
        investigator_lang = metadata.get('investigatorLanguage', 'en')
        participant_lang = metadata.get('participantLanguage', 'ar')
        
        # Add header information for context
        translation_text += f"=== SESSION TRANSCRIPT (Investigator's View) ===\n"
        translation_text += f"Session: {session_id}\n"
        translation_text += f"Case: {case_id}\n"
        translation_text += f"Investigator Language: {investigator_lang}\n"
        translation_text += f"Participant Language: {participant_lang}\n"
        translation_text += f"Generated: {datetime.utcnow().isoformat()}Z\n"
        translation_text += "=" * 50 + "\n\n"
        
        # Process each translation entry
        for i, trans in enumerate(translations, 1):
            # Parse and format timestamp
            timestamp_str = trans.get('timestamp', '')
            time_formatted = '[--:--:--]'  # Default if timestamp parsing fails
            
            if timestamp_str:
                try:
                    # Handle ISO format timestamps (with or without Zulu time)
                    if 'Z' in timestamp_str:
                        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        dt = datetime.fromisoformat(timestamp_str)
                    # Format as [HH:MM:SS]
                    time_formatted = dt.strftime('[%H:%M:%S]')
                except Exception:
                    # If timestamp parsing fails, keep default
                    pass
            
            # Get speaker identity (Investigator, Witness, Accused, Victim, etc.)
            speaker = trans.get('speaker', 'Unknown')
            
            # IMPORTANT: Always use investigatorDisplay field
            # This contains the text as it appeared to the investigator:
            # - For Investigator's speech: original text in investigator's language
            # - For Participant's speech: translated text in investigator's language
            text_to_save = trans.get('investigatorDisplay', trans.get('originalText', ''))
            
            # Only save non-empty messages
            if text_to_save.strip():
                # Format: [timestamp] [Speaker]: message text
                translation_text += f"{time_formatted} [{speaker}]: {text_to_save.strip()}\n"
            
            # Log for CloudWatch debugging
            print(f"Message {i}: Speaker={speaker}, SavedText='{text_to_save[:50]}...'")
        
        # Handle empty session case
        if len(translation_text) < 100:  # If only header is present
            translation_text += "\nNo conversation recorded during this session.\n"
        
        # Log transcript info for monitoring
        print(f"Translation text length: {len(translation_text)} characters")
        print(f"First 300 chars:\n{translation_text[:300]}")
        
        # ============================================================
        # SAVE FILES TO S3
        # ============================================================
        
        # Create S3 keys (paths) for the files
        translation_key = f"cases/{case_id}/sessions/{session_id}/translation/transcript-{timestamp}.txt"
        metadata_key = f"cases/{case_id}/sessions/{session_id}/translation/metadata-{timestamp}.json"
        
        # 1. Save transcript as text file
        print(f"Saving TXT to: s3://{bucket_name}/{translation_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=translation_key,
            Body=translation_text,
            ContentType='text/plain'  # MIME type for text files
        )
        print("✓ TXT file saved")
        
        # 2. Prepare and save metadata as JSON file
        metadata_with_info = {
            'caseId': case_id,
            'sessionId': session_id,
            'translationKey': translation_key,  # Reference to the transcript file
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'translationCount': len(translations),
            'investigatorLanguage': metadata.get('investigatorLanguage', 'en'),
            'participantLanguage': metadata.get('participantLanguage', 'ar'),
            'totalMessages': metadata.get('totalMessages', len(translations)),
            'viewType': 'investigator_interface',  # Important: indicates perspective
            **metadata  # Include any additional metadata passed
        }
        
        print(f"Saving metadata to: s3://{bucket_name}/{metadata_key}")
        s3_client.put_object(
            Bucket=bucket_name,
            Key=metadata_key,
            Body=json.dumps(metadata_with_info, indent=2, default=decimal_default),
            ContentType='application/json'
        )
        print("✓ Metadata saved")
        
        # Return success response to frontend
        return build_response(200, {
            'message': 'Translation saved successfully',
            'translationKey': translation_key,
            'metadataKey': metadata_key,
            'fileType': 'txt',
            'viewType': 'investigator_interface'
        })
        
    except Exception as e:
        # Log detailed error information for troubleshooting
        print(f"✗ Error saving translation: {str(e)}")
        import traceback
        traceback.print_exc()  # Print full stack trace
        
        # Return error response
        return build_response(500, {
            'error': 'Failed to save translation',
            'details': str(e)
        })


def build_response(status_code, body):
    """
    Builds a standardized API Gateway response with CORS headers.
    
    Args:
        status_code: HTTP status code (200, 400, 500, etc.)
        body: Response body content (will be JSON serialized)
        
    Returns:
        dict: API Gateway response format
    """
    return {
        'statusCode': status_code,
        'headers': {
            # CORS headers to allow cross-origin requests from frontend
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, Content-Length',
            'Access-Control-Allow-Credentials': 'false',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body, default=decimal_default)
    }