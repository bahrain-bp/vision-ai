import json
import boto3
import os
import re
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

rekognition = boto3.client('rekognition')
textract = boto3.client('textract')
s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    try:
        if event.get('httpMethod') == 'DELETE':
            return handle_cleanup_request(event, context)
        else:
            return handle_verification_request(event, context)
    except Exception as e:
        logger.error(f"✗ CRITICAL ERROR in identity verification workflow: {str(e)}", exc_info=True)
        return error_response(500, 'Identity verification workflow failed', {'details': str(e)})

def handle_verification_request(event, context):
    logger.info("=" * 60)
    logger.info("=== STARTING IDENTITY VERIFICATION WORKFLOW ===")
    logger.info("=" * 60)

    body = json.loads(event.get('body', '{}'))
    case_id = body.get('caseId')
    session_id = body.get('sessionId')
    document_key = body.get('documentKey')
    person_photo_key = body.get('personPhotoKey')
    person_type = body.get('personType', 'witness')
    person_name = body.get('personName', '')
    manual_override = body.get('manualOverride', False)
    override_reason = body.get('overrideReason', '')
    attempt_number = body.get('attemptNumber', 1)
    participant_name = body.get('participantName', '')
    participant_cpr = body.get('participantCPR', '')
    participant_nationality = body.get('participantNationality', '')
    document_type = body.get('documentType', 'cpr')
    logger.info(f"Request Parameters:")
    logger.info(f"  - Case ID: {case_id}")
    logger.info(f"  - Session ID: {session_id}")
    logger.info(f"  - Person Type: {person_type}")
    logger.info(f"  - Person Name (provided): {person_name or 'Not provided - will extract'}")
    logger.info(f"  - Attempt Number: {attempt_number}")
    logger.info(f"  - Manual Override: {manual_override}")
    if manual_override:
        logger.info(f"  - Override Reason: {override_reason}")
    logger.info(f"  - Document Key: {document_key}")
    logger.info(f"  - Person Photo Key: {person_photo_key}")

    # Validate required inputs
    if not all([case_id, session_id, document_key, person_photo_key]):
        logger.error("Missing required parameters")
        return error_response(400, 'caseId, sessionId, documentKey, and personPhotoKey are required')

    # Validate person type
    valid_person_types = ['witness', 'accused', 'victim']
    if person_type not in valid_person_types:
        logger.error(f"Invalid person type: {person_type}")
        return error_response(400, f'personType must be one of: {", ".join(valid_person_types)}')
    
    if document_type not in ['cpr', 'passport']:
        return error_response(400, 'documentType must be "cpr" or "passport"')

    # Validate attempt number max 3 attempts
    if attempt_number > 3:
        logger.error(f"Maximum verification attempts exceeded: {attempt_number}")
        return error_response(400, 'Maximum verification attempts (3) exceeded. Please use manual override or end session.')

    # Prevent using same file for document and person photo
    if document_key == person_photo_key:
        logger.error("The documentKey and personPhotoKey cannot be the same file.")
        return error_response(400, "The document and person photo must be different files. Please upload distinct images.")

    # Validate manual override reason when override enabled
    if manual_override:
        if not override_reason or len(override_reason.strip()) < 10:
            logger.error("Manual override requested but overrideReason is missing or too short")
            return error_response(400, 'overrideReason must be at least 10 characters when manualOverride is true')

    # Verify files exist in S3
    logger.info("\n--- Verifying S3 objects exist ---")
    if not verify_s3_object_exists(document_key):
        return error_response(404, f'Document not found in S3: {document_key}')
    
    if not verify_s3_object_exists(person_photo_key):
        return error_response(404, f'Person photo not found in S3: {person_photo_key}')
    
        # Validate file extensions
    logger.info("\n--- Validating file extensions ---")
    allowed_extensions = ['.jpg', '.jpeg', '.png']

    document_ext = os.path.splitext(document_key)[1].lower()
    if document_ext not in allowed_extensions:
        logger.error(f"Invalid document file extension: {document_ext}")
        return error_response(400, f'Invalid document file type. Only JPG, JPEG, and PNG files are allowed. Uploaded: {document_ext}')

    person_photo_ext = os.path.splitext(person_photo_key)[1].lower()
    if person_photo_ext not in allowed_extensions:
        logger.error(f"Invalid person photo file extension: {person_photo_ext}")
        return error_response(400, f'Invalid person photo file type. Only JPG, JPEG, and PNG files are allowed. Uploaded: {person_photo_ext}')

    logger.info(f"✓ File extensions validated - Document: {document_ext}, Photo: {person_photo_ext}")
    
    # STEP 1: Extract CPR and Name OR Use Manual Data
    logger.info("\n" + "=" * 60)
    logger.info("STEP 1: Processing document data")
    logger.info("=" * 60)

    if manual_override:
        logger.info("Manual override enabled - using provided participant data")
        
        # Use manually provided data instead of extracting from document
        cpr_number = participant_cpr
        extracted_name = participant_name
        nationality = participant_nationality
        extracted_text = "Manual override - document validation skipped"
        
        # For manual override,  save some basic document info
        extraction_result = {
            'success': True,
            'cprNumber': cpr_number,
            'extractedName': extracted_name,
            'nationality': nationality,
            'extractedText': extracted_text,
            'rawResponse': {'manual_override': True}
        }
        
        logger.info(f"✓ Using manual data - CPR: {cpr_number}, Name: {extracted_name}, Nationality: {nationality}")
        
    else:
        # Normal flow: extract data from document
        logger.info("Extracting data from document using Textract")
        extraction_result = extract_data_from_document(document_key, document_type)
        if not extraction_result['success']:
            logger.error("Failed to extract data from document")
            return error_response(400, extraction_result.get('error', 'Failed to extract data from document'), {
                'details': extraction_result.get('details', ''),
                'extractedText': extraction_result.get('extractedText', '')
            })

        cpr_number = extraction_result['cprNumber']
        extracted_name = extraction_result['extractedName']
        extracted_text = extraction_result['extractedText']
        nationality = extraction_result.get('nationality', 'Unknown')
        logger.info(f"✓ Data extracted from document - CPR: {cpr_number}, Name: {extracted_name}, Nationality: {nationality}")

    # Determine final values to use
    if manual_override:
        # For manual override, always use the manually provided data
        final_person_name = participant_name
        final_cpr_number = participant_cpr
        final_nationality = participant_nationality
        logger.info(f"✓ Manual override - Using provided data: Name: {final_person_name}, CPR: {final_cpr_number}, Nationality: {final_nationality}")
    else:
        # Normal flow
        final_person_name = person_name if person_name else extracted_name
        final_cpr_number = cpr_number
        final_nationality = nationality
        logger.info(f"✓ Using extracted data: Name: {final_person_name}, CPR: {final_cpr_number}, Nationality: {final_nationality}")

    # Save extraction results (Textract or manual override)
    if manual_override:
        textract_result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/manual-override-results/{final_cpr_number}_manual-override.json"
        result_data = {
            'manualOverride': True,
            'participantName': participant_name,
            'participantCPR': participant_cpr,
            'participantNationality': participant_nationality,
            'overrideReason': override_reason,
            'timestamp': datetime.utcnow().isoformat()
        }
    else:
        textract_result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/extraction-results/{final_cpr_number}_textract-results.json"
        result_data = extraction_result['rawResponse']

    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=textract_result_key,
        Body=json.dumps(result_data, default=str, indent=2),
        ContentType='application/json'
    )
    logger.info(f"✓ Extraction results saved to: {textract_result_key}")

    # STEP 2: Check reference photo
    logger.info("\n" + "=" * 60)
    logger.info("STEP 2: Checking for reference photo in global-assets")
    logger.info("=" * 60)

    reference_result = check_reference_photo(cpr_number)
    reference_exists = reference_result['exists']
    reference_photo_key = reference_result.get('referencePhotoKey')
    reference_photo_url = reference_result.get('referencePhotoUrl')

    logger.info(f"Reference photo exists: {reference_exists}")
    if reference_exists:
        logger.info(f"Reference photo key: {reference_photo_key}")
        logger.info(f"Reference photo presigned URL generated (expires in 1 hour)")

    # STEP 3: Determine source photo
    logger.info("\n" + "=" * 60)
    logger.info("STEP 3: Determining source photo for comparison")
    logger.info("=" * 60)

    if reference_exists:
        source_photo_key = reference_photo_key
        photo_source = "global-assets"
        logger.info(f"✓ Using reference photo from global-assets: {source_photo_key}")
    else:
        source_photo_key = document_key
        photo_source = "citizen-id-document"
        logger.info(f"✓ Using citizen ID document for comparison: {source_photo_key}")

    # STEP 4: Face comparison (skip if manual override)
    logger.info("\n" + "=" * 60)
    logger.info("STEP 4: Face comparison")
    logger.info("=" * 60)

    if manual_override:
        logger.info("⚠ Manual override enabled - skipping face comparison")
        comparison_result = {
            'success': True,
            'match': True,
            'similarity': 0,
            'confidence': 'MANUAL_OVERRIDE',
            'faceMatches': 0,
            'manualOverride': True,
            'overrideReason': override_reason,
            'attemptNumber': attempt_number
        }
    else:
        comparison_result = compare_faces(
            source_photo_key=source_photo_key,
            target_photo_key=person_photo_key,
            case_id=case_id,
            session_id=session_id,
            cpr_number=cpr_number,
            person_type=person_type,
            attempt_number=attempt_number
        )

        if not comparison_result['success']:
            logger.error("Face comparison failed")
            error_msg = comparison_result.get('error', 'Failed to compare faces')
            return error_response(400, error_msg, {'details': comparison_result.get('details', '')})

        logger.info(f"✓ Comparison complete. Match: {comparison_result['match']}, Similarity: {comparison_result.get('similarity', 0)}%")

    # STEP 5: Update session metadata
    logger.info("\n" + "=" * 60)
    logger.info("STEP 5: Updating session metadata")
    logger.info("=" * 60)

    session_metadata = create_or_update_session_metadata(
        case_id=case_id,
        session_id=session_id,
        cpr_number=final_cpr_number,
        person_name=final_person_name,
        person_type=person_type,
        verification_result=comparison_result,
        nationality=final_nationality,
        attempt_number=attempt_number,
        manual_override=manual_override,
        participant_name=participant_name if manual_override else None,
        participant_cpr=participant_cpr if manual_override else None,
        participant_nationality=participant_nationality if manual_override else None,
        document_type=document_type
        
    )

    logger.info(f"Session metadata updated")

    # STEP 6: Create verification summary
    logger.info("\n" + "=" * 60)
    logger.info("STEP 6: Creating verification summary")
    logger.info("=" * 60)

    verification_summary = {
        'caseId': case_id,
        'sessionId': session_id,
        'cprNumber': final_cpr_number,
        'personType': person_type,
        'personName': final_person_name,
        'extractedName': extracted_name,
        'providedName': person_name,
        'manuallyEnteredName': participant_name if manual_override else None,
        'manuallyEnteredCPR': participant_cpr if manual_override else None,
        'manuallyEnteredNationality': participant_nationality if manual_override else None,
        'nationality': final_nationality,
        'documentType': document_type,
        'verificationTimestamp': datetime.utcnow().isoformat(),
        'attemptNumber': attempt_number,
        'manualOverride': manual_override,
        'overrideReason': override_reason if manual_override else None,
        'workflow': {
            'step1_extractData': {
                'success': True,
                'cprNumber': cpr_number,
                'extractedName': extracted_name,
                'nationality': nationality,
                'finalName': final_person_name,
                'extractedText': extracted_text[:500] + '...' if len(extracted_text) > 500 else extracted_text,
                'textractResultKey': textract_result_key
            },
            'step2_checkReference': {
                'referenceExists': reference_exists,
                'referencePhotoKey': reference_photo_key,
                'referencePhotoUrl': 'Presigned URL generated (expires in 1 hour)' if reference_photo_url else None
            },
            'step3_determineSource': {
                'photoSource': photo_source,
                'sourcePhotoKey': source_photo_key
            },
            'step4_compareFaces': {
                'match': comparison_result['match'],
                'similarity': comparison_result.get('similarity', 0),
                'confidence': comparison_result['confidence'],
                'faceMatches': comparison_result.get('faceMatches', 0),
                'manualOverride': manual_override
            }
        },
        'files': {
            'citizenIdDocument': document_key,
            'personPhoto': person_photo_key,
            'sourcePhotoUsed': source_photo_key,
            'textractResults': textract_result_key,
            'referencePhotoUrl': 'Presigned URL provided in response' if reference_photo_url else None
        },
        'verificationResult': {
            'match': comparison_result['match'],
            'similarity': comparison_result.get('similarity', 0),
            'confidence': comparison_result['confidence'],
            'photoSource': photo_source,
            'status': 'VERIFIED' if comparison_result['match'] else 'NOT_VERIFIED',
            'manualOverride': manual_override,
            'overrideReason': override_reason if manual_override else None
        }
    }

    summary_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/verification-summary_{person_type}_{cpr_number}_attempt{attempt_number}.json"

    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=summary_key,
        Body=json.dumps(verification_summary, default=str, indent=2),
        ContentType='application/json'
    )

    logger.info(f"Workflow complete. Summary saved to: {summary_key}")
    logger.info("=" * 60)
    logger.info("=== IDENTITY VERIFICATION WORKFLOW COMPLETED SUCCESSFULLY ===")
    logger.info("=" * 60)

    response_data = {
        'success': True,
        'cprNumber': final_cpr_number,
        'personType': person_type,
        'personName': final_person_name,
        'extractedName': extracted_name,
        'providedName': person_name,
        'nationality': final_nationality,
        'photoSource': photo_source,
        'match': comparison_result['match'],
        'similarity': comparison_result.get('similarity', 0),
        'confidence': comparison_result['confidence'],
        'status': 'VERIFIED' if comparison_result['match'] else 'NOT_VERIFIED',
        'attemptNumber': attempt_number,
        'manualOverride': manual_override,
        'overrideReason': override_reason if manual_override else None,
        'sessionMetadataKey': f"cases/{case_id}/sessions/{session_id}/session-metadata.json",
        'verificationSummaryKey': summary_key,
        'verificationResultKey': comparison_result.get('verificationResultKey')
    }

    if reference_exists and reference_photo_url:
        response_data['referencePhotoUrl'] = reference_photo_url
        logger.info(f"✓ Added reference photo presigned URL to response (expires in 1 hour)")

    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(response_data)
    }

