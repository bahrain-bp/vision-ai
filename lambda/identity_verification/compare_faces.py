import json
import boto3
import os

rekognition = boto3.client('rekognition')
s3 = boto3.client('s3')
BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Compare two faces using Rekognition
    
    POST /identity/compare-faces
    Body: {
        "caseId": "CASE-001",
        "sessionId": "session-20250103-123456",
        "sourcePhotoKey": "global-assets/reference-photos/950123456_reference-photo.jpg",
        "targetPhotoKey": "cases/.../photos/witness-photo/teams-screenshot.jpg",
        "cprNumber": "950123456"
    }
    """
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        source_photo_key = body.get('sourcePhotoKey')
        target_photo_key = body.get('targetPhotoKey')
        cpr_number = body.get('cprNumber')
        
        if not source_photo_key or not target_photo_key:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'sourcePhotoKey and targetPhotoKey are required'
                })
            }
        
        print(f"Comparing faces: {source_photo_key} vs {target_photo_key}")
        
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
            
            print(f"Face match found with {similarity}% similarity")
            
            result = {
                'match': is_match,
                'similarity': round(similarity, 2),
                'confidence': 'HIGH' if similarity >= 95 else 'MEDIUM',
                'faceMatches': len(face_matches)
            }
        else:
            # No match found
            print("No face match found")
            result = {
                'match': False,
                'similarity': 0,
                'confidence': 'LOW',
                'faceMatches': 0
            }
        
        # Save verification results
        result_key = f"cases/{case_id}/sessions/{session_id}/01-identity-verification/verification-results/identity-verification-summary.json"
        
        verification_summary = {
            'cprNumber': cpr_number,
            'timestamp': context.aws_request_id,
            'sourcePhoto': source_photo_key,
            'targetPhoto': target_photo_key,
            'result': result,
            'rawResponse': response
        }
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=result_key,
            Body=json.dumps(verification_summary, default=str, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                **result,
                'verificationResultKey': result_key
            })
        }
        
    except rekognition.exceptions.InvalidParameterException as e:
        print(f"Invalid parameter: {str(e)}")
        return {
            'statusCode': 400,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Invalid image or no face detected',
                'details': str(e)
            })
        }
    except Exception as e:
        print(f"Error comparing faces: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to compare faces',
                'details': str(e)
            })
        }