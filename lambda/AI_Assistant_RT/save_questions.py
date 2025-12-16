import json
import boto3
import os
import logging
from datetime import datetime
from typing import Dict, Any, List

# Configure logging
logger = logging.getLogger()
log_level = os.environ.get('LOG_LEVEL', 'INFO')
logger.setLevel(getattr(logging, log_level))

# Initialize AWS clients
s3_client = boto3.client('s3')
bucket_name = os.environ.get('BUCKET_NAME')

def lambda_handler(event, context):
    """
    Save confirmed question attempts to S3
    
    Handles:
    - Creating new questions.json file
    - Appending to existing file (accumulation strategy)
    - All confirmed attempts, rejected questions, metadata, and metrics
    
    Request body structure:
    {
        "caseId": "CASE-001",
        "sessionId": "SESSION-123",
        "attempts": [...],  // All QuestionAttempt objects
        "metadata": {
            "investigator": "John Doe",
            "personType": "witness",
            "personName": "Jane Smith",
            "sessionDate": "2024-12-05T10:00:00Z",
            "savedAt": "2024-12-05T10:30:00Z"
        }
    }
    """
    try:
        logger.info("Save questions request received")
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Extract required fields
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        attempts = body.get('attempts', [])
        metadata = body.get('metadata', {})
        
        # Validate required fields
        if not case_id:
            logger.error("Missing required field: caseId")
            return error_response(400, "Missing required field: caseId")
        
        if not session_id:
            logger.error("Missing required field: sessionId")
            return error_response(400, "Missing required field: sessionId")

        # Check if this is a final save (HTML generation only)
        is_final_save = body.get('isFinalSave', False)

        # Allow empty attempts ONLY if this is a final save request
        if not attempts and not is_final_save:
            logger.error("Missing required field: attempts")
            return error_response(400, "Missing required field: attempts (no attempts to save)")

        logger.info(f"Processing save request for case {case_id}, session {session_id}")
        logger.info(f"Received {len(attempts)} attempt(s) to save")
        logger.info(f"Is final save (HTML generation): {is_final_save}")
        
        # Construct S3 path
        s3_key = f"cases/{case_id}/sessions/{session_id}/ai-questions/questions.json"
        logger.info(f"Target S3 path: s3://{bucket_name}/{s3_key}")

        # If this is ONLY a final save request (no new attempts), skip JSON update
        if not attempts and is_final_save:
            logger.info("📋 Final save only - skipping JSON update, proceeding to HTML generation")
        else:
            # Normal flow: save/update the JSON file
            # Check if file already exists
            existing_data = get_existing_data(s3_key)

            if existing_data:
                logger.info(f"Found existing file with {len(existing_data.get('attempts', []))} existing attempt(s)")
                # Append new attempts to existing data
                updated_data = append_attempts(existing_data, attempts, metadata)
            else:
                logger.info("No existing file found, creating new questions file")
                # Create new file structure
                updated_data = create_new_file(attempts, metadata)

            # Calculate metrics
            metrics = calculate_metrics(updated_data['attempts'])
            updated_data['metrics'] = metrics

            # Update savedAt timestamp
            updated_data['savedAt'] = datetime.utcnow().isoformat() + 'Z'

            # Save to S3
            save_to_s3(s3_key, updated_data)

            logger.info(f"✅ Successfully saved {len(updated_data['attempts'])} total attempt(s) to S3")

        # Return success response
        if not attempts and is_final_save:
            # For final save only requests, return minimal response
            return success_response(
                s3_path=f"s3://{bucket_name}/{s3_key}",
                saved_attempts=0,
                saved_at=datetime.utcnow().isoformat() + 'Z'
            )
        else:
            # Normal response with updated data
            return success_response(
                s3_path=f"s3://{bucket_name}/{s3_key}",
                saved_attempts=len(updated_data['attempts']),
                saved_at=updated_data['savedAt']
            )

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in request body: {str(e)}")
        return error_response(400, f"Invalid JSON format: {str(e)}")

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return error_response(500, f"Internal server error: {str(e)}")