def handle_cleanup_request(event, context):
    """Handle cleanup of previous verification files"""
    logger.info("=== Starting cleanup of previous verification files ===")
    
    # Parse request body
    body = json.loads(event.get('body', '{}'))
    case_id = body.get('caseId')
    session_id = body.get('sessionId')
    person_type = body.get('personType')
    attempt_number = body.get('attemptNumber', 1)
    
    logger.info(f"Cleanup parameters:")
    logger.info(f"  - Case ID: {case_id}")
    logger.info(f"  - Session ID: {session_id}")
    logger.info(f"  - Person Type: {person_type}")
    logger.info(f"  - Attempt Number: {attempt_number}")
    
    # Validate inputs
    if not all([case_id, session_id, person_type]):
        logger.error("Missing required parameters")
        return error_response(400, 'caseId, sessionId, and personType are required')
    
    # Define paths to delete
    base_path = f"cases/{case_id}/sessions/{session_id}/01-identity-verification"
    
    # Delete uploaded files from the current attempt
    files_to_delete = []
    
    # List all objects in the verification folders
    try:
        # Delete documents
        document_prefix = f"{base_path}/documents/"
        logger.info(f"Listing objects with prefix: {document_prefix}")
        
        response = s3.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=document_prefix
        )
        
        if 'Contents' in response:
            for obj in response['Contents']:
                files_to_delete.append(obj['Key'])
                logger.info(f"  - Found document: {obj['Key']}")
        
        # Delete person photos
        photo_prefix = f"{base_path}/photos/"
        logger.info(f"Listing objects with prefix: {photo_prefix}")
        
        response = s3.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=photo_prefix
        )
        
        if 'Contents' in response:
            for obj in response['Contents']:
                files_to_delete.append(obj['Key'])
                logger.info(f"  - Found photo: {obj['Key']}")
        
        # Delete verification results for current attempt if it exists
        if attempt_number > 0:
            result_prefix = f"{base_path}/verification-results/"
            logger.info(f"Listing verification results with prefix: {result_prefix}")
            
            response = s3.list_objects_v2(
                Bucket=BUCKET_NAME,
                Prefix=result_prefix
            )
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Delete results matching current attempt
                    if f"attempt{attempt_number}" in obj['Key']:
                        files_to_delete.append(obj['Key'])
                        logger.info(f"  - Found result to delete: {obj['Key']}")
        
    except Exception as e:
        logger.error(f"Error listing objects: {str(e)}", exc_info=True)
        return error_response(500, 'Failed to list files for cleanup', {'details': str(e)})
    
    # Delete all identified files
    deleted_count = 0
    failed_deletions = []
    
    for file_key in files_to_delete:
        try:
            logger.info(f"Deleting: {file_key}")
            s3.delete_object(
                Bucket=BUCKET_NAME,
                Key=file_key
            )
            deleted_count += 1
        except Exception as e:
            logger.error(f"Failed to delete {file_key}: {str(e)}")
            failed_deletions.append({
                'key': file_key,
                'error': str(e)
            })
    
    logger.info(f"Cleanup complete. Deleted {deleted_count} files.")
    
    if failed_deletions:
        logger.warning(f"Failed to delete {len(failed_deletions)} files")
    
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'success': True,
            'deletedCount': deleted_count,
            'failedDeletions': failed_deletions,
            'message': f'Cleanup complete. Deleted {deleted_count} files.'
        })
    }


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def verify_s3_object_exists(s3_key):
    """Check if an S3 object exists"""
    try:
        s3.head_object(Bucket=BUCKET_NAME, Key=s3_key)
        logger.info(f"Object exists in S3: {s3_key}")
        return True
    except Exception as e:
        logger.error(f"Object not found in S3: {s3_key} - {str(e)}")
        return False

