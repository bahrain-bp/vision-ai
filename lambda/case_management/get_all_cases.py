import json
import boto3
import os
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')
bucket_name = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Fetch all cases from S3 bucket
    
    """
    try:
        print(f"Fetching all cases from bucket: {bucket_name}")
        
        # List all case folders
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix='cases/',
            Delimiter='/'
        )
        
        cases = []
        
        if 'CommonPrefixes' in response:
            for prefix in response['CommonPrefixes']:
                case_prefix = prefix['Prefix']
                case_id = case_prefix.split('/')[1]
                
                try:
                    case_data = get_case_metadata(case_id)
                    if case_data:
                        cases.append(case_data)
                except Exception as e:
                    print(f"Error processing case {case_id}: {str(e)}")
                    # Continue processing other cases
                    continue
        
        print(f"Successfully fetched {len(cases)} cases")
        
        return build_response(200, {
            'cases': cases,
            'total': len(cases)
        })
        
    except Exception as e:
        print(f"Error fetching cases: {str(e)}")
        return build_response(500, {
            'error': 'Failed to fetch cases',
            'details': str(e)
        })

def get_case_metadata(case_id):
    """
    Get case metadata from S3
    """
    try:
        case_key = f"cases/{case_id}/case.json"
        response = s3_client.get_object(Bucket=bucket_name, Key=case_key)
        case_data = json.loads(response['Body'].read().decode('utf-8'))
        return case_data
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"Case metadata not found for {case_id}")
            return None
        else:
            raise e

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
