import json
import boto3
import os

lambda_client = boto3.client('lambda')
s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

# Lambda function names 
EXTRACT_CPR_FUNCTION = os.environ.get('EXTRACT_CPR_FUNCTION')
CHECK_REFERENCE_FUNCTION = os.environ.get('CHECK_REFERENCE_FUNCTION')
EXTRACT_FACE_FUNCTION = os.environ.get('EXTRACT_FACE_FUNCTION')
COMPARE_FACES_FUNCTION = os.environ.get('COMPARE_FACES_FUNCTION')

def handler(event, context):
    """
    Orchestrate complete identity verification workflow by invoking existing Lambda functions
    
    POST /identity/verify
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "documentKey": "cases/.../uploaded/doc.jpg",
        "witnessPhotoKey": "cases/.../witness-photo/screenshot.jpg"
    }
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        document_key = body.get('documentKey')
        witness_photo_key = body.get('witnessPhotoKey')
        
        # Validate inputs
        if not all([case_id, session_id, document_key, witness_photo_key]):
            return error_response(400, 'caseId, sessionId, documentKey, and witnessPhotoKey are required')
        
        print(f"Starting identity verification workflow for case: {case_id}")
        print(f"Document key: {document_key}")
        print(f"Witness photo key: {witness_photo_key}")
        
        # Verify files exist in S3 before proceeding
        try:
            s3.head_object(Bucket=BUCKET_NAME, Key=document_key)
            print(f"✓ Document exists in S3: {document_key}")
        except Exception as e:
            print(f"✗ Document not found in S3: {document_key}")
            return error_response(404, f'Document not found in S3: {document_key}', {'details': str(e)})
        
        try:
            s3.head_object(Bucket=BUCKET_NAME, Key=witness_photo_key)
            print(f"✓ Witness photo exists in S3: {witness_photo_key}")
        except Exception as e:
            print(f"✗ Witness photo not found in S3: {witness_photo_key}")
            return error_response(404, f'Witness photo not found in S3: {witness_photo_key}', {'details': str(e)})
        
        # ==========================================
        # STEP 1: EXTRACT CPR NUMBER
        # ==========================================
        print("\n=== Step 1: Extracting CPR number from document ===")
        
        cpr_payload = {
            'caseId': case_id,
            'sessionId': session_id,
            'documentKey': document_key
        }
        print(f"Calling extract_cpr with: {json.dumps(cpr_payload)}")
        
        cpr_response = invoke_lambda(EXTRACT_CPR_FUNCTION, cpr_payload)
        
        if cpr_response.get('statusCode') != 200:
            print(f"CPR extraction failed: {json.dumps(cpr_response)}")
            return error_response(500, 'Failed to extract CPR', cpr_response)
        
        cpr_number = cpr_response.get('cprNumber')
        processed_doc_key = cpr_response.get('processedDocumentKey')
        textract_result_key = cpr_response.get('textractResultKey')
        
        if not cpr_number:
            return error_response(500, 'Failed to extract CPR number from document', cpr_response)
        
        print(f"CPR extracted: {cpr_number}")
        print(f"Processed document: {processed_doc_key}")
        
        # Verify the processed document exists
        if processed_doc_key:
            try:
                s3.head_object(Bucket=BUCKET_NAME, Key=processed_doc_key)
                print(f"✓ Processed document verified in S3: {processed_doc_key}")
            except Exception as e:
                print(f"⚠ Processed document not found, will use original: {document_key}")
                processed_doc_key = None
        
        # ==========================================
        # STEP 2: CHECK FOR REFERENCE PHOTO
        # ==========================================
        print("\n=== Step 2: Checking for reference photo in global-assets ===")
        
        check_payload = {'cprNumber': cpr_number}
        print(f"Calling check_reference with: {json.dumps(check_payload)}")
        
        check_response = invoke_lambda(CHECK_REFERENCE_FUNCTION, check_payload)
        
        if check_response.get('statusCode') != 200:
            print(f"✗ Reference check failed: {json.dumps(check_response)}")
            return error_response(500, 'Failed to check reference photo', check_response)
        
        reference_exists = check_response.get('exists')
        reference_photo_key = check_response.get('referencePhotoKey')
        
        print(f"Reference photo exists: {reference_exists}")
        if reference_exists:
            print(f"Reference photo key: {reference_photo_key}")
        
        # ==========================================
        # STEP 3: GET OR EXTRACT REFERENCE PHOTO
        # ==========================================
        print("\n=== Step 3: Preparing reference photo ===")
        
        if reference_exists:
            print(f"✓ Using reference photo from global-assets: {reference_photo_key}")
            source_photo_key = reference_photo_key
            photo_source = "global-assets"
            extracted_face_key = None
        else:
            print("No reference photo found, extracting face from document...")
            
            extract_payload = {
                'caseId': case_id,
                'sessionId': session_id,
                'documentKey': processed_doc_key or document_key,
                'cprNumber': cpr_number
            }
            print(f"Calling extract_face with: {json.dumps(extract_payload)}")
            
            extract_response = invoke_lambda(EXTRACT_FACE_FUNCTION, extract_payload)
            
            if extract_response.get('statusCode') != 200:
                print(f"✗ Face extraction failed: {json.dumps(extract_response)}")
                return error_response(500, 'Failed to extract face from document', extract_response)
            
            source_photo_key = extract_response.get('extractedFaceKey')
            if not source_photo_key:
                return error_response(500, 'Failed to extract face from document', extract_response)
                
            extracted_face_key = source_photo_key
            photo_source = "extracted-from-document"
            
            print(f"✓ Face extracted: {source_photo_key}")
        
        # ==========================================
        # STEP 4: COMPARE FACES
        # ==========================================
        print("\n=== Step 4: Comparing faces ===")
        
        compare_payload = {
            'caseId': case_id,
            'sessionId': session_id,
            'sourcePhotoKey': source_photo_key,
            'targetPhotoKey': witness_photo_key,
            'cprNumber': cpr_number
        }
        print(f"Calling compare_faces with: {json.dumps(compare_payload)}")

        compare_response = invoke_lambda(COMPARE_FACES_FUNCTION, compare_payload)

        if compare_response.get('statusCode') != 200:
            print(f"✗ Face comparison failed: {json.dumps(compare_response)}")
            return error_response(500, 'Failed to compare faces', compare_response)
        
        print(f"Comparison complete. Match: {compare_response.get('match')}, Similarity: {compare_response.get('similarity')}%")
        
        # ==========================================
        # STEP 5: CREATE COMPREHENSIVE SUMMARY
        # ==========================================
        print("\n=== Step 5: Creating verification summary ===")
        
        verification_summary = {
            'caseId': case_id,
            'sessionId': session_id,
            'cprNumber': cpr_number,
            'timestamp': context.aws_request_id,
            'workflow': {
                'step1_extractCpr': {
                    'success': True,
                    'cprNumber': cpr_number,
                    'textractResultKey': textract_result_key,
                    'processedDocumentKey': processed_doc_key
                },
                'step2_checkReference': {
                    'referenceExists': reference_exists,
                    'referencePhotoKey': reference_photo_key
                },
                'step3_prepareReference': {
                    'photoSource': photo_source,
                    'sourcePhotoKey': source_photo_key,
                    'extractedFaceKey': extracted_face_key
                },
                'step4_compareFaces': {
                    'match': compare_response.get('match'),
                    'similarity': compare_response.get('similarity'),
                    'confidence': compare_response.get('confidence'),
                    'faceMatches': compare_response.get('faceMatches')
                }
            },
            'documents': {
                'originalDocument': document_key,
                'processedDocument': processed_doc_key,
                'sourcePhoto': source_photo_key,
                'witnessPhoto': witness_photo_key
            },
            'verificationResult': {
                'match': compare_response.get('match'),
                'similarity': compare_response.get('similarity'),
                'confidence': compare_response.get('confidence')
            }
        }
        
        # Save comprehensive summary
        summary_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/workflow-summary/complete-verification-summary.json"
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=summary_key,
            Body=json.dumps(verification_summary, default=str, indent=2),
            ContentType='application/json'
        )
        
        print(f"✓ Workflow complete. Summary saved to: {summary_key}")
        
        # ==========================================
        # RETURN RESPONSE
        # ==========================================
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'cprNumber': cpr_number,
                'photoSource': photo_source,
                'match': compare_response.get('match'),
                'similarity': compare_response.get('similarity'),
                'confidence': compare_response.get('confidence'),
                'workflowSummaryKey': summary_key,
                'verificationResultKey': compare_response.get('verificationResultKey')
            })
        }
        
    except Exception as e:
        print(f"✗ Error in identity verification workflow: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return error_response(500, 'Identity verification workflow failed', {
            'details': str(e),
            'traceback': traceback.format_exc()
        })


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def invoke_lambda(function_name, payload):
    """
    Invoke another Lambda function synchronously
    
    Args:
        function_name: Name or ARN of the Lambda function
        payload: Payload to pass to the function (will be wrapped in API Gateway format)
    
    Returns:
        Parsed Lambda response body
    """
    try:
        print(f"\n→ Invoking Lambda: {function_name}")
        
        # Wrap payload in API Gateway event format
        event_payload = {
            'body': json.dumps(payload),
            'headers': {
                'Content-Type': 'application/json'
            },
            'httpMethod': 'POST'
        }
        
        # Add pathParameters if it's a check_reference call
        if 'cprNumber' in payload and 'caseId' not in payload:
            event_payload['pathParameters'] = {'cpr': payload['cprNumber']}
        
        print(f"  Event payload: {json.dumps(event_payload, indent=2)}")
        
        response = lambda_client.invoke(
            FunctionName=function_name,
            InvocationType='RequestResponse',
            Payload=json.dumps(event_payload)
        )
        
        response_payload = json.loads(response['Payload'].read().decode('utf-8'))
        
        print(f"← Lambda {function_name} raw response: {json.dumps(response_payload, indent=2)}")
        
        # Parse the API Gateway response
        if 'body' in response_payload:
            body = json.loads(response_payload['body'])
            result = {
                'statusCode': response_payload.get('statusCode', 200),
                **body
            }
            print(f"← Parsed response: {json.dumps(result, indent=2)}")
            return result
        else:
            # Direct response (shouldn't happen with API Gateway format)
            print(f"← Direct response (no body wrapper): {json.dumps(response_payload, indent=2)}")
            return response_payload
            
    except Exception as e:
        print(f"✗ Error invoking Lambda {function_name}: {str(e)}")
        import traceback
        print(f"Invoke traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'error': f'Failed to invoke {function_name}',
            'details': str(e)
        }


def error_response(status_code, message, additional_data=None):
    """Helper function to create error responses"""
    body = {'error': message}
    if additional_data:
        body.update(additional_data)
    
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }