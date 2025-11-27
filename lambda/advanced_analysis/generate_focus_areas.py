import json
import boto3
import os
import time
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
        case_id = body.get('caseId')
        session_id = body.get('sessionId') or f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        language = body.get('language', 'en')
        language_name = 'Arabic' if language == 'ar' else 'English'
        
        if not case_id:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'error': 'caseId is required'
                })
            }
        
        # Fetch latest rewritten report from S3 with retry logic
        prefix = f"rewritten/{session_id}_"
        print(f"=== FOCUS AREAS DEBUG ===")
        print(f"Session ID from request: {session_id}")
        print(f"Case ID from request: {case_id}")
        print(f"Searching for rewritten reports with prefix: {prefix}")
        print(f"Bucket: {bucket}")
        
        report_content = None
        max_retries = 3
        
        for attempt in range(max_retries):
            # Try specific session prefix first
            list_response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
            
            if 'Contents' in list_response and len(list_response['Contents']) > 0:
                files = sorted(list_response['Contents'], key=lambda x: x['LastModified'], reverse=True)
                print(f"Found {len(files)} files with prefix {prefix}")
                
                # Try each file until one works (handles stale listings)
                for file_obj in files:
                    report_key = file_obj['Key']
                    print(f"Attempting to read: {report_key}")
                    
                    try:
                        response = s3.get_object(Bucket=bucket, Key=report_key)
                        report_content = response['Body'].read().decode('utf-8')
                        print(f"✅ Successfully loaded rewritten report ({len(report_content)} characters)")
                        break
                    except Exception as read_error:
                        error_code = read_error.response.get('Error', {}).get('Code', '') if hasattr(read_error, 'response') else ''
                        if error_code == 'NoSuchKey':
                            print(f"⚠️ Key not found (stale listing): {report_key}")
                            continue  # Try next file
                        raise
                
                if report_content:
                    break  # Successfully loaded
            
            # If still no content, wait and retry
            if not report_content:
                print(f"No valid files found with prefix {prefix} on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    time.sleep(2.0 * (attempt + 1))  # 2s, 4s, 6s
                    continue
                
                # Last attempt - show debug info
                print(f"=== FINAL DEBUG INFO ===")
                all_rewritten = s3.list_objects_v2(Bucket=bucket, Prefix="rewritten/", MaxKeys=50)
                if 'Contents' in all_rewritten:
                    print(f"Found {len(all_rewritten['Contents'])} total rewritten files:")
                    for obj in all_rewritten['Contents']:
                        print(f"  - {obj['Key']} (modified: {obj['LastModified']})")
                else:
                    print("❌ No files found in rewritten/ prefix at all")
                
                raise Exception(f"No rewritten report found for session {session_id}. Please click Rewrite first.")
        
        if not report_content:
            raise Exception(f"Failed to load rewritten report after {max_retries} attempts")
        
        # Build prompt (enhanced to avoid overlap with AI Suggested Questions)
        prompt = f"""Analyze the investigation report below and identify 3–6 highly specific **Key Focus Areas** for the Bahrain Public Prosecution. These focus areas must directly reference the individuals, actions, timelines, locations, and evidence mentioned in the report, without using interrogative wording.

LEGAL CONTEXT
- Apply Bahraini criminal law, procedural requirements, and evidentiary standards.
- Focus areas must relate to issues affecting admissibility, reliability, corroboration, and prosecutorial assessment.
- Consider obligations under Bahraini law regarding witness credibility, event reconstruction, and evidence sufficiency.

Report Content:
{report_content}

ROLE & GOAL
- You are producing precise, high-impact thematic priorities that highlight the exact elements of the report requiring further verification, clarification, or strengthening.
- These items must address specific statements, chronological gaps, unclear actions, conflicting descriptions, missing corroboration, or evidentiary weaknesses.
- This section is NOT for generating questions or interview prompts.

STRICT EXCLUSIONS
- Do NOT include any questions or question-like phrasing.
- Do NOT use interrogative words (who, what, when, where, why, how, should, would, could, can).
- Do NOT instruct anyone to “ask,” “interview,” “confirm,” or “question.”
- Do NOT replicate content or style from the AI Suggested Questions section.

WHAT TO RETURN (JSON only)
Each item MUST follow exactly:
[
  {{
    "title": "Short 2–5 word label referencing the specific issue (e.g., Event Timing Gap, Eyewitness Role Clarity)",
    "description": "Two sentences that precisely identify the specific individual, action, statement, timeline, or evidence that needs deeper examination, and why addressing it strengthens factual accuracy or legal sufficiency.",
    "priority": "High"
  }}
]

SELECTION CRITERIA
- MUST reference concrete elements within the report (names, times, locations, described actions).
- MUST highlight areas requiring factual consolidation, corroboration, or clarification — phrased as themes, not questions.
- MUST avoid generic topics; each focus area must target a specific instance or detail in the narrative.
- MUST support prosecutorial preparation, evidentiary evaluation, and narrative coherence.

STYLE & CONSTRAINTS
- Formal, neutral, concise legal language.
- Titles must be brief, noun-based, and non-interrogative.
- Descriptions MUST be declarative statements only.
- Items must be unique, non-overlapping, and sorted by priority (High → Medium → Low).
- All content MUST be written fully in {language_name}.
- Output MUST be valid JSON only (no markdown, no explanation).
"""

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