def check_document_quality(document_key):
    """Check quality of document image before processing"""
    try:
        logger.info(f"Checking document quality for: {document_key}")
        
        quality_response = rekognition.detect_faces(
            Image={
                'S3Object': {
                    'Bucket': BUCKET_NAME,
                    'Name': document_key
                }
            },
            Attributes=['ALL']
        )
        
        if not quality_response.get('FaceDetails'):
            return {
                'success': False,
                'error': 'No face detected in the document. Please upload a clear ID document with a visible face photo.',
                'details': 'Face detection returned no results'
            }
        
        face_detail = quality_response['FaceDetails'][0]
        quality = face_detail.get('Quality', {})
        brightness = quality.get('Brightness', 0)
        sharpness = quality.get('Sharpness', 0)
        
        logger.info(f"Document quality - Brightness: {brightness}, Sharpness: {sharpness}")
        
        # Quality thresholds for documents
        if brightness < 35:
            return {
                'success': False,
                'error': 'The document image is too dark. Please take a photo in better lighting conditions.',
                'details': f'Brightness score: {brightness}/100 (minimum 35 required)'
            }
        
        
        if brightness > 95:
            return {
                'success': False,
                'error': 'The document image is overexposed (too bright). Please take a photo with better lighting.',
                'details': f'Brightness score: {brightness}/100 (maximum 95)'
            }
        
        logger.info(f"✓ Document quality check passed")
        return {
            'success': True,
            'brightness': brightness,
            'sharpness': sharpness
        }
        
    except rekognition.exceptions.InvalidImageFormatException as e:
        return {
            'success': False,
            'error': 'Invalid document image format. Please upload a valid JPG or PNG image.',
            'details': str(e)
        }
    except Exception as e:
        logger.warning(f"Document quality check failed: {str(e)}")
        # Continue with processing even if quality check fails
        return {'success': True}

