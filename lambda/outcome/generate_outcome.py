import json
import boto3
import os
from datetime import datetime

def handler(event, context):
    try:
        inference_profile_arn = os.environ.get('INFERENCE_PROFILE_ARN')
        bucket = os.environ.get('OUTCOME_BUCKET')
        
        bedrock_runtime = boto3.client('bedrock-runtime')
        s3 = boto3.client('s3')
        
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId')
        language = body.get('language', 'en')
        
        if not session_id:
            raise Exception("sessionId is required")
        
        # Fetch latest contradictions file from S3
        contradictions_prefix = "DetectContradiction/contradictions/"
        response = s3.list_objects_v2(Bucket=bucket, Prefix=contradictions_prefix)
        
        if 'Contents' not in response or len(response['Contents']) == 0:
            raise Exception("No contradictions files found")
        
        # Get latest file by LastModified
        latest_file = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
        latest_key = latest_file['Key']
        print(f"Using latest contradictions file: {latest_key}")
        
        obj_response = s3.get_object(Bucket=bucket, Key=latest_key)
        contradictions_data = obj_response['Body'].read().decode('utf-8')
        print(f"Loaded contradictions data ({len(contradictions_data)} characters)")
        
        # Build prompt for Bedrock
        prompt = f"""Analyze the contradictions data below and provide a case outcome assessment based on the nature, severity, and legal implications of the inconsistencies.

Contradictions Data:
{contradictions_data}

LEGAL CONTEXT (BAHRAIN)
- Apply Bahraini criminal law, including evidentiary principles under the Bahraini Penal Code and Criminal Procedure Law.
- Consider:
  • The requirement that guilt must be established with clear, coherent, and corroborated evidence.
  • That significant contradictions affecting core elements (actus reus, mens rea, identity, intent, timeline) may weaken prosecutorial certainty.
  • That minor or explainable inconsistencies do not automatically invalidate testimony under Bahraini standards if the overall narrative remains credible.
  • That witness credibility, consistency, and corroboration are central factors considered by Bahraini courts in evaluating reliability.
- Evaluate whether contradictions undermine the prosecution's ability to meet the burden of proof "بما لا يدع مجالاً للشك" (beyond reasonable doubt).

OBJECTIVE
- Assess how the contradictions affect the legal strength of the case, the coherence of the factual narrative, and the reliability of involved accounts.
- Determine whether the contradictions increase or decrease confidence in a "Guilty" or "Not Guilty" outcome.
- Base your assessment ONLY on the contradictions provided; do not introduce external facts.

ANALYSIS EXPECTATIONS
- Distinguish between:
  • Major contradictions: timeline, suspect's actions, location, intent, description of events, identity, material facts.
  • Minor contradictions: peripheral details, imprecise recollections, non-material variations.
- Examine:
  • Recurrence or patterns of inconsistencies.
  • Impact on witness credibility under Bahraini law.
  • Whether contradictions can be reconciled logically or indicate falsehood/fabrication.
  • Whether contradictions weaken essential elements required by prosecution.
- Determine how the contradictions affect:
  • Evidentiary sufficiency.
  • Credibility and admissibility.
  • Case narrative stability.
  • Ability to meet burden of proof.

OUTPUT FORMAT
1. You MUST return ONLY a single valid JSON object with the exact fields:
{{
  "confidence": 75,
  "verdict": "Guilty",
  "rationale": "Your explanation here"
}}

2. FIELD RULES:
   - "confidence": NUMBER from 0–100, representing how strongly the contradictions, when analyzed under Bahraini law, support the chosen verdict.
   - "verdict": STRING, exactly either "Guilty" or "Not Guilty" (always in English).
   - "rationale": TEXT in {language}, 3–5 sentences.

RATIONALE REQUIREMENTS
- Written entirely in {language}.
- MUST:
  • Cite specific contradictions from the data.
  • Explain whether these contradictions affect core legal elements (timeline, actions, intent, credibility).
  • Connect impact of contradictions to Bahraini evidentiary standards.
  • Justify the confidence score and verdict based on contradiction severity and legal implications.

Output JSON only, no markdown or extra text."""

        # Call Bedrock
        response = bedrock_runtime.invoke_model(
            modelId=inference_profile_arn,
            body=json.dumps({
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 1500, "temperature": 0.9, "topP": 0.95}
            })
        )
        
        result = json.loads(response['body'].read())
        content = result['output']['message']['content'][0]['text']
        
        # Extract JSON
        start = content.find('{')
        end = content.rfind('}') + 1
        outcome_data = json.loads(content[start:end])
        
        timestamp = datetime.now().isoformat()
        
        # Save confidence
        confidence_key = f"outcome/confidence/session-{session_id}/confidence.json"
        s3.put_object(
            Bucket=bucket,
            Key=confidence_key,
            Body=json.dumps({
                "sessionId": session_id,
                "confidence": outcome_data['confidence'],
                "generatedAt": timestamp
            }),
            ContentType='application/json'
        )
        
        # Save rationale
        rationale_key = f"outcome/rationale/session-{session_id}/rationale.json"
        s3.put_object(
            Bucket=bucket,
            Key=rationale_key,
            Body=json.dumps({
                "sessionId": session_id,
                "verdict": outcome_data['verdict'],
                "rationale": outcome_data['rationale'],
                "generatedAt": timestamp
            }),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'confidence': outcome_data['confidence'],
                'verdict': outcome_data['verdict'],
                'rationale': outcome_data['rationale'],
                's3Keys': {
                    'confidence': confidence_key,
                    'rationale': rationale_key
                }
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
                'error': 'Failed to generate outcome',
                'details': str(e)
            })
        }
