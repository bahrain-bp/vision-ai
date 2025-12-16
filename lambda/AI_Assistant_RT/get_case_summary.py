import json
import boto3
import os
from botocore.exceptions import ClientError

# Initialize S3 client
s3_client = boto3.client('s3')

# Environment variables (set via CDK)
BUCKET_NAME = os.environ.get('BUCKET_NAME', 'vision-rt-investigation-system')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

def lambda_handler(event, context):
    """
    Fetch pre-uploaded police case summary from S3.
    
    Path: cases/{caseId}/police-summary.txt
    
    Returns:
        200: { "caseSummary": "..." }
        404: { "error": "Case summary not found" }
        500: { "error": "Internal server error" }
    """
    
    try:
        # Extract caseId from path parameters
        case_id = event['pathParameters']['caseId']
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Fetching case summary for caseId: {case_id}")
        
        # Build S3 key
        s3_key = f"cases/{case_id}/police-summary.txt"
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Reading from S3 - Bucket: {BUCKET_NAME}, Key: {s3_key}")
        
        # Fetch file from S3
        response = s3_client.get_object(
            Bucket=BUCKET_NAME,
            Key=s3_key
        )
        
        # Read file content
        case_summary = response['Body'].read().decode('utf-8')
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Successfully retrieved case summary (length: {len(case_summary)} characters)")
        
        # Return success response
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'caseSummary': case_summary
            })
        }
        
    except s3_client.exceptions.NoSuchKey:
        # File doesn't exist - this is a CRITICAL error
        print(f"ERROR: Case summary not found for caseId: {case_id}")
        print(f"ERROR: Expected S3 path: s3://{BUCKET_NAME}/{s3_key}")
        
        return {
            'statusCode': 404,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Case summary not found',
                'message': f'No police summary exists for case {case_id}. Please contact system administrator.'
            })
        }
        
    except ClientError as e:
        # AWS S3 error (permissions, bucket doesn't exist, etc.)
        error_code = e.response['Error']['Code']
        print(f"ERROR: S3 ClientError - {error_code}: {str(e)}")
        
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Failed to retrieve case summary',
                'message': 'An error occurred while accessing case data. Please try again.'
            })
        }
        
    except Exception as e:
        # Unexpected error
        print(f"ERROR: Unexpected error in get_case_summary: {str(e)}")
        
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'error': 'Internal server error',
                'message': 'An unexpected error occurred. Please contact support.'
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