def extract_data_from_document(document_key, document_type='cpr'):
    """Extract CPR number and person name from document using Textract"""
    try:
        # Check document quality first
        quality_check = check_document_quality(document_key)
        if not quality_check['success']:
            logger.error(f"Document quality check failed: {quality_check['error']}")
            return {
                'success': False,
                'error': quality_check['error'],
                'details': quality_check.get('details', ''),
                'extractedText': ''
            }
        

        logger.info(f"Calling Textract for: {document_key} (document_type: {document_type})")
        
        response = textract.detect_document_text(
            Document={
                'S3Object': {
                    'Bucket': BUCKET_NAME,
                    'Name': document_key
                }
            }
        )
        
        extracted_lines = []
        for block in response.get('Blocks', []):
            if block['BlockType'] == 'LINE':
                extracted_lines.append(block['Text'])
        
        full_text = ' '.join(extracted_lines)
        logger.info(f"Extracted {len(extracted_lines)} lines of text")
        
        # Log ALL extracted lines
        logger.info("=" * 80)
        logger.info("ALL EXTRACTED LINES FROM TEXTRACT:")
        logger.info("=" * 80)
        for idx, line in enumerate(extracted_lines):
            logger.info(f"Line {idx:3d}: {line}")
        logger.info("=" * 80)
        logger.info(f"FULL TEXT: {full_text}")
        logger.info("=" * 80)
        
        # Validate document is not just a photo
        has_significant_numbers = bool(re.search(r'\d{5,}', full_text))
        
        if len(extracted_lines) < 3 and len(full_text) < 100 and not has_significant_numbers:
            logger.error("Document appears to be invalid")
            return {
                'success': False,
                'error': 'This appears to be invalid document. Please upload a valid CPR card or passport that contains identification information and numbers.',
                'extractedText': full_text
            }
        
        # Validate document type matches uploaded document
        document_validation = validate_document_type(extracted_lines, full_text, document_type)
        if not document_validation['valid']:
            logger.error(f"Document type validation failed: {document_validation['error']}")
            return {
                'success': False,
                'error': document_validation['error'],
                'extractedText': full_text
            }
        
        # Extract CPR number (9 digits)
        cpr_pattern = r'\b\d{9}\b'
        cpr_matches = re.findall(cpr_pattern, full_text)
        
        if not cpr_matches:
            logger.error("CPR number not found in document")
            logger.error(f"Extracted text was: {full_text}")
            return {
                'success': False,
                'error': 'No CPR number (9 digits) found in the document. Please ensure you uploaded a valid CPR card or passport, not just a person photo.',
                'extractedText': full_text
            }
        
        cpr_number = cpr_matches[0]
        logger.info(f"Found CPR: {cpr_number}")
        
        # Extract nationality - For passports, prioritize MRZ
        if document_type == 'passport':
                    logger.info("Document is passport - prioritizing MRZ for nationality extraction")
                    nationality = extract_nationality_from_mrz(extracted_lines, full_text)
                    
                    # If MRZ extraction failed, fallback to text extraction
                    if not nationality or nationality == "Unknown":
                        logger.info("MRZ extraction failed, falling back to text extraction")
                        nationality = extract_nationality_from_text(extracted_lines, full_text)
        else:
            # For CPR cards, use text extraction
            logger.info("Document is CPR - using text extraction for nationality")
            nationality = extract_nationality_from_text(extracted_lines, full_text)
        
        logger.info(f"FINAL Extracted nationality: {nationality}")
        
        # Extract name using unified function
        extracted_name = extract_name_unified(extracted_lines, full_text, document_type)
        logger.info(f"FINAL EXTRACTED NAME: {extracted_name}")
        
        return {
            'success': True,
            'cprNumber': cpr_number,
            'extractedName': extracted_name,
            'nationality': nationality,
            'extractedText': full_text,
            'rawResponse': response
        }
        
    except Exception as e:
        logger.error(f"Error extracting data from document: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Failed to extract information from the document. Please ensure you uploaded a valid identity document with clear text.',
            'details': str(e)
        }
