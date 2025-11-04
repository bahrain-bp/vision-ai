import json
import boto3
import os
from io import BytesIO
from PIL import Image

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
        
        # Detect faces in the document
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
        
        # Get the first (largest) face
        face_detail = response['FaceDetails'][0]
        bounding_box = face_detail['BoundingBox']
        
        print(f"Face detected with confidence: {face_detail['Confidence']}%")
        
        # Download the original image
        s3_response = s3.get_object(Bucket=BUCKET_NAME, Key=document_key)
        image_data = s3_response['Body'].read()
        image = Image.open(BytesIO(image_data))
        
        # Calculate crop coordinates
        width, height = image.size
        left = int(bounding_box['Left'] * width)
        top = int(bounding_box['Top'] * height)
        right = int((bounding_box['Left'] + bounding_box['Width']) * width)
        bottom = int((bounding_box['Top'] + bounding_box['Height']) * height)
        
        # Add padding (10%)
        padding = 0.1
        left = max(0, int(left - width * padding))
        top = max(0, int(top - height * padding))
        right = min(width, int(right + width * padding))
        bottom = min(height, int(bottom + height * padding))
        
        # Crop face
        face_image = image.crop((left, top, right, bottom))
        
        # Save cropped face to buffer
        buffer = BytesIO()
        face_image.save(buffer, format='JPEG', quality=95)
        buffer.seek(0)
        
        # Save extracted face to S3
        extracted_face_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/photos/extracted-face/{cpr_number}_extracted-face.jpg"
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=extracted_face_key,
            Body=buffer.getvalue(),
            ContentType='image/jpeg'
        )
        
        print(f"Extracted face saved to: {extracted_face_key}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'extractedFaceKey': extracted_face_key,
                'confidence': face_detail['Confidence'],
                'boundingBox': bounding_box
            })
        }
        
    except Exception as e:
        print(f"Error extracting face: {str(e)}")
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