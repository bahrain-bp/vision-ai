import json
import boto3
import os
from botocore.exceptions import ClientError

# Initialize S3 client
s3_client = boto3.client('s3')

# Environment variables
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'vision-rt-investigation-system')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

def lambda_handler(event, context):
    """
    Fetch victim testimony transcripts from past sessions.
    
    Process:
    1. Extract current sessionId from query parameters
    2. List all sessions for the case
    3. Find sessions where primaryPerson.personType = 'victim'
    4. EXCLUDE the current session (to get PREVIOUS victim testimonies only)
    5. Read transcript for each previous victim session
    6. Concatenate multiple victim testimonies with timestamps (oldest to newest)
    
    Returns:
        200: { "victimTestimony": "..." } or { "victimTestimony": null }
        500: { "error": "Internal server error" }
    """
    
    try:
        # Extract caseId from path parameters
        case_id = event['pathParameters']['caseId']
        
        # Extract current sessionId from query parameters (to exclude it)
        query_params = event.get('queryStringParameters') or {}
        current_session_id = query_params.get('sessionId')
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Fetching victim testimony for caseId: {case_id}")
            print(f"INFO: Current sessionId (to exclude): {current_session_id}")
        
        # Step 1: List all sessions under cases/{caseId}/sessions/
        sessions_prefix = f"cases/{case_id}/sessions/"
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Listing sessions at S3 prefix: {sessions_prefix}")
        
        try:
            response = s3_client.list_objects_v2(
                Bucket=BUCKET_NAME,
                Prefix=sessions_prefix,
                Delimiter='/'
            )
        except ClientError as e:
            print(f"ERROR: Failed to list sessions: {str(e)}")
            return error_response(500, "Failed to list sessions")
        
        # Extract session folders from common prefixes
        if 'CommonPrefixes' not in response:
            # No sessions exist yet - this is okay, return null
            if LOG_LEVEL == 'INFO':
                print(f"INFO: No sessions found for case {case_id}")
            return success_response(None)
        
        session_folders = [prefix['Prefix'] for prefix in response['CommonPrefixes']]
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Found {len(session_folders)} session folders")
        
        # Step 2: Find victim sessions by reading metadata
        victim_testimonies = []
        
        for session_folder in session_folders:
            # Extract session ID from path: cases/{caseId}/sessions/{sessionId}/
            session_id = session_folder.rstrip('/').split('/')[-1]
            
            # CRITICAL: Skip current session if this is a victim-to-victim scenario
            if current_session_id and session_id == current_session_id:
                if LOG_LEVEL == 'INFO':
                    print(f"INFO: Skipping current session {session_id}")
                continue
            
            # Read session metadata
            metadata_key = f"{session_folder}session-metadata.json"
            
            try:
                metadata_response = s3_client.get_object(
                    Bucket=BUCKET_NAME,
                    Key=metadata_key
                )
                metadata = json.loads(metadata_response['Body'].read().decode('utf-8'))
                
                # Check if this is a victim session (check primaryPerson.personType)
                primary_person = metadata.get('primaryPerson', {})
                person_type = primary_person.get('personType', '')
                
                if person_type == 'victim':
                    if LOG_LEVEL == 'INFO':
                        print(f"INFO: Found victim session: {session_id}")
                    
                    # Step 3: Find transcript file in transcribe folder
                    transcribe_prefix = f"{session_folder}transcribe/"
                    
                    try:
                        transcribe_response = s3_client.list_objects_v2(
                            Bucket=BUCKET_NAME,
                            Prefix=transcribe_prefix
                        )
                        
                        # Find .txt file in transcribe folder
                        transcript_key = None
                        if 'Contents' in transcribe_response:
                            for obj in transcribe_response['Contents']:
                                if obj['Key'].endswith('.txt'):
                                    transcript_key = obj['Key']
                                    break
                        
                        if not transcript_key:
                            print(f"WARNING: No transcript file found for victim session {session_id}")
                            continue
                        
                        # Read the transcript
                        transcript_response = s3_client.get_object(
                            Bucket=BUCKET_NAME,
                            Key=transcript_key
                        )
                        transcript_text = transcript_response['Body'].read().decode('utf-8')
                        
                        # Get session date and person name from metadata
                        session_date = metadata.get('createdAt', 'Unknown date')
                        person_name = primary_person.get('personName', 'Unknown')
                        
                        victim_testimonies.append({
                            'sessionId': session_id,
                            'date': session_date,
                            'personName': person_name,
                            'transcript': transcript_text
                        })
                        
                        if LOG_LEVEL == 'INFO':
                            print(f"INFO: Retrieved transcript for victim session {session_id} ({person_name}, length: {len(transcript_text)} chars)")
                    
                    except ClientError as e:
                        print(f"WARNING: Failed to read transcript for victim session {session_id}: {str(e)}")
                        continue
            
            except s3_client.exceptions.NoSuchKey:
                print(f"WARNING: Metadata not found for session {session_id}")
                continue
            except Exception as e:
                print(f"WARNING: Failed to process session {session_id}: {str(e)}")
                continue
        
        # Step 4: Handle results
        if not victim_testimonies:
            # No previous victim sessions found - return null
            if LOG_LEVEL == 'INFO':
                print(f"INFO: No previous victim testimonies found for case {case_id}")
            return success_response(None)
        
        # Step 5: Concatenate multiple victim testimonies with separation
        # Sort by date (oldest first for chronological order)
        victim_testimonies.sort(key=lambda x: x['date'])
        
        if len(victim_testimonies) == 1:
            # Single previous victim testimony - simpler format
            testimony = victim_testimonies[0]
            concatenated = f"[Previous Victim Testimony - {testimony['personName']}, Date: {testimony['date']}]\n\n{testimony['transcript']}"
        else:
            # Multiple previous victim testimonies - numbered format
            concatenated_parts = []
            for i, testimony in enumerate(victim_testimonies, 1):
                header = f"[Previous Victim Testimony {i} - {testimony['personName']}, Date: {testimony['date']}]"
                concatenated_parts.append(header)
                concatenated_parts.append(testimony['transcript'])
                concatenated_parts.append("")  # Empty line for separation
            
            concatenated = "\n".join(concatenated_parts)
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Successfully concatenated {len(victim_testimonies)} previous victim testimony/testimonies (total length: {len(concatenated)} chars)")
        
        return success_response(concatenated)
    
    except Exception as e:
        # Unexpected error
        print(f"ERROR: Unexpected error in get_victim_testimony: {str(e)}")
        return error_response(500, "An unexpected error occurred. Please contact support.")

def success_response(victim_testimony):
    """Return successful response with victim testimony (or null)"""
    return {
        'statusCode': 200,
        'headers': get_cors_headers(),
        'body': json.dumps({
            'victimTestimony': victim_testimony
        })
    }

def error_response(status_code, message):
    """Return error response"""
    return {
        'statusCode': status_code,
        'headers': get_cors_headers(),
        'body': json.dumps({
            'error': message
        })
    }

def get_cors_headers():
    """Return CORS headers for API Gateway"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    }