def validate_document_type(lines, full_text, expected_type):
    """Validate that uploaded document matches the expected type (CPR or Passport)"""
    try:
        # Keywords that indicate a CPR card
        cpr_indicators = [
            'KINGDOM OF BAHRAIN',
            'IDENTITY CARD',
            'البطاقة الشخصية',
            'Personal Number',
            'الرقم الشخصي'
        ]
        
        # Keywords that indicate a Passport
        passport_indicators = [
            'PASSPORT',
            'جواز سفر',
            'KINGDOM OF BAHRAIN-PASSPORT',
            'KINGDOM OF BAHRAIN - PASSPORT',
            'TYPE',
            'ISSUING STATE',
            'PASSPORT No',
            'NAME OF BEARER',
            'DATE OF EXPIRY'
        ]
        
        full_text_upper = full_text.upper()
        
        # Count indicators
        cpr_count = sum(1 for indicator in cpr_indicators if indicator.upper() in full_text_upper)
        passport_count = sum(1 for indicator in passport_indicators if indicator.upper() in full_text_upper)
        
        logger.info(f"Document validation - CPR indicators: {cpr_count}, Passport indicators: {passport_count}")
        
        # Determine detected document type
        if passport_count >= 2:
            detected_type = 'passport'
        elif cpr_count >= 1:
            detected_type = 'cpr'
        else:
            # Cannot reliably determine - allow it but log warning
            logger.warning("Could not reliably determine document type from text")
            return {'valid': True}
        
        # Validate match
        if expected_type == 'passport' and detected_type == 'cpr':
            return {
                'valid': False,
                'error': f'Document type mismatch: You selected Passport but uploaded a CPR card. Please upload a valid passport document or change document type to CPR.'
            }
        
        if expected_type == 'cpr' and detected_type == 'passport':
            return {
                'valid': False,
                'error': f'Document type mismatch: You selected CPR but uploaded a Passport. Please upload a valid CPR card or change document type to Passport.'
            }
        
        logger.info(f"Document type validation passed: expected {expected_type}, detected {detected_type}")
        return {'valid': True}
        
    except Exception as e:
        logger.error(f"Error in document type validation: {str(e)}")
        # Don't block the process if validation fails
        return {'valid': True}

def extract_name_unified(lines, full_text, document_type):
    """Unified function to extract person name from both CPR and Passport documents"""
    try:
        if document_type == 'passport':
            logger.info("=== PASSPORT NAME EXTRACTION START ===")
            logger.info(f"Total lines extracted: {len(lines)}")
            
            # Log all lines for debugging
            for idx, line in enumerate(lines):
                logger.info(f"Line {idx}: {line}")
            
            # METHOD 1 (HIGHEST PRIORITY): Parse from Machine Readable Zone (MRZ)
            logger.info("Trying MRZ extraction method (PRIORITY 1)...")
            
            for line in lines:
                # Look for MRZ line starting with PCBHR
                if 'PCBHR' in line.upper():
                    logger.info(f"Found MRZ line: {line}")
                    
                    # Extract the name part
                    # Format: PCBHR[SURNAME]<<[GIVEN_NAMES_WITH_<_SEPARATORS]
                    mrz_pattern = r'PCBHR([A-Z]+)<+([A-Z<]+)'
                    match = re.search(mrz_pattern, line.upper())
                    
                    if match:
                        surname = match.group(1)  
                        given_names_raw = match.group(2)  
                        
                        # Clean up: remove trailing < and replace < with spaces
                        given_names = given_names_raw.rstrip('<').replace('<', ' ').strip()
                        
                        # Combine: Given names + Surname (Western order)
                        full_name = f"{given_names} {surname}"
                        cleaned_name = clean_name(full_name)
                        
                        logger.info(f"✓ Extracted name from MRZ: {cleaned_name}")
                        return cleaned_name
            
            # METHOD 2: Look for "NAME OF BEARER" and extract a valid name from subsequent lines
            logger.info("MRZ not found, trying NAME OF BEARER method (PRIORITY 2)...")
            
            for i, line in enumerate(lines):
                line_upper = line.upper().strip()
                
                if 'NAME OF BEARER' in line_upper:
                    logger.info(f"Found 'NAME OF BEARER' at line {i}: {line}")
                    
                    # Search the next 3 lines for a valid name
                    for offset in range(1, 4):
                        if i + offset >= len(lines):
                            break
                        
                        candidate_line = lines[i + offset].strip()
                        logger.info(f"Checking line {i + offset}: {candidate_line}")
                        
                        # Remove Arabic text if present
                        candidate_cleaned = re.sub(r'[\u0600-\u06FF]+', '', candidate_line).strip()
                        
                        # Validate: must be all letters, at least 3 words, minimum 15 characters
                        # Remove special characters for validation
                        alpha_only = re.sub(r'[^A-Za-z\s]', '', candidate_cleaned)
                        
                        if (alpha_only and 
                            len(alpha_only) >= 15 and  # Minimum length
                            len(alpha_only.split()) >= 3 and  # At least 3 words (typical Arabic names)
                            not any(keyword in alpha_only.upper() for keyword in 
                                   ['NATIONALITY', 'BAHRAINI', 'DATE', 'BIRTH', 'OCCUPATION', 'PLACE'])):
                            
                            cleaned_name = clean_name(alpha_only)
                            logger.info(f"✓ Extracted name from NAME OF BEARER method: {cleaned_name}")
                            return cleaned_name
            
            # METHOD 3: Look for a line with all uppercase letters (backup)
            logger.info("Trying uppercase letter pattern method (PRIORITY 3)...")
            
            for i, line in enumerate(lines):
                line_stripped = line.strip()
                
                # Remove Arabic characters
                line_no_arabic = re.sub(r'[\u0600-\u06FF\s]+', '', line_stripped)
                
             
                if (line_no_arabic and
                    line_no_arabic.isupper() and
                    line_no_arabic.isalpha() and
                    len(line_no_arabic) >= 15 and
                    len(line_stripped.split()) >= 3):
                    
                    # Exclude headers
                    excluded_keywords = ['KINGDOM', 'BAHRAIN', 'PASSPORT', 'NATIONALITY', 
                                       'DATE OF BIRTH', 'NAME OF BEARER', 'PLACE OF BIRTH',
                                       'DATE OF ISSUE', 'DATE OF EXPIRY', 'OCCUPATION', 'ISSUING']
                    
                    if not any(keyword in line_stripped.upper() for keyword in excluded_keywords):
                        cleaned_name = clean_name(line_stripped)
                        logger.info(f"✓ Extracted name from uppercase pattern: {cleaned_name}")
                        return cleaned_name
            
            logger.warning("Could not extract name from passport using any method")
        
        # CPR extraction or fallback
        logger.info("=== CPR NAME EXTRACTION START ===")
        name_keywords = ['Name', 'الاسم', 'name', 'NAME', 'Full Name', 'Names']
        
        for i, line in enumerate(lines):
            for keyword in name_keywords:
                if keyword in line:
                    logger.info(f"Found name keyword '{keyword}' in line: {line}")
                    
                    # Check if name is on the same line after colon
                    if ':' in line:
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            name = parts[1].strip()
                            if name and len(name) > 2:
                                cleaned_name = clean_name(name)
                                if cleaned_name != "Unknown":
                                    logger.info(f"✓ Extracted name from CPR (same line): {cleaned_name}")
                                    return cleaned_name
                    
                    # Check the next line
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        
                        if (next_line and 
                            not any(char.isdigit() for char in next_line[:5]) and
                            len(next_line) > 2):
                            cleaned_name = clean_name(next_line)
                            if cleaned_name and cleaned_name != "Unknown":
                                logger.info(f"✓ Extracted name from CPR (next line): {cleaned_name}")
                                return cleaned_name
        
        logger.warning("Could not extract name from document")
        return "Unknown"
        
    except Exception as e:
        logger.error(f"Error extracting name: {str(e)}", exc_info=True)
        return "Unknown"