def get_existing_data(s3_key: str) -> Dict[str, Any]:
    """
    Retrieve existing questions.json file from S3
    Returns None if file doesn't exist
    """
    try:
        response = s3_client.get_object(
            Bucket=bucket_name,
            Key=s3_key
        )
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    
    except s3_client.exceptions.NoSuchKey:
        logger.info("No existing file found (expected for first save)")
        return None
    
    except Exception as e:
        logger.error(f"Error reading existing file: {str(e)}")
        raise


def append_attempts(existing_data: Dict[str, Any], new_attempts: List[Dict], metadata: Dict) -> Dict[str, Any]:
    """
    Append new attempts to existing data structure
    """
    # Get existing attempts
    existing_attempts = existing_data.get('attempts', [])
    
    # Add new attempts
    existing_attempts.extend(new_attempts)
    
    # Update structure
    existing_data['attempts'] = existing_attempts
    
    # Update metadata if provided
    if metadata:
        existing_data['metadata'] = metadata
    
    return existing_data


def create_new_file(attempts: List[Dict], metadata: Dict) -> Dict[str, Any]:
    """
    Create new file structure for first save
    """
    return {
        "attempts": attempts,
        "metadata": metadata,
        "metrics": {},  # Will be calculated
        "savedAt": ""   # Will be set before saving
    }


def calculate_metrics(attempts: List[Dict]) -> Dict[str, Any]:
    """
    Calculate metrics from all attempts
    
    Metrics include:
    - Total attempts
    - Total confirmed questions
    - Total rejected questions
    - Confirmed count
    - Rejected count
    - Retry count (attempts beyond first)
    - Questions by category breakdown
    - Questions by language breakdown
    """
    total_attempts = len(attempts)
    confirmed_count = sum(1 for attempt in attempts if attempt.get('isConfirmed', False))
    
    # Count all questions (confirmed + rejected)
    total_confirmed_questions = 0
    total_rejected_questions = 0
    
    # Track categories and languages
    category_counts = {}
    language_counts = {}
    
    for attempt in attempts:
        # Count confirmed questions
        questions = attempt.get('questions', [])
        confirmed_questions = [q for q in questions if q.get('status') == 'confirmed']
        total_confirmed_questions += len(confirmed_questions)
        
        # Count categories (from confirmed questions)
        for question in confirmed_questions:
            category = question.get('category', 'unknown')
            category_counts[category] = category_counts.get(category, 0) + 1
        
        # Count rejected questions
        rejected = attempt.get('rejectedQuestions', [])
        total_rejected_questions += len(rejected)
        
        # Count language
        language = attempt.get('language', 'unknown')
        language_counts[language] = language_counts.get(language, 0) + 1
    
    # Calculate retry count (attempts beyond first)
    retry_count = sum(attempt.get('retryCount', 0) for attempt in attempts)

    
    return {
        "totalAttempts": total_attempts,
        "confirmedAttempts": confirmed_count,
        "totalConfirmedQuestions": total_confirmed_questions,
        "totalRejectedQuestions": total_rejected_questions,
        "retryCount": retry_count,
        "questionsByCategory": category_counts,
        "questionsByLanguage": language_counts
    }


def save_to_s3(s3_key: str, data: Dict[str, Any]) -> None:
    """
    Save data to S3 with proper encoding and metadata
    """
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=json.dumps(data, ensure_ascii=False, indent=2),
            ContentType='application/json',
            ContentEncoding='utf-8',
            Metadata={
                'last-updated': datetime.utcnow().isoformat(),
                'total-attempts': str(data['metrics']['totalAttempts'])
            }
        )
        logger.info(f"Successfully wrote to S3: {s3_key}")
    
    except Exception as e:
        logger.error(f"Failed to save to S3: {str(e)}")
        raise


def success_response(s3_path: str, saved_attempts: int, saved_at: str) -> Dict[str, Any]:
    """
    Build success response
    """
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps({
            'success': True,
            's3Path': s3_path,
            'savedAttempts': saved_attempts,
            'savedAt': saved_at
        })
    }


def error_response(status_code: int, error_message: str) -> Dict[str, Any]:
    """
    Build error response
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps({
            'success': False,
            'error': error_message
        })
    }
