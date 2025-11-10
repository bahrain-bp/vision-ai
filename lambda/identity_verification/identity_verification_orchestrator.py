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
    Orchestrate complete identity verification workflow
    
    POST /identity/verify
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "documentKey": "cases/.../documents/citizen-id-document_20250109-143000.jpg",
        "personPhotoKey": "cases/.../photos/witness-photo_20250109-143100.jpg",
        "personType": "witness",  # "witness", "accused", or "victim"
        "personName": "John Doe"  # Optional - will be extracted from document if not provided
    }
    """
    try:
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
        
        logger.info(f"Request Parameters:")
        logger.info(f"  - Case ID: {case_id}")
        logger.info(f"  - Session ID: {session_id}")
        logger.info(f"  - Person Type: {person_type}")
        logger.info(f"  - Person Name (provided): {person_name or 'Not provided - will extract'}")
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
            return error_response(500, 'Failed to extract data from document', extraction_result)
        
        cpr_number = extraction_result['cprNumber']
        extracted_name = extraction_result['extractedName']
        extracted_text = extraction_result['extractedText']
        nationality = extraction_result.get('nationality', 'Unknown')
        
        # Use provided name or extracted name
        final_person_name = person_name if person_name else extracted_name
        
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
        # STEP 2: CHECK FOR REFERENCE PHOTO
        # ==========================================
        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: Checking for reference photo in global-assets")
        logger.info("=" * 60)
        
        reference_result = check_reference_photo(cpr_number)
        reference_exists = reference_result['exists']
        reference_photo_key = reference_result.get('referencePhotoKey')
        
        logger.info(f"Reference photo exists: {reference_exists}")
        if reference_exists:
            logger.info(f"Reference photo key: {reference_photo_key}")
        
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
        # STEP 4: COMPARE FACES
        # ==========================================
        logger.info("\n" + "=" * 60)
        logger.info("STEP 4: Comparing faces")
        logger.info("=" * 60)
        
        comparison_result = compare_faces(
            source_photo_key=source_photo_key,
            target_photo_key=person_photo_key,
            case_id=case_id,
            session_id=session_id,
            cpr_number=cpr_number,
            person_type=person_type
        )
        
        if not comparison_result['success']:
            logger.error("Face comparison failed")
            return error_response(500, 'Failed to compare faces', comparison_result)
        
        logger.info(f"✓ Comparison complete. Match: {comparison_result['match']}, Similarity: {comparison_result['similarity']}%")
        
        # ==========================================
        # STEP 5: UPDATE SESSION METADATA
        # ==========================================
        logger.info("\n" + "=" * 60)
        logger.info("STEP 5: Updating session metadata")
        logger.info("=" * 60)
        
        session_metadata = create_or_update_session_metadata(
            case_id=case_id,
            session_id=session_id,
            cpr_number=cpr_number,
            person_name=final_person_name,
            person_type=person_type,
            verification_result=comparison_result,
            nationality=nationality
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
            'cprNumber': cpr_number,
            'personType': person_type,
            'personName': final_person_name,
            'extractedName': extracted_name,
            'providedName': person_name,
            'nationality': nationality,
            'verificationTimestamp': datetime.utcnow().isoformat(),
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
                    'referencePhotoKey': reference_photo_key
                },
                'step3_determineSource': {
                    'photoSource': photo_source,
                    'sourcePhotoKey': source_photo_key
                },
                'step4_compareFaces': {
                    'match': comparison_result['match'],
                    'similarity': comparison_result['similarity'],
                    'confidence': comparison_result['confidence'],
                    'faceMatches': comparison_result.get('faceMatches', 0)
                }
            },
            'files': {
                'citizenIdDocument': document_key,
                'personPhoto': person_photo_key,
                'sourcePhotoUsed': source_photo_key,
                'textractResults': textract_result_key
            },
            'verificationResult': {
                'match': comparison_result['match'],
                'similarity': comparison_result['similarity'],
                'confidence': comparison_result['confidence'],
                'photoSource': photo_source,
                'status': 'VERIFIED' if comparison_result['match'] else 'NOT_VERIFIED'
            }
        }
        
        # Save verification summary
        summary_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/verification-summary_{person_type}_{cpr_number}.json"
        
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
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'cprNumber': cpr_number,
                'personType': person_type,
                'personName': final_person_name,
                'extractedName': extracted_name,
                'providedName': person_name,
                'nationality': nationality,
                'photoSource': photo_source,
                'match': comparison_result['match'],
                'similarity': comparison_result['similarity'],
                'confidence': comparison_result['confidence'],
                'status': 'VERIFIED' if comparison_result['match'] else 'NOT_VERIFIED',
                'sessionMetadataKey': f"cases/{case_id}/sessions/{session_id}/session-metadata.json",
                'verificationSummaryKey': summary_key,
                'verificationResultKey': comparison_result.get('verificationResultKey')
            })
        }
        
    except Exception as e:
        logger.error(f"✗ CRITICAL ERROR in identity verification workflow: {str(e)}", exc_info=True)
        return error_response(500, 'Identity verification workflow failed', {
            'details': str(e)
        })


# ==========================================
# HELPER FUNCTIONS
# ==========================================

def verify_s3_object_exists(s3_key):
    """
    Check if an S3 object exists
    
    Args:
        s3_key: S3 object key
    
    Returns:
        bool: True if object exists, False otherwise
    """
    try:
        s3.head_object(Bucket=BUCKET_NAME, Key=s3_key)
        logger.info(f"Object exists in S3: {s3_key}")
        return True
    except Exception as e:
        logger.error(f"Object not found in S3: {s3_key} - {str(e)}")
        return False


def extract_data_from_document(document_key):
    """
    Extract CPR number and person name from document using Textract
    
    Args:
        document_key: S3 key of the document
    
    Returns:
        dict: Result containing CPR number, name, and extracted text
    """
    try:
        logger.info(f"Calling Textract for: {document_key}")
        
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
        extracted_lines = []
        for block in response.get('Blocks', []):
            if block['BlockType'] == 'LINE':
                extracted_lines.append(block['Text'])
        
        full_text = ' '.join(extracted_lines)
        logger.info(f"Extracted {len(extracted_lines)} lines of text")
        logger.info(f"Full text preview: {full_text[:300]}...")
        
        # ==========================================
        # EXTRACT CPR NUMBER (Bahrain CPR: 9 digits)
        # ==========================================
        cpr_pattern = r'\b\d{9}\b'
        cpr_matches = re.findall(cpr_pattern, full_text)
        
        if not cpr_matches:
            logger.error("CPR number not found in document")
            return {
                'success': False,
                'error': 'CPR number not found in document',
                'extractedText': full_text
            }
        
        cpr_number = cpr_matches[0]
        logger.info(f"Found CPR: {cpr_number}")
        
        # ==========================================
        # EXTRACT NATIONALITY
        # ==========================================
        nationality = extract_nationality_from_text(extracted_lines, full_text)
        logger.info(f"Extracted nationality: {nationality}")
        
        # ==========================================
        # EXTRACT PERSON NAME
        # ==========================================
        extracted_name = extract_name_from_text(extracted_lines, full_text)
        logger.info(f"Extracted name: {extracted_name}")
        
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
            'error': 'Failed to extract data from document',
            'details': str(e)
        }


def extract_nationality_from_text(lines, full_text):
    """
    Extract nationality from Bahraini ID document text
    
    Args:
        lines: List of text lines from document
        full_text: Complete text from document
    
    Returns:
        str: Extracted nationality or "Unknown"
    """
    try:
        # Common patterns for nationality in Bahraini ID cards
        nationality_keywords = ['Nationality', 'الجنسية', 'nationality', 'NATIONALITY']
        
        # Method 1: Look for lines containing nationality keywords
        for i, line in enumerate(lines):
            for keyword in nationality_keywords:
                if keyword in line:
                    # Nationality is usually on the same line or next line
                    if ':' in line:
                        # Extract text after colon
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            nationality = parts[1].strip()
                            if nationality and len(nationality) > 2:
                                logger.info(f"Extracted nationality using keyword '{keyword}' (same line): {nationality}")
                                return clean_nationality(nationality)
                    
                    # Check next line
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if next_line and not any(char.isdigit() for char in next_line[:5]):
                            logger.info(f"Extracted nationality using keyword '{keyword}' (next line): {next_line}")
                            return clean_nationality(next_line)
        
        # Method 2: Look for text after "Nationality:" or similar patterns
        nationality_pattern = r'(?:Nationality|الجنسية|nationality|NATIONALITY)\s*:?\s*([A-Za-z\s]{3,30})'
        nationality_match = re.search(nationality_pattern, full_text)
        if nationality_match:
            nationality = nationality_match.group(1).strip()
            logger.info(f"Extracted nationality using regex pattern: {nationality}")
            return clean_nationality(nationality)
        
        # Method 3: Look for common nationalities in the text
        common_nationalities = ['BAHRAINI', 'بحريني', 'PAKISTANI', 'باكستاني', 'INDIAN', 'هندي', 
                               'BANGLADESHI', 'بنجلاديشي', 'FILIPINO', 'فلبيني', 'EGYPTIAN', 'مصري']
        
        for line in lines:
            for nat in common_nationalities:
                if nat.upper() in line.upper():
                    logger.info(f"Extracted nationality using common nationality match: {nat}")
                    return clean_nationality(nat)
        
        logger.warning("Could not extract nationality from document, returning 'Unknown'")
        return "Unknown"
        
    except Exception as e:
        logger.error(f"Error extracting nationality: {str(e)}", exc_info=True)
        return "Unknown"


def clean_nationality(nationality):
    """
    Clean and format extracted nationality
    
    Args:
        nationality: Raw extracted nationality
    
    Returns:
        str: Cleaned nationality
    """
    # Remove extra whitespace
    nationality = ' '.join(nationality.split())
    
    # Remove common non-name characters
    nationality = re.sub(r'[^\w\s\-]', '', nationality)
    
    # Convert to title case
    nationality = nationality.title()
    
    return nationality.strip()


def extract_name_from_text(lines, full_text):
    """
    Extract person name from Bahraini ID document text
    
    Args:
        lines: List of text lines from document
        full_text: Complete text from document
    
    Returns:
        str: Extracted person name or "Unknown"
    """
    try:
        # Common patterns in Bahraini ID cards
        name_keywords = ['Name', 'الاسم', 'name', 'NAME', 'Full Name', 'الاسم الكامل']
        
        # Method 1: Look for lines containing name keywords
        for i, line in enumerate(lines):
            for keyword in name_keywords:
                if keyword in line:
                    # Name is usually on the same line or next line
                    if ':' in line:
                        # Extract text after colon
                        parts = line.split(':', 1)
                        if len(parts) > 1:
                            name = parts[1].strip()
                            if name and len(name) > 2:
                                logger.info(f"Extracted name using keyword '{keyword}' (same line): {name}")
                                return clean_name(name)
                    
                    # Check next line
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if next_line and not any(char.isdigit() for char in next_line[:5]):
                            logger.info(f"Extracted name using keyword '{keyword}' (next line): {next_line}")
                            return clean_name(next_line)
        
        # Method 2: Look for text after "Name:" or similar patterns
        name_pattern = r'(?:Name|الاسم|name|NAME|Full Name|الاسم الكامل)\s*:?\s*([A-Za-z\s]{3,50})'
        name_match = re.search(name_pattern, full_text)
        if name_match:
            name = name_match.group(1).strip()
            logger.info(f"Extracted name using regex pattern: {name}")
            return clean_name(name)
        
        # Method 3: Look for lines with multiple capitalized words 
        for line in lines:
            words = line.split()
            # Check if line has 2-4 capitalized words (typical name format)
            capitalized_words = [w for w in words if w and w[0].isupper() and w.isalpha()]
            if 2 <= len(capitalized_words) <= 4:
                potential_name = ' '.join(capitalized_words)
                # Exclude common non-name phrases
                exclude_keywords = ['Kingdom', 'Bahrain', 'Identity', 'Card', 'CPR', 'Date', 'Birth']
                if not any(keyword in potential_name for keyword in exclude_keywords):
                    logger.info(f"Extracted name using capitalization heuristic: {potential_name}")
                    return clean_name(potential_name)
        
        # Method 4: Return first non-numeric line with reasonable length
        for line in lines:
            clean_line = line.strip()
            if (clean_line and 
                len(clean_line) > 5 and 
                len(clean_line) < 50 and
                not clean_line.isdigit() and
                sum(c.isalpha() for c in clean_line) > len(clean_line) * 0.5):
                logger.info(f"Extracted name as fallback (first alpha line): {clean_line}")
                return clean_name(clean_line)
        
        logger.warning("Could not extract name from document, returning 'Unknown'")
        return "Unknown"
        
    except Exception as e:
        logger.error(f"Error extracting name: {str(e)}", exc_info=True)
        return "Unknown"


def clean_name(name):
    """
    Clean and format extracted name
    
    Args:
        name: Raw extracted name
    
    Returns:
        str: Cleaned name
    """
    # Remove extra whitespace
    name = ' '.join(name.split())
    
    # Remove common non-name characters
    name = re.sub(r'[^\w\s\-]', '', name)
    
    # Capitalize properly
    name = name.title()
    
    return name.strip()


def check_reference_photo(cpr_number):
    """
    Check if reference photo exists in global-assets
    
    Args:
        cpr_number: CPR number to check
    
    Returns:
        dict: Result containing exists flag and photo key if found
    """
    try:
        logger.info(f"Checking reference photo for CPR: {cpr_number}")
        
        # Check multiple file extensions
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
                if e.response['Error']['Code'] != '404':
                    raise e
        
        if not found_key:
            logger.info(f"No reference photo found for CPR: {cpr_number}")
        
        exists = found_key is not None
        
        return {
            'exists': exists,
            'referencePhotoKey': found_key,
            'cprNumber': cpr_number
        }
        
    except Exception as e:
        logger.error(f"Error checking reference photo: {str(e)}", exc_info=True)
        return {
            'exists': False,
            'error': 'Failed to check reference photo',
            'details': str(e)
        }


def compare_faces(source_photo_key, target_photo_key, case_id, session_id, cpr_number, person_type):
    """
    Compare two faces using Rekognition
    
    Args:
        source_photo_key: S3 key of reference/document photo
        target_photo_key: S3 key of person photo to verify
        case_id: Case ID
        session_id: Session ID
        cpr_number: CPR number
        person_type: Type of person (witness, accused, victim)
    
    Returns:
        dict: Comparison results
    """
    try:
        logger.info(f"Comparing faces:")
        logger.info(f"  Source: {source_photo_key}")
        logger.info(f"  Target: {target_photo_key}")
        
        # Compare faces using Rekognition
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
            SimilarityThreshold=70  # Minimum 70% similarity
        )
        
        # Check if faces match
        face_matches = response.get('FaceMatches', [])
        
        if face_matches:
            # Face match found
            similarity = face_matches[0]['Similarity']
            is_match = similarity >= 95.0  # Consider match if >= 95%
            
            logger.info(f"✓ Face match found with {similarity}% similarity")
            
            result = {
                'success': True,
                'match': is_match,
                'similarity': round(similarity, 2),
                'confidence': 'HIGH' if similarity >= 95 else 'MEDIUM',
                'faceMatches': len(face_matches)
            }
        else:
            # No match found
            logger.warning("No face match found (similarity below threshold)")
            result = {
                'success': True,
                'match': False,
                'similarity': 0,
                'confidence': 'LOW',
                'faceMatches': 0
            }
        
        # Save detailed verification results
        result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/verification-results/{person_type}_{cpr_number}_comparison-result.json"
        
        verification_result = {
            'cprNumber': cpr_number,
            'personType': person_type,
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
        
        logger.info(f"Comparison results saved to: {result_key}")
        
        result['verificationResultKey'] = result_key
        
        return result
        
    except rekognition.exceptions.InvalidParameterException as e:
        logger.error(f"Invalid parameter for Rekognition: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Invalid image or no face detected',
            'details': str(e)
        }
    except Exception as e:
        logger.error(f"Error comparing faces: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': 'Failed to compare faces',
            'details': str(e)
        }


def create_or_update_session_metadata(case_id, session_id, cpr_number, person_name, person_type, verification_result, nationality):
    """
    Create or update session metadata file at session level
    
    Args:
        case_id: Case ID
        session_id: Session ID
        cpr_number: Extracted CPR number
        person_name: Person's name
        person_type: Type of person (witness, accused, victim)
        verification_result: Result from face comparison
        nationality: Extracted nationality
    
    Returns:
        dict: Session metadata
    """
    try:
        metadata_key = f"cases/{case_id}/sessions/{session_id}/session-metadata.json"
        
        logger.info(f"Creating/updating session metadata: {metadata_key}")
        
        # Try to load existing metadata
        existing_metadata = None
        try:
            response = s3.get_object(Bucket=BUCKET_NAME, Key=metadata_key)
            existing_metadata = json.loads(response['Body'].read().decode('utf-8'))
            logger.info(f"Loaded existing session metadata")
        except s3.exceptions.NoSuchKey:
            logger.info(f"Creating new session metadata")
        except Exception as e:
            logger.warning(f"Error loading existing metadata: {str(e)}")
        
        # Build metadata structure
        current_timestamp = datetime.utcnow().isoformat()
        
        if existing_metadata:
            # Update existing metadata
            metadata = existing_metadata
            metadata['lastUpdated'] = current_timestamp
            
            # Add verification to list if not already present
            if 'verifications' not in metadata:
                metadata['verifications'] = []
            
            metadata['verifications'].append({
                'personType': person_type,
                'personName': person_name,
                'cprNumber': cpr_number,
                'nationality': nationality,
                'verificationTimestamp': current_timestamp,
                'match': verification_result['match'],
                'similarity': verification_result['similarity'],
                'confidence': verification_result['confidence'],
                'status': 'VERIFIED' if verification_result['match'] else 'NOT_VERIFIED'
            })
        else:
            # Create new metadata
            metadata = {
                'caseId': case_id,
                'sessionId': session_id,
                'sessionStartDate': current_timestamp,
                'lastUpdated': current_timestamp,
                'primaryPerson': {
                    'cprNumber': cpr_number,
                    'personName': person_name,
                    'personType': person_type,
                    'nationality': nationality
                },
                'verifications': [{
                    'personType': person_type,
                    'personName': person_name,
                    'cprNumber': cpr_number,
                    'nationality': nationality,
                    'verificationTimestamp': current_timestamp,
                    'match': verification_result['match'],
                    'similarity': verification_result['similarity'],
                    'confidence': verification_result['confidence'],
                    'status': 'VERIFIED' if verification_result['match'] else 'NOT_VERIFIED'
                }],
                'sessionStatus': 'active'
            }
        
        # Save metadata
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=metadata_key,
            Body=json.dumps(metadata, indent=2),
            ContentType='application/json'
        )
        
        logger.info(f"Session metadata saved successfully")
        
        return metadata
        
    except Exception as e:
        logger.error(f"Error creating/updating session metadata: {str(e)}", exc_info=True)
        return None


def error_response(status_code, message, additional_data=None):
    """Helper function to create error responses"""
    body = {'error': message}
    if additional_data:
        body.update(additional_data)
    
    logger.error(f"Returning error response: {status_code} - {message}")
    if additional_data:
        logger.error(f"Additional error data: {json.dumps(additional_data, default=str)}")
    
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(body)
    }