def extract_nationality_from_text(lines, full_text):
    """Extract nationality from document text - ENHANCED VERSION"""
    try:
        # Method 1: Look for nationality keywords in both English and Arabic
        nationality_keywords = [
            'Nationality', 'الجنسية', 'nationality', 'NATIONALITY',
            'Nat.', 'NAT.', 'nat.'
        ]
        
        # First pass: Look for keyword followed by value on same line or next line
        for i, line in enumerate(lines):
            for keyword in nationality_keywords:
                if keyword in line:
                    logger.info(f"Found nationality keyword '{keyword}' in line: {line}")
                    
                    # Check if nationality is on the same line after the keyword
                    if ':' in line:
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            nationality = parts[1].strip()
                            if nationality and len(nationality) > 2 and not nationality.isdigit():
                                cleaned = clean_nationality(nationality)
                                if cleaned and cleaned != 'Unknown':
                                    logger.info(f"Extracted nationality from same line: {cleaned}")
                                    return cleaned
                    
                    # Check the next line
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        logger.info(f"Checking next line for nationality: {next_line}")
                        
                        if next_line and not any(char.isdigit() for char in next_line[:5]):
                            cleaned = clean_nationality(next_line)
                            if cleaned and cleaned != 'Unknown':
                                logger.info(f"Extracted nationality from next line: {cleaned}")
                                return cleaned
        
        # Method 2: Look for common nationality patterns (country names)
        common_nationalities = [
            'Indian', 'INDIAN', 'هندي',
            'Pakistani', 'PAKISTANI', 'باكستاني',
            'Bangladeshi', 'BANGLADESHI', 'بنغلاديشي',
            'Filipino', 'FILIPINO', 'فلبيني',
            'Egyptian', 'EGYPTIAN', 'مصري',
            'Bahraini', 'BAHRAINI', 'بحريني',
            'Saudi', 'SAUDI', 'سعودي',
            'Emirati', 'EMIRATI', 'إماراتي'
        ]
        
        for nationality in common_nationalities:
            if nationality in full_text:
                cleaned = clean_nationality(nationality)
                logger.info(f"Found nationality by pattern matching: {cleaned}")
                return cleaned
        
        # Method 3: Look for text that appears between "Nationality" and "Name" sections
        nationality_match = re.search(
            r'(?:Nationality|الجنسية|NATIONALITY|NAT\.)[:\s]*([A-Za-z\u0600-\u06FF\s]+?)(?:\s*(?:Name|الاسم|NAME)|$)',
            full_text,
            re.IGNORECASE | re.UNICODE
        )
        
        if nationality_match:
            extracted = nationality_match.group(1).strip()
            logger.info(f"Found nationality by regex pattern: {extracted}")
            cleaned = clean_nationality(extracted)
            if cleaned and cleaned != 'Unknown':
                return cleaned
        
        logger.warning("Could not extract nationality from document")
        return "Unknown"
        
    except Exception as e:
        logger.error(f"Error extracting nationality: {str(e)}", exc_info=True)
        return "Unknown"

def extract_nationality_from_mrz(lines, full_text):
    """Extract nationality from passport MRZ (Machine Readable Zone)"""
    try:
        logger.info("=== SIMPLIFIED MRZ NATIONALITY EXTRACTION ===")
        
        # MRZ nationality codes mapping
        mrz_nationality_codes = {
            'BHR': 'Bahraini',
            'IND': 'Indian',
            'PAK': 'Pakistani',
            'BGD': 'Bangladeshi',
            'PHL': 'Filipino',
            'EGY': 'Egyptian',
            'SAU': 'Saudi',
            'ARE': 'Emirati',
            'NPL': 'Nepali',
            'LKA': 'Sri Lankan',
            'JOR': 'Jordanian',
            'LBN': 'Lebanese',
            'SYR': 'Syrian',
            'IRQ': 'Iraqi',
            'KWT': 'Kuwaiti',
            'OMN': 'Omani',
            'QAT': 'Qatari',
            'YEM': 'Yemeni',
            'SDN': 'Sudanese',
            'CHN': 'Chinese',
            'IDN': 'Indonesian',
            'MYS': 'Malaysian',
            'THA': 'Thai',
            'VNM': 'Vietnamese',
            'GBR': 'British',
            'USA': 'American',
            'CAN': 'Canadian',
            'AUS': 'Australian',
            'FRA': 'French',
            'DEU': 'German',
            'ITA': 'Italian',
            'ESP': 'Spanish',
            'JPN': 'Japanese',
            'KOR': 'Korean'
        }
        
        logger.info("Searching for MRZ lines...")
        
        # METHOD 1: Look for first MRZ line (starts with P< or PC)
        for line in lines:
            line_stripped = line.strip()
            
            # Check if line starts with passport MRZ pattern
            if line_stripped.startswith('P<') or line_stripped.startswith('PC'):
                logger.info(f"Found MRZ line: {line_stripped}")
                
                # The country code is ALWAYS positions 2-4 (indices 2,3,4)
                # P<BHR... or PCBHR...
                if len(line_stripped) >= 5:
                    country_code = line_stripped[2:5].upper()
                    logger.info(f"Extracted country code from positions 2-4: '{country_code}'")
                    
                    if country_code in mrz_nationality_codes:
                        nationality = mrz_nationality_codes[country_code]
                        logger.info(f"✓ Found nationality from MRZ first line: {nationality}")
                        return nationality
        
        # METHOD 2: Fallback - search for 3-letter codes in full text
        # This handles cases where the MRZ format might be slightly different
        text_upper = full_text.upper()
        logger.info(f"Falling back to full text search: {text_upper}")
        
        # Look for common patterns:
        # 1. Digit followed by 3 uppercase letters 
        pattern = r'\d([A-Z]{3})'
        matches = re.findall(pattern, text_upper)
        
        for code in matches:
            if code in mrz_nationality_codes:
                logger.info(f"✓ Found pattern 'digit+{code}' in text")
                nationality = mrz_nationality_codes[code]
                logger.info(f"  Returning: {nationality}")
                return nationality
        
        # 2. Just look for any 3-letter country code
        for code in ['BHR', 'IND', 'PAK', 'BGD', 'PHL', 'EGY', 'SAU', 'ARE']:
            if code in text_upper:
                nationality = mrz_nationality_codes.get(code)
                if nationality:
                    logger.info(f"✓ Found country code '{code}' in text")
                    logger.info(f"  Returning: {nationality}")
                    return nationality
        
        logger.info("✗ No nationality found in MRZ")
        return None
        
    except Exception as e:
        logger.error(f"Error extracting nationality from MRZ: {str(e)}")
        return None
    
