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
        
        # Fetch latest contradictions file from specific prefix
        contradictions_prefix = "DetectContradiction/contradictions/SulaimanAbdulmohsen-Accused-interview/"
        response = s3.list_objects_v2(Bucket=bucket, Prefix=contradictions_prefix)
        
        if 'Contents' not in response or len(response['Contents']) == 0:
            raise Exception(f"No contradictions files found in {contradictions_prefix}")
        
        # Get latest file by LastModified
        latest_file = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
        latest_key = latest_file['Key']
        print(f"Using latest contradictions file: {latest_key}")
        
        obj_response = s3.get_object(Bucket=bucket, Key=latest_key)
        contradictions_data = obj_response['Body'].read().decode('utf-8')
        print(f"Loaded contradictions data ({len(contradictions_data)} characters)")
        
        # Parse and analyze contradictions
        data = json.loads(contradictions_data)
        results = data.get('results', [])
        
        red_count = sum(1 for r in results if r.get('severity') == 'red')
        yellow_count = sum(1 for r in results if r.get('severity') == 'yellow')
        green_count = sum(1 for r in results if r.get('severity') == 'green')
        
        # Calculate guilt score: contradictions increase guilt, agreements reduce it
        guilt_score = (red_count * 3) + (yellow_count * 1) + (green_count * -2)
        total_contradictions = red_count + yellow_count
        total_agreements = green_count
        
        print(f"Guilt Analysis: Red={red_count}, Yellow={yellow_count}, Green={green_count}, Score={guilt_score}")
        
        # Build prompt with statistical guidance
        prompt = f"""Analyze the contradictions data below and provide a case outcome assessment based on the nature, severity, and legal implications of the inconsistencies.

Contradictions Data:
{contradictions_data}

STATISTICAL ANALYSIS:
- High Severity Contradictions (Red): {red_count} - Suspect's statements contradict evidence/witnesses on major facts
- Medium Severity Contradictions (Yellow): {yellow_count} - Suspect's statements have moderate inconsistencies
- Agreements/Corroborations (Green): {green_count} - Suspect's statements align with evidence/witnesses
- Total Contradictions: {total_contradictions}
- Total Agreements: {total_agreements}
- Weighted Guilt Score: {guilt_score} (Red=3 points, Yellow=1 point, Green=-2 points)

INTERPRETATION GUIDANCE:
- Score ≥6: High contradictions in suspect's statements → Strong indication of deception → "Guilty" (confidence 70-95%)
- Score 3-5: Moderate contradictions → Suspect credibility weakened → Lean "Guilty" (confidence 55-70%)
- Score 0-2: Low contradictions → Mixed credibility → Uncertain (confidence 40-55%)
- Score <0: Agreements dominate → Suspect statements corroborated → "Not Guilty" (confidence 60-80%)

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
   - "confidence": NUMBER from 0–100, representing how strongly the contradictions, when analyzed under Bahraini law, support the chosen verdict. Use the statistical analysis and weighted score as primary guidance.
   - "verdict": STRING, exactly either "Guilty" or "Not Guilty" (always in English). Consider that high contradiction scores (especially multiple red-severity items) indicate the suspect is lying and strengthen the case for guilt.
   - "rationale": TEXT in {language}, at least 5 sentences and up to around 10 sentences (you may write more if needed for a precise, detailed explanation).

RATIONALE REQUIREMENTS
- Written entirely in {language}.
- MUST:
  • Cite specific contradictions from the data, preferably by directly referencing or briefly quoting/paraphrasing key parts of the suspect's or witnesses' statements (e.g., differences between two interviews, or between a witness and physical evidence).
  • Explain in a concrete, detailed way whether these contradictions affect core legal elements (timeline, actions, intent, credibility), avoiding vague or generic phrasing.
  • Connect the identified contradictions and example statements explicitly to Bahraini evidentiary standards and the requirement of proving guilt beyond reasonable doubt.
  • Justify the confidence score and verdict clearly, showing how the pattern, frequency, and seriousness of the contradictions (and any agreements) logically support your conclusion.
  • Where helpful, you may refer to specific statements or segments from the input (e.g., "in the suspect's second statement…" or "according to Witness A's account…") as long as they are contained within the provided contradictions data.
- MUST NOT:
  • Mention color codes (red, yellow, green) or severity labels in the rationale.
  • Reference the statistical analysis section directly.
  • Use technical terminology like "weighted score" or "contradiction count".
  • Use overly generic language such as "there are some inconsistencies" without specifying what they are and how they impact the case.

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
