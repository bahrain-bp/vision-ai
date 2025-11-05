import json
import boto3
import os

rekognition = boto3.client('rekognition')
s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Extract face from document using Rekognition face detection
    
    POST /identity/extract-face
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "documentKey": "cases/.../processed/950123456_citizen-id.jpg",
        "cprNumber": "950123456"
    }
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        document_key = body.get('documentKey')
        cpr_number = body.get('cprNumber')
        
        if not document_key or not cpr_number:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'documentKey and cprNumber are required'
                })
            }
        
        print(f"Extracting face from: {document_key}")
        
        # Detect faces in the document to verify a face exists
        response = rekognition.detect_faces(
            Image={
                'S3Object': {
                    'Bucket': BUCKET_NAME,
                    'Name': document_key
                }
            },
            Attributes=['ALL']
        )
        
        if not response.get('FaceDetails'):
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'No face detected in document'
                })
            }
        
        # Get the first (most prominent) face
        face_detail = response['FaceDetails'][0]
        bounding_box = face_detail['BoundingBox']
        
        print(f"Face detected with confidence: {face_detail['Confidence']}%")
        print(f"Bounding box: {bounding_box}")
        
        # Copy the processed document to extracted-face folder
        
        # to focus on the face when comparing
        extracted_face_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/photos/extracted-face/{cpr_number}_extracted-face.jpg"
        
        # Copy the document to the extracted-face location
        s3.copy_object(
            Bucket=BUCKET_NAME,
            CopySource={'Bucket': BUCKET_NAME, 'Key': document_key},
            Key=extracted_face_key,
            ContentType='image/jpeg',
            MetadataDirective='REPLACE',
            Metadata={
                'original-document': document_key,
                'face-confidence': str(face_detail['Confidence']),
                'cpr-number': cpr_number
            }
        )
        
        print(f"Extracted face reference saved to: {extracted_face_key}")
        
        # Save face detection metadata
        metadata_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/photos/extracted-face/{cpr_number}_face-metadata.json"
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=metadata_key,
            Body=json.dumps({
                'cprNumber': cpr_number,
                'sourceDocument': document_key,
                'extractedFaceKey': extracted_face_key,
                'faceDetails': {
                    'confidence': face_detail['Confidence'],
                    'boundingBox': bounding_box,
                    'emotions': face_detail.get('Emotions', []),
                    'ageRange': face_detail.get('AgeRange', {}),
                    'gender': face_detail.get('Gender', {})
                },
                'timestamp': context.aws_request_id
            }, indent=2),
            ContentType='application/json'
        )
        
        print(f"Face metadata saved to: {metadata_key}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'extractedFaceKey': extracted_face_key,
                'confidence': face_detail['Confidence'],
                'boundingBox': bounding_box,
                'metadataKey': metadata_key
            })
        }
        
    except rekognition.exceptions.InvalidImageFormatException as e:
        print(f"Invalid image format: {str(e)}")
        return {
            'statusCode': 400,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Invalid image format',
                'details': str(e)
            })
        }
    except Exception as e:
        print(f"Error extracting face: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to extract face',
                'details': str(e)
            })
        }