def clean_nationality(nationality):
    """Clean and format extracted nationality"""
    if not nationality:
        return "Unknown"
    
    # Remove extra whitespace
    nationality = ' '.join(nationality.split())
    
    # Remove special characters but keep Arabic characters
    nationality = re.sub(r'[^\w\s\-\u0600-\u06FF]', '', nationality)
    
    # Remove any remaining numbers
    nationality = re.sub(r'\d+', '', nationality)
    
    # Strip whitespace
    nationality = nationality.strip()
    
    # Filter out invalid entries
    invalid_entries = ['', 'Unknown', 'N/A', 'NA', '-']
    if nationality in invalid_entries or len(nationality) < 3:
        return "Unknown"
    
    # Capitalize properly (handle both English and Arabic)
    if re.search(r'[A-Za-z]', nationality):  # If contains English letters
        nationality = nationality.title()
    
    return nationality



def clean_name(name):
    """Clean and format extracted name"""
    if not name:
        return "Unknown"
    
    # Remove Arabic characters
    name = re.sub(r'[\u0600-\u06FF]+', '', name)
    
    # Remove extra whitespace
    name = ' '.join(name.split())
    
    # Remove special characters but keep spaces and hyphens
    name = re.sub(r'[^\w\s\-]', '', name)
    
    # Remove any digits
    name = re.sub(r'\d+', '', name)
    
    # Remove common non-name words that might appear
    excluded_words = ['KINGDOM', 'BAHRAIN', 'PASSPORT', 'NAME', 'BEARER', 
                     'NATIONALITY', 'DATE', 'BIRTH', 'ISSUE', 'EXPIRY']
    
    words = name.split()
    cleaned_words = [word for word in words if word.upper() not in excluded_words]
    name = ' '.join(cleaned_words)
    
    name = name.strip()
    
    # Validate
    if not name or len(name) < 3:
        return "Unknown"
    
    # Title case for proper capitalization
    return name.title()

def check_reference_photo(cpr_number):
    """Check if reference photo exists in global-assets and generate presigned URL"""
    try:
        possible_extensions = ['.jpg', '.jpeg', '.png']
        found_key = None

        for ext in possible_extensions:
            reference_key = f"global-assets/reference-photos/{cpr_number}_reference-photo{ext}"
            
            try:
                s3.head_object(Bucket=BUCKET_NAME, Key=reference_key)
                found_key = reference_key
                logger.info(f"Reference photo found: {reference_key}")
                break
            except s3.exceptions.ClientError as e:
                if e.response['Error']['Code'] == '404':
                    continue
                else:
                    logger.warning(f"Error checking {reference_key}: {str(e)}")
                    continue
        
        exists = found_key is not None
        
        # Generate presigned URL if reference photo exists (expires in 1 hour)
        reference_photo_url = None
        if exists:
            reference_photo_url = s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': BUCKET_NAME,
                    'Key': found_key
                },
                ExpiresIn=3600  # 1 hour
            )
            logger.info(f"Generated presigned URL for reference photo (expires in 1 hour)")
        
        return {
            'exists': exists,
            'referencePhotoKey': found_key,
            'referencePhotoUrl': reference_photo_url,
            'cprNumber': cpr_number
        }
        
    except Exception as e:
        logger.error(f"Error checking reference photo: {str(e)}", exc_info=True)
        return {
            'exists': False,
            'error': 'Failed to check reference photo',
            'details': str(e)
        }


