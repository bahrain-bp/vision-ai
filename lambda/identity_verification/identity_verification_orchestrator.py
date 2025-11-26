import json
import boto3
import os
import re
from datetime import datetime
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

rekognition = boto3.client('rekognition')
textract = boto3.client('textract')
s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Orchestrate complete identity verification workflow including cleanup
    
    POST /identity/verify - Main verification workflow
    DELETE /identity/cleanup - Cleanup previous verification files
    
    Verification Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "documentKey": "cases/.../documents/citizen-id-document_20250109-143000.jpg",
        "personPhotoKey": "cases/.../photos/witness-photo_20250109-143100.jpg",
        "personType": "witness",
        "personName": "John Doe",
        "manualOverride": false,
        "overrideReason": "",
        "attemptNumber": 1
    }
    
    Cleanup Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "personType": "witness",
        "attemptNumber": 1
    }
    """
    try:
        # Check if this is a cleanup request (DELETE method)
        if event.get('httpMethod') == 'DELETE':
            return handle_cleanup_request(event, context)
        else:
            # Default to verification workflow (POST method)
            return handle_verification_request(event, context)
            
    except Exception as e:
        logger.error(f"✗ CRITICAL ERROR in identity verification workflow: {str(e)}", exc_info=True)
        return error_response(500, 'Identity verification workflow failed', {
            'details': str(e)
        })


def handle_verification_request(event, context):
    """Handle identity verification workflow"""
    logger.info("=" * 60)
    logger.info("=== STARTING IDENTITY VERIFICATION WORKFLOW ===")
    logger.info("=" * 60)
    
    # Parse request body
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
    
    # Validate inputs
    if not all([case_id, session_id, document_key, person_photo_key]):
        logger.error("Missing required parameters")
        return error_response(400, 'caseId, sessionId, documentKey, and personPhotoKey are required')
    
    # Validate person type
    valid_person_types = ['witness', 'accused', 'victim']
    if person_type not in valid_person_types:
        logger.error(f"Invalid person type: {person_type}")
        return error_response(400, f'personType must be one of: {", ".join(valid_person_types)}')
    
    # Validate attempt number - ENFORCE MAX 3 ATTEMPTS
    if attempt_number > 3:
        logger.error(f"Maximum verification attempts exceeded: {attempt_number}")
        return error_response(400, 'Maximum verification attempts (3) exceeded. Please use manual override or end session.')
    
    # If manual override, validate reason
    if manual_override and not override_reason.strip():
        logger.error("Manual override requested but no reason provided")
        return error_response(400, 'overrideReason is required when manualOverride is true')
    
    # Verify files exist in S3 before proceeding
    logger.info("\n--- Verifying S3 objects exist ---")
    if not verify_s3_object_exists(document_key):
        return error_response(404, f'Document not found in S3: {document_key}')
    
    if not verify_s3_object_exists(person_photo_key):
        return error_response(404, f'Person photo not found in S3: {person_photo_key}')
    
    # ==========================================
    # STEP 1: EXTRACT CPR NUMBER AND NAME FROM DOCUMENT
    # ==========================================
    logger.info("\n" + "=" * 60)
    logger.info("STEP 1: Extracting CPR number and name from document")
    logger.info("=" * 60)
    
    extraction_result = extract_data_from_document(document_key)
    
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
    
    if manual_override and participant_name:
        final_person_name = participant_name
        final_cpr_number = participant_cpr if participant_cpr else cpr_number
        final_nationality = participant_nationality if participant_nationality else nationality
    else:
        final_person_name = person_name if person_name else extracted_name
        final_cpr_number = cpr_number
        final_nationality = nationality
    
    logger.info(f"✓ CPR extracted: {cpr_number}")
    logger.info(f"✓ Name extracted: {extracted_name}")
    logger.info(f"✓ Nationality extracted: {nationality}")
    logger.info(f"✓ Final person name: {final_person_name}")
    
    # Save Textract results
    textract_result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/extraction-results/{cpr_number}_textract-results.json"
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=textract_result_key,
        Body=json.dumps(extraction_result['rawResponse'], default=str, indent=2),
        ContentType='application/json'
    )
    logger.info(f"✓ Textract results saved to: {textract_result_key}")
    
    # ==========================================
    # STEP 2: CHECK FOR REFERENCE PHOTO AND GENERATE PRESIGNED URL
    # ==========================================
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
    
    # ==========================================
    # STEP 3: DETERMINE SOURCE PHOTO
    # ==========================================
    logger.info("\n" + "=" * 60)
    logger.info("STEP 3: Determining source photo for comparison")
    logger.info("=" * 60)
    
    if reference_exists:
        source_photo_key = reference_photo_key
        photo_source = "global-assets"
        logger.info(f"✓ Using reference photo from global-assets: {source_photo_key}")
    else:
        # Use the uploaded document directly 
        source_photo_key = document_key
        photo_source = "citizen-id-document"
        logger.info(f"✓ Using citizen ID document for comparison: {source_photo_key}")
    
    # ==========================================
    # STEP 4: COMPARE FACES (Skip if manual override)
    # ==========================================
    logger.info("\n" + "=" * 60)
    logger.info("STEP 4: Face comparison")
    logger.info("=" * 60)
    
    if manual_override:
        logger.info("⚠ Manual override enabled - skipping face comparison")
        comparison_result = {
            'success': True,
            'match': True,  # Force match due to manual override
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
            # Return user-friendly error message
            error_msg = comparison_result.get('error', 'Failed to compare faces')
            return error_response(400, error_msg, {'details': comparison_result.get('details', '')})
        
        logger.info(f"✓ Comparison complete. Match: {comparison_result['match']}, Similarity: {comparison_result.get('similarity', 0)}%")
    
    # ==========================================
    # STEP 5: UPDATE SESSION METADATA
    # ==========================================
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
        participant_nationality=participant_nationality if manual_override else None
    )
    
    logger.info(f"Session metadata updated")
    
    # ==========================================
    # STEP 6: CREATE VERIFICATION SUMMARY
    # ==========================================
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
    
    # Save verification summary
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
    
    # ==========================================
    # RETURN RESPONSE
    # ==========================================
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
    
    # Add reference photo presigned URL to response if it exists
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


def extract_data_from_document(document_key):
    """Extract CPR number and person name from document using Textract"""
    try:
        logger.info(f"Calling Textract for: {document_key}")
        
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
        logger.info(f"Full extracted text: {full_text[:200]}...")  # Log first 200 chars
        
        # Enhanced check: detect if this is just a person photo
        # Criteria: very little text AND no numbers (no CPR/ID numbers)
        has_significant_numbers = bool(re.search(r'\d{5,}', full_text))  # At least 5 consecutive digits
        
        if len(extracted_lines) < 3 and len(full_text) < 100 and not has_significant_numbers:
            logger.error("Document appears to be invalid")
            return {
                'success': False,
                'error': 'This appears to be invalid document. Please upload a valid CPR card or passport that contains identification information and numbers.',
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
        
        # Extract nationality with enhanced logic
        nationality = extract_nationality_from_text(extracted_lines, full_text)
        logger.info(f"Extracted nationality: {nationality}")
        
        # Extract name
        extracted_name = extract_name_from_text(extracted_lines, full_text)
        
        return {
            'success': True,
            'cprNumber': cpr_number,
            'extractedName': extracted_name,
            'nationality': nationality,
            'extractedText': full_text,
            'rawResponse': response
        }
        
    except textract.exceptions.InvalidParameterException as e:
        logger.error(f"Invalid parameter for Textract: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Unable to read the document. Please ensure you uploaded a valid document image (JPG, PNG) or PDF, not just a person photo.',
            'details': str(e)
        }
    except textract.exceptions.InvalidS3ObjectException as e:
        logger.error(f"Invalid S3 object for Textract: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Unable to process the uploaded document. Please ensure the file is a valid image or PDF format.',
            'details': str(e)
        }
    except textract.exceptions.DocumentTooLargeException as e:
        logger.error(f"Document too large: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'The document file is too large. Please upload a document smaller than 10MB.',
            'details': str(e)
        }
    except Exception as e:
        logger.error(f"Error extracting data from document: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Failed to extract information from the document. Please ensure you uploaded a valid identity document with clear text.',
            'details': str(e)
        }


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


def clean_nationality(nationality):
    """Clean and format extracted nationality - ENHANCED VERSION"""
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


def extract_name_from_text(lines, full_text):
    """Extract person name from document text"""
    try:
        name_keywords = ['Name', 'الاسم', 'name', 'NAME', 'Full Name']
        
        for i, line in enumerate(lines):
            for keyword in name_keywords:
                if keyword in line:
                    if ':' in line:
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            name = parts[1].strip()
                            if name and len(name) > 2:
                                return clean_name(name)
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if next_line and not any(char.isdigit() for char in next_line[:5]):
                            return clean_name(next_line)
        
        return "Unknown"
        
    except Exception as e:
        logger.error(f"Error extracting name: {str(e)}", exc_info=True)
        return "Unknown"


def clean_name(name):
    """Clean and format extracted name"""
    name = ' '.join(name.split())
    name = re.sub(r'[^\w\s-]', '', name)
    return name.title().strip()


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


def create_or_update_session_metadata(case_id, session_id, cpr_number, person_name, person_type, verification_result, nationality, attempt_number=1, manual_override=False, participant_name=None, participant_cpr=None, participant_nationality=None):
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
