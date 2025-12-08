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
        print(f"Received language: {language}")
        
        # Fetch latest rewritten file from S3
        rewrite_prefix = "rewritten/"
        response = s3.list_objects_v2(Bucket=bucket, Prefix=rewrite_prefix)
        
        if 'Contents' not in response or len(response['Contents']) == 0:
            raise Exception("No rewritten files found")
        
        # Get latest file by LastModified (any session)
        latest_file = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
        latest_key = latest_file['Key']
        print(f"Using latest rewritten file: {latest_key}")
        
        obj_response = s3.get_object(Bucket=bucket, Key=latest_key)
        report_content = obj_response['Body'].read().decode('utf-8')
        print(f"Loaded rewritten report ({len(report_content)} characters)")
        
        # Build prompt (enhanced to avoid overlap with AI Suggested Questions)
        prompt = f"""Analyze the investigation report below and identify 3–6 highly specific **Key Focus Areas** for the Bahrain Public Prosecution. These focus areas must reference particular individuals, actions, events, locations, timelines, or evidence mentioned in the report, but must NOT be written as questions or resemble interview prompts.

LEGAL CONTEXT
- Apply Bahraini criminal law and procedural standards.
- Focus areas must support prosecutorial evaluation, evidence sufficiency, credibility assessment, and admissibility requirements.
- Consider standards governing factual consistency, corroboration, chain of events, and reliability of statements.

Report Content:
{report_content}

ROLE & GOAL
- Produce precise, high-impact thematic priorities that highlight EXACT elements in the report requiring deeper verification, clarification, or strengthening.
- Focus areas should target specific statements, described actions, identified individuals, timeline gaps, unclear sequences, or evidentiary weaknesses.
- This section is NOT for generating interview questions or reformulating them indirectly.

STRICT EXCLUSIONS
- Do NOT write anything as a question.
- Do NOT use interrogative phrasing or words (who, what, when, where, why, how, could, can, should, would).
- Do NOT tell anyone to "ask," "confirm with," "interview," or "question" a person.
- Do NOT duplicate or imitate the intent of the AI Suggested Questions section.

WHAT TO RETURN (JSON only)
Return ONLY a JSON array with 3–6 items. Each item MUST follow exactly:
[
  {{
    "title": "Short 2–5 word non-interrogative label (e.g., 'Event Timing Gap', 'Suspect Movement Pattern')",
    "description": "Two concise sentences identifying the specific detail, individual, action, or piece of evidence that requires closer examination, and explaining how addressing it strengthens factual clarity or legal sufficiency.",
    "priority": "High"
  }}
]

SELECTION CRITERIA
- Each item must reference concrete elements from the report (names, actions, times, locations, evidence items).
- Must highlight areas needing factual consolidation, corroboration, or narrative continuity—phrased as themes, not questions.
- Must avoid generic topics; each focus area must target a specific instance or narrative segment.
- Must support prosecutorial understanding, case-building, and evidentiary review.

STYLE & CONSTRAINTS
- Use formal, neutral, concise legal language.
- Titles must be brief noun-based labels (no verbs, no questions).
- Descriptions must be declarative statements only.
- Items must be unique, non-overlapping, and sorted by priority (High → Medium → Low).
- All content MUST be written entirely in {language}.
- Output must be valid JSON only with no additional commentary."""

        focus_areas = []
        max_retries = 3
        
        if inference_profile_arn and 'nova' in inference_profile_arn.lower():
            for attempt in range(max_retries):
                try:
                    response = bedrock_runtime.invoke_model(
                        modelId=inference_profile_arn,
                        body=json.dumps({
                            "messages": [{"role": "user", "content": [{"text": prompt}]}],
                            "inferenceConfig": {"maxTokens": 2000, "temperature": 0.7}
                        })
                    )
                    result = json.loads(response['body'].read())
                    content = result['output']['message']['content'][0]['text']
                    
                    start = content.find('[')
                    end = content.rfind(']') + 1
                    if start >= 0 and end > start:
                        try:
                            focus_areas = json.loads(content[start:end])
                            print(f"Generated {len(focus_areas)} focus areas on attempt {attempt + 1}")
                            break
                        except json.JSONDecodeError as parse_err:
                            print(f"JSON parse error on attempt {attempt + 1}: {parse_err}")
                            if attempt < max_retries - 1:
                                print("Retrying...")
                                continue
                            else:
                                print(f"Failed after {max_retries} attempts")
                                focus_areas = []
                except Exception as e:
                    print(f"Bedrock error on attempt {attempt + 1}: {e}")
                    if attempt < max_retries - 1:
                        continue
        
        # Store to S3
        timestamp = datetime.now().isoformat()
        s3_data = {
            "sessionId": session_id,
            "focusAreas": focus_areas,
            "generatedAt": timestamp,
            "language": language
        }
        
        s3_key = f"advanced-analysis/focus-areas/session-{session_id}/{timestamp.replace(':', '-')}.json"
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
