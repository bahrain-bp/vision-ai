import json
import boto3
import os

s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Check if reference photo exists in global-assets
    
    GET /identity/check-reference/{cpr}
    Path parameter: cpr 
    """
    try:
        # Get CPR from path parameters
        cpr_number = event.get('pathParameters', {}).get('cpr')
        
        if not cpr_number:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'CPR number is required'
                })
            }
        
        print(f"Checking reference photo for CPR: {cpr_number}")
        
        # Check multiple file extensions
        possible_extensions = ['.jpg', '.jpeg', '.png']
        found_key = None
        
        for ext in possible_extensions:
            reference_key = f"global-assets/reference-photos/{cpr_number}_reference-photo{ext}"
            
            try:
                s3.head_object(Bucket=BUCKET_NAME, Key=reference_key)
                found_key = reference_key
                print(f"Reference photo found: {reference_key}")
                break
            except s3.exceptions.ClientError as e:
                if e.response['Error']['Code'] != '404':
                    raise e
        
        exists = found_key is not None
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'exists': exists,
                'referencePhotoKey': found_key,
                'cprNumber': cpr_number
            })
        }
        
    except Exception as e:
        print(f"Error checking reference photo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to check reference photo',
                'details': str(e)
            })
        }