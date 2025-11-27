import json
import boto3
import os
from datetime import datetime

def handler(event, context):
    """
    Generate verdict confidence score and rationale
    
    POST /outcome/verdict
    Body: {
        "sessionId": "session-20250103-123456",
        "caseId": "CASE-202501-ABC123",
        "language": "en"
    }
    """
    try:
        inference_profile_arn = os.environ.get('INFERENCE_PROFILE_ARN')
        bucket = os.environ.get('BUCKET_NAME')
        
        bedrock_runtime = boto3.client('bedrock-runtime')
        s3 = boto3.client('s3')
        
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId')
        case_id = body.get('caseId')
        language = body.get('language', 'en')
        
        if not session_id or not case_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'sessionId and caseId are required'
                })
            }
        
        # TODO: Replace with actual contradiction data when API is ready
        # For now, using dummy contradiction data
        contradiction_data = """
        Contradiction Analysis Summary:
        - Subject claimed to have never been to the location, but phone GPS data shows presence at the scene.
        - Subject denied knowing the complainant personally, but text messages show frequent communication.
        - Subject mentioned being alone, but earlier stated someone else was present.
        - Timeline inconsistencies: Subject stated they were at home at 3 PM, but security footage shows them outside at 2:45 PM.
        """
        
        print(f"Generating verdict for session: {session_id}")
        
        # Build prompt for Bedrock
        prompt = f"""You are a legal analysis assistant for the Bahrain Public Prosecution. Based on the contradiction analysis below, provide a verdict assessment.

Contradiction Analysis:
{contradiction_data}

LEGAL CONTEXT
- Apply Bahraini criminal law and evidentiary standards
- Consider burden of proof requirements under Bahraini law
- Assess credibility and reliability of evidence
- Consider both inculpatory and exculpatory factors

TASK
Analyze the contradictions and provide:
1. Confidence Score (0-100): How confident are you in the evidence quality
2. Recommended Verdict: "Guilty" or "Not Guilty"
3. Rationale: Detailed explanation of your assessment

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{{
  "confidenceScore": <number 0-100>,
  "recommendedVerdict": "<Guilty or Not Guilty>",
  "rationale": "<detailed explanation in {language}>"
}}

Do not include any markdown, code blocks, or additional text. Only return the JSON object.
"""

        verdict_result = {
            "confidenceScore": 0,
            "recommendedVerdict": "Not Guilty",
            "rationale": "Unable to generate verdict"
        }
        
        if inference_profile_arn and 'nova' in inference_profile_arn.lower():
            try:
                response = bedrock_runtime.invoke_model(
                    modelId=inference_profile_arn,
                    body=json.dumps({
                        "messages": [{"role": "user", "content": [{"text": prompt}]}],
                        "inferenceConfig": {"maxTokens": 2000, "temperature": 0.3}
                    })
                )
                result = json.loads(response['body'].read())
                content = result['output']['message']['content'][0]['text']
                
                # Extract JSON from response
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    verdict_result = json.loads(content[start:end])
                    print(f"Generated verdict: {verdict_result['recommendedVerdict']} with {verdict_result['confidenceScore']}% confidence")
            except Exception as e:
                print(f"Bedrock error: {e}")
        
        # Store confidence score and verdict to S3
        timestamp = datetime.now().isoformat()
        confidence_data = {
            "sessionId": session_id,
            "caseId": case_id,
            "confidenceScore": verdict_result["confidenceScore"],
            "recommendedVerdict": verdict_result["recommendedVerdict"],
            "generatedAt": timestamp,
            "language": language
        }
        
        confidence_key = f"outcome/confidence/{session_id}/{timestamp.replace(':', '-')}.json"
        s3.put_object(
            Bucket=bucket,
            Key=confidence_key,
            Body=json.dumps(confidence_data),
            ContentType='application/json'
        )
        print(f"Stored confidence to S3: {confidence_key}")
        
        # Store rationale to S3
        rationale_data = {
            "sessionId": session_id,
            "caseId": case_id,
            "rationale": verdict_result["rationale"],
            "generatedAt": timestamp,
            "language": language
        }
        
        rationale_key = f"outcome/rationale/{session_id}/{timestamp.replace(':', '-')}.json"
        s3.put_object(
            Bucket=bucket,
            Key=rationale_key,
            Body=json.dumps(rationale_data),
            ContentType='application/json'
        )
        print(f"Stored rationale to S3: {rationale_key}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'confidenceScore': verdict_result["confidenceScore"],
                'recommendedVerdict': verdict_result["recommendedVerdict"],
                'rationale': verdict_result["rationale"],
                'confidenceS3Key': confidence_key,
                'rationaleS3Key': rationale_key
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to generate verdict',
                'details': str(e)
            })
        }
