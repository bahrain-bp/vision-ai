import json
import logging
import os
import boto3
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

BEDROCK_PROJECT_ARN = os.environ.get("BEDROCK_PROJECT_ARN")
BEDROCK_PROFILE_ARN = os.environ.get("BEDROCK_PROFILE_ARN") 


# sessionID validation helper function
def is_valid_session_id(session_id):
    """
    Valid sessionId example: 2024-INV-0042
    Format: YYYY-INV-XXXX
    """
    pattern = r'^\d{4}-INV-\d{4}$'
    return bool(re.match(pattern, session_id))

def sanitize_session_id(session_id):
    # remove any invalid characters (e.g., #)
    return re.sub(r"[^a-zA-Z0-9-]", "", session_id)


def handler(event, context):
    """
    Trigger Bedrock Data Automation job for video analysis.

    Expected POST body:
    {
        "sessionId": "2024-INV-0042",
        "s3Key": "camera-footage/videos/2024-INV-0042/footage_20231115-123456_abcdef123456.mp4"
    }
    """
    try:
        logger.info("=== Starting video analysis job ===")
        
        # Log environment variables (for debugging)
        logger.info(f"Environment - BEDROCK_PROJECT_ARN: {BEDROCK_PROJECT_ARN}")
        logger.info(f"Environment - BEDROCK_PROFILE_ARN: {BEDROCK_PROFILE_ARN}")
        logger.info(f"Environment - BUCKET_NAME: {os.environ.get('BUCKET_NAME')}")

        # parse request body
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId')
        s3_key = body.get('s3Key')
        input_bucket = body.get('bucket') or os.environ.get("BUCKET_NAME")  # Use env var if not in body

        logger.info(f"Parameters - sessionId: {session_id}, s3Key: {s3_key}, input bucket {input_bucket} ")

        # validate field inputs
        if not session_id or not s3_key:
           return error_response(400, 'sessionId and S3 key are required')
       
        if not input_bucket:
           return error_response(500, 'BUCKET_NAME not configured')
       
       
       # Validate Bedrock ARNs are set
        if not BEDROCK_PROJECT_ARN or not BEDROCK_PROFILE_ARN:
            logger.error("Missing Bedrock ARN configuration")
            return error_response(500, 'Bedrock configuration missing')
       
        # sanitize sessionId
        session_id = sanitize_session_id(session_id)
        
        # validate sessionId format 
        if not is_valid_session_id(session_id):
            return error_response(400, f'Invalid sessionId format {session_id} (expected YYYY-INV-XXXX)')

        # generate Bedrock Data Automation job
        input_s3_uri = f"s3://{input_bucket}/{s3_key}"
        output_s3_uri = f"s3://{input_bucket}/camera-footage/analysis-results/{session_id}/"

        
        logger.info(f"Input S3 URI: {input_s3_uri}")
        logger.info(f"Output S3 URI: {output_s3_uri}")
        logger.info(f"Project ARN: {BEDROCK_PROJECT_ARN}")
        logger.info(f"Profile ARN: {BEDROCK_PROFILE_ARN}")
        
        client = boto3.client('bedrock-data-automation-runtime', region_name='us-east-1')
        
        response = client.invoke_data_automation_async(
            inputConfiguration={
                's3Uri': input_s3_uri
            }, 
            outputConfiguration={
                's3Uri': output_s3_uri
            }, 
            dataAutomationConfiguration={
                'dataAutomationProjectArn': BEDROCK_PROJECT_ARN, 
                'stage': 'LIVE'
            },
            dataAutomationProfileArn=BEDROCK_PROFILE_ARN
        )

        invocation_arn = response.get('invocationArn')

        logger.info(f"Bedrock job started: {invocation_arn}")
        
        if not invocation_arn:
            logger.error(f"No invocationArn in response: {response}")
            return error_response(500, 'Bedrock job started but no invocation ARN returned')

        logger.info(f"Bedrock job started successfully: {invocation_arn}")

        return {
            'statusCode': 202, 
            'headers': {
                'Access-Control-Allow-Origin': '*', 
                'Access-Control-Allow-Methods': 'OPTIONS,POST,PUT',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True, 
                'invocationArn': invocation_arn,
                'jobId': invocation_arn.split('/')[-1],  # Extract job ID
                'status': 'processing',
                'message': 'Analysis job triggered successfully',
                'inputS3Uri': input_s3_uri,
                'outputS3Uri': output_s3_uri
                
            })
 
        }

    except Exception as e:
      logger.error(f"Error triggering video analysis job: {str(e)}", exc_info=True)
      return error_response(500, 'Failed to trigger analysis job')
    
    
def error_response(status_code, message):
    """Helper function to create error responses"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }    