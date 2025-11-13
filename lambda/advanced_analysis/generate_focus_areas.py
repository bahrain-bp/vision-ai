import json
import boto3
import os
from datetime import datetime

def handler(event, context):
    """
    Generate Areas of Focus for investigation reports
    
    POST /advanced-analysis/focus-areas
    Body: {
        "sessionId": "session-20250103-123456",
        "language": "en"
    }
    """
    try:
        inference_profile_arn = os.environ.get('INFERENCE_PROFILE_ARN')
        bucket = os.environ.get('QUESTIONS_BUCKET')
        
        bedrock_runtime = boto3.client('bedrock-runtime')
        s3 = boto3.client('s3')
        
        body = json.loads(event.get('body', '{}'))
        session_id = body.get('sessionId') or f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        language = body.get('language', 'en')
        language_name = 'Arabic' if language == 'ar' else 'English'
        
        # Fetch report from S3
        report_key = f"advanced-analysis/police-reports/{session_id}/report.txt"
        print(f"Fetching report: {report_key}")
        response = s3.get_object(Bucket=bucket, Key=report_key)
        report_content = response['Body'].read().decode('utf-8')
        
        # Build prompt (enhanced to avoid overlap with AI Suggested Questions)
        prompt = f"""Analyze the investigation report below and identify 3–6 strategic **Key Focus Areas** for the Bahrain Public Prosecution.

LEGAL CONTEXT
- Apply Bahraini criminal law and procedural standards.
- Focus areas must align with Bahrain's legal requirements for case preparation, evidence sufficiency, and prosecutorial decision-making.
- Consider Bahraini legal standards for witness credibility, evidence admissibility, and burden of proof.

Report Content:
{report_content}

ROLE & GOAL
- You are producing high-level priorities to strengthen the case narrative and documentation.
- This section is **not** for generating interview questions or prompts.

STRICT EXCLUSIONS (do not do the following)
- Do NOT write anything as a question.
- Do NOT include question marks (?) or interrogative words/phrases (e.g., who/what/when/where/why/how, could you, can you, should, would).
- Do NOT suggest that someone "ask," "interview," or "question" a person.
- Do NOT duplicate content or intent typical of the "AI Suggested Questions" section.

WHAT TO RETURN (JSON only)
Return ONLY a JSON array with 3–6 items. Each item MUST have exactly these fields:
[
  {{
    "title": "Short 2–5 word label (non-interrogative, e.g., 'Timeline Clarification')",
    "description": "One or two sentences explaining why this area needs attention and how it strengthens clarity, completeness, or accuracy.",
    "priority": "High"  // one of: High, Medium, Low
  }}
]

SELECTION CRITERIA (what to focus on)
- Strong influence on case interpretation or outcome.
- Needs verification, clarification, or corroboration (but described as a theme, not a question).
- Recurring patterns or under-examined themes that merit deeper analysis.
- Narrative flow, clarity, or structure that would benefit from refinement.

STYLE & CONSTRAINTS
- Use formal, neutral, concise language suitable for legal documentation.
- Titles must be brief noun or noun-phrase labels (no verbs like "Ask," no questions).
- Descriptions must be declarative statements (no questions, no instructions to ask).
- Produce unique, non-overlapping items.
- Sort items by priority in the array order: High first, then Medium, then Low.
- IMPORTANT: Respond in {language_name}. All titles and descriptions must be in {language_name}.
- Output must be valid JSON only (no markdown, no leading/trailing commentary)."""

        focus_areas = []
        
        if inference_profile_arn and 'nova' in inference_profile_arn.lower():
            try:
                response = bedrock_runtime.invoke_model(
                    modelId=inference_profile_arn,
                    body=json.dumps({
                        "messages": [{"role": "user", "content": [{"text": prompt}]}],
                        "inferenceConfig": {"maxTokens": 1500, "temperature": 0.7}
                    })
                )
                result = json.loads(response['body'].read())
                content = result['output']['message']['content'][0]['text']
                
                start = content.find('[')
                end = content.rfind(']') + 1
                if start >= 0 and end > start:
                    focus_areas = json.loads(content[start:end])
                    print(f"Generated {len(focus_areas)} focus areas")
            except Exception as e:
                print(f"Bedrock error: {e}")
        
        # Store to S3
        timestamp = datetime.now().isoformat()
        s3_data = {
            "sessionId": session_id,
            "focusAreas": focus_areas,
            "generatedAt": timestamp,
            "language": language
        }
        
        s3_key = f"advanced-analysis/focus-areas/{session_id}/{timestamp.replace(':', '-')}.json"
        s3.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=json.dumps(s3_data),
            ContentType='application/json'
        )
        print(f"Stored to S3: {s3_key}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'focusAreas': focus_areas,
                's3ObjectKey': s3_key
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
                'error': 'Failed to generate focus areas',
                'details': str(e)
            })
        }