def compare_faces(source_photo_key, target_photo_key, case_id, session_id, cpr_number, person_type, attempt_number=1):
    """Compare two faces using Rekognition"""
    try:
        logger.info(f"Comparing faces (Attempt {attempt_number}):")
        logger.info(f"  Source: {source_photo_key}")
        logger.info(f"  Target: {target_photo_key}")

        # Detect face quality in target photo
        try:
            quality_response = rekognition.detect_faces(
                Image={
                    'S3Object': {
                        'Bucket': BUCKET_NAME,
                        'Name': target_photo_key
                    }
                },
                Attributes=['ALL']
            )
            
            if quality_response.get('FaceDetails'):
                face_detail = quality_response['FaceDetails'][0]
                quality = face_detail.get('Quality', {})
                brightness = quality.get('Brightness', 0)
                sharpness = quality.get('Sharpness', 0)
                
                logger.info(f"Face quality check - Brightness: {brightness}, Sharpness: {sharpness}")
                
                # Check if photo quality is too poor
                if brightness < 40:
                    return {
                        'success': False,
                        'error': 'The person photo is too dark. Please upload a clearer, well-lit photo.',
                        'details': f'Brightness score: {brightness}/100 (minimum 40 required)'
                    }
                
                if sharpness < 30:
                    return {
                        'success': False,
                        'error': 'The person photo is too blurry. Please upload a sharper, clearer photo.',
                        'details': f'Sharpness score: {sharpness}/100 (minimum 30 required)'
                    }
                
                if brightness > 95:
                    return {
                        'success': False,
                        'error': 'The person photo is overexposed (too bright). Please upload a photo with better lighting.',
                        'details': f'Brightness score: {brightness}/100 (maximum 95)'
                    }
            else:
                # No face detected in uploaded photo
                return {
                    'success': False,
                    'error': 'No face detected in the uploaded photo. Please upload a clear photo showing the person\'s face.',
                    'details': 'Face detection returned no results'
                }
        except rekognition.exceptions.InvalidImageFormatException as e:
            return {
                'success': False,
                'error': 'Invalid image format. Please upload a valid JPG or PNG image.',
                'details': str(e)
            }
        except Exception as quality_error:
            logger.warning(f"Face quality check failed: {str(quality_error)}")
            # Continue with comparison even if quality check fails
        
        # Perform face comparison
        try:
            response = rekognition.compare_faces(
                SourceImage={
                    'S3Object': {
                        'Bucket': BUCKET_NAME,
                        'Name': source_photo_key
                    }
                },
                TargetImage={
                    'S3Object': {
                        'Bucket': BUCKET_NAME,
                        'Name': target_photo_key
                    }
                },
                SimilarityThreshold=70
            )
        except rekognition.exceptions.InvalidParameterException as e:
            error_msg = str(e)
            if 'face' in error_msg.lower():
                return {
                    'success': False,
                    'error': 'Could not detect a face in one or both images. Please ensure both the document and person photo contain clear, visible faces.',
                    'details': error_msg
                }
            return {
                'success': False,
                'error': 'The uploaded photos are different persons or faces cannot be clearly detected. Please ensure you upload matching photos.',
                'details': error_msg
            }
        except rekognition.exceptions.InvalidImageFormatException as e:
            return {
                'success': False,
                'error': 'Invalid image format detected. Please upload valid JPG or PNG images.',
                'details': str(e)
            }
        except rekognition.exceptions.ImageTooLargeException as e:
            return {
                'success': False,
                'error': 'One of the images is too large. Please upload images smaller than 15MB.',
                'details': str(e)
            }
        
        face_matches = response.get('FaceMatches', [])
        unmatched_faces = response.get('UnmatchedFaces', [])
        
        # Check if faces were found but didn't match
        if not face_matches and unmatched_faces:
            return {
                'success': False,
                'error': 'The uploaded photos appear to be of different persons. Face comparison shows no match between the document and person photo.',
                'details': f'Found {len(unmatched_faces)} unmatched face(s)'
            }
        
        if face_matches:
            similarity = face_matches[0]['Similarity']
            is_match = similarity >= 95.0
            
            result = {
                'success': True,
                'match': is_match,
                'similarity': round(similarity, 2),
                'confidence': 'HIGH' if similarity >= 95 else 'MEDIUM',
                'faceMatches': len(face_matches),
                'attemptNumber': attempt_number
            }
        else:
            result = {
                'success': True,
                'match': False,
                'similarity': 0,
                'confidence': 'LOW',
                'faceMatches': 0,
                'attemptNumber': attempt_number
            }
        
        # Save results
        result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/verification-results/{person_type}_{cpr_number}_comparison-result_attempt{attempt_number}.json"
        
        verification_result = {
            'cprNumber': cpr_number,
            'personType': person_type,
            'attemptNumber': attempt_number,
            'comparisonTimestamp': datetime.utcnow().isoformat(),
            'sourcePhoto': source_photo_key,
            'targetPhoto': target_photo_key,
            'result': result,
            'rawRekognitionResponse': response
        }
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=result_key,
            Body=json.dumps(verification_result, default=str, indent=2),
            ContentType='application/json'
        )
        
        result['verificationResultKey'] = result_key
        
        return result
        
    except Exception as e:
        logger.error(f"Error comparing faces: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Failed to compare faces. Please try again with different photos or contact support if the issue persists.',
            'details': str(e)
        }


def create_or_update_session_metadata(case_id, session_id, cpr_number, person_name, person_type, verification_result, nationality, attempt_number=1, manual_override=False, participant_name=None, participant_cpr=None, participant_nationality=None, document_type='cpr'):
    """Update existing session metadata with verification results"""
    try:
        metadata_key = f"cases/{case_id}/sessions/{session_id}/session-metadata.json"

        # Get existing session metadata 
        try:
            response = s3.get_object(Bucket=BUCKET_NAME, Key=metadata_key)
            existing_metadata = json.loads(response['Body'].read().decode('utf-8'))
        except s3.exceptions.NoSuchKey:
            logger.error(f"Session metadata not found: {metadata_key}")
            return None
        
        current_timestamp = datetime.utcnow().isoformat()
        
        # Create verification entry
        verification_entry = {
            'personType': person_type,
            'personName': person_name,
            'cprNumber': cpr_number,
            'nationality': nationality,
            'documentType': document_type ,
            'attemptNumber': attempt_number,
            'verificationTimestamp': current_timestamp,
            'match': verification_result['match'],
            'similarity': verification_result.get('similarity', 0),
            'confidence': verification_result['confidence'],
            'status': 'VERIFIED' if verification_result['match'] else 'NOT_VERIFIED',
            'manualOverride': manual_override,
            'overrideReason': verification_result.get('overrideReason'),
            'manuallyEnteredName': participant_name if manual_override else None,
            'manuallyEnteredCPR': participant_cpr if manual_override else None,
            'manuallyEnteredNationality': participant_nationality if manual_override else None

        }
        # Update the existing metadata
        metadata = existing_metadata
        metadata['lastUpdated'] = current_timestamp
        
        # Initialize verifications array if it doesn't exist
        if 'verifications' not in metadata:
            metadata['verifications'] = []
        
        # Add new verification entry
        metadata['verifications'].append(verification_entry)
        
        # Update primary person information with the first successful verification
        if verification_result['match'] and not metadata['primaryPerson'].get('cprNumber'):
            metadata['primaryPerson'] = {
                'cprNumber': cpr_number,
                'personName': person_name,
                'personType': person_type,
                'nationality': nationality
            }
        
        # Save updated metadata
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=metadata_key,
            Body=json.dumps(metadata, indent=2),
            ContentType='application/json'
        )
        
        logger.info(f"✓ Session metadata updated with verification results")
        return metadata
        
    except Exception as e:
        logger.error(f"Error updating session metadata: {str(e)}", exc_info=True)
        return None


def error_response(status_code, message, additional_data=None):
    """Helper function to create error responses"""
    body = {'error': message}
    if additional_data:
        body.update(additional_data)

    logger.error(f"Returning error response: {status_code} - {message}")

    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }
