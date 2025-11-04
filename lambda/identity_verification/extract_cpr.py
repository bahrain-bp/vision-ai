import json
import boto3
import os
import re

textract = boto3.client('textract')
s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Extract CPR number from uploaded document using Textract
    
    POST /identity/extract-cpr
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "documentKey": "cases/CASE-001/sessions/session-123/01-identity-verification/documents/uploaded/doc.jpg"
    }
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        document_key = body.get('documentKey')
        
        # Validate inputs
        if not document_key:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'documentKey is required'
                })
            }
        
        print(f"Extracting CPR from: {document_key}")
        
        # Call Textract to detect text
        response = textract.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': BUCKET_NAME,
                    'Name': document_key
                }
            }
        )
        
        # Extract all text from document
        extracted_text = []
        for block in response.get('Blocks', []):
            if block['BlockType'] == 'LINE':
                extracted_text.append(block['Text'])
        
        full_text = ' '.join(extracted_text)
        print(f"Extracted text: {full_text}")
        
        # Extract CPR number (Bahrain CPR: 9 digits)
        cpr_pattern = r'\b\d{9}\b'
        cpr_matches = re.findall(cpr_pattern, full_text)
        
        if not cpr_matches:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'CPR number not found in document',
                    'extractedText': full_text
                })
            }
        
        cpr_number = cpr_matches[0]
        print(f"Found CPR: {cpr_number}")
        
        # Move document from uploaded/ to processed/ with CPR in filename
        new_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/documents/processed/{cpr_number}_citizen-id.jpg"
        
        # Copy object to new location
        s3.copy_object(
            Bucket=BUCKET_NAME,
            CopySource={'Bucket': BUCKET_NAME, 'Key': document_key},
            Key=new_key
        )
        
        # Delete original uploaded file
        s3.delete_object(Bucket=BUCKET_NAME, Key=document_key)
        print(f"Moved document to: {new_key}")
        
        # Save Textract results
        result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/documents/extraction-results/{cpr_number}_textract.json"
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=result_key,
            Body=json.dumps(response, default=str),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'cprNumber': cpr_number,
                'extractedText': full_text,
                'processedDocumentKey': new_key,
                'textractResultKey': result_key
            })
        }
        
    except Exception as e:
        print(f"Error extracting CPR: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to extract CPR',
                'details': str(e)
            })
        }