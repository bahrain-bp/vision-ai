import json
import boto3
import os
import time
from datetime import datetime

def handler(event, context):
    """
    Generate AI suggested questions for investigation sessions
    
    POST /advanced-analysis/questions
    Body: {
        "sessionId": "session-20250103-123456",
        "witness": "John Doe", 
        "language": "en",
        "contextNotes": "Traffic incident witness"
    }
    """
    try:
        # Read environment variables
        inference_profile_arn = os.environ.get('INFERENCE_PROFILE_ARN')
        questions_bucket = os.environ.get('QUESTIONS_BUCKET')
        
        # Initialize boto3 clients
        bedrock_runtime = boto3.client('bedrock-runtime')
        s3 = boto3.client('s3')
        
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        case_id = body.get('caseId')
        session_id = body.get('sessionId') or f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        witness = body.get('witness', 'Anonymous Witness')
        language = body.get('language', 'en')
        context_notes = body.get('contextNotes', '')
        
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
        
        print(f"Generating questions for session: {session_id}")
        
        # Fetch latest rewritten report from S3 if contextNotes not provided
        if not context_notes:
            prefix = f"rewritten/{session_id}_"
            print(f"=== QUESTIONS DEBUG ===")
            print(f"Session ID: {session_id}")
            print(f"Searching for rewritten reports with prefix: {prefix}")
            print(f"Bucket: {questions_bucket}")
            
            max_retries = 3
            for attempt in range(max_retries):
                list_response = s3.list_objects_v2(Bucket=questions_bucket, Prefix=prefix)
                
                if 'Contents' in list_response and len(list_response['Contents']) > 0:
                    files = sorted(list_response['Contents'], key=lambda x: x['LastModified'], reverse=True)
                    print(f"Found {len(files)} files with prefix {prefix}")
                    
                    # Try each file until one works
                    for file_obj in files:
                        report_key = file_obj['Key']
                        print(f"Attempting to read: {report_key}")
                        
                        try:
                            response = s3.get_object(Bucket=questions_bucket, Key=report_key)
                            context_notes = response['Body'].read().decode('utf-8')
                            print(f"✅ Successfully loaded rewritten report ({len(context_notes)} characters)")
                            break
                        except Exception as read_error:
                            error_code = read_error.response.get('Error', {}).get('Code', '') if hasattr(read_error, 'response') else ''
                            if error_code == 'NoSuchKey':
                                print(f"⚠️ Key not found (stale listing): {report_key}")
                                continue
                            raise
                    
                    if context_notes:
                        break
                
                if not context_notes:
                    print(f"No valid files found on attempt {attempt + 1}/{max_retries}")
                    if attempt < max_retries - 1:
                        time.sleep(2.0 * (attempt + 1))
                        continue
                    
                    print(f"=== FINAL DEBUG ===")
                    all_rewritten = s3.list_objects_v2(Bucket=questions_bucket, Prefix="rewritten/", MaxKeys=50)
                    if 'Contents' in all_rewritten:
                        print(f"Found {len(all_rewritten['Contents'])} total rewritten files:")
                        for obj in all_rewritten['Contents']:
                            print(f"  - {obj['Key']} (modified: {obj['LastModified']})")
                    else:
                        print("❌ No files in rewritten/ prefix")
                    
                    raise Exception(f"No rewritten report found for session {session_id}. Please click Rewrite first.")
            
            if not context_notes:
                raise Exception(f"Failed to load rewritten report after {max_retries} attempts")
        
        # Build prompt for Bedrock
        prompt = f"""You are an expert investigator assistant for the Bahrain Public Prosecution. Based on the inputs below, generate 7–10 direct FOLLOW-UP interview questions for the investigator to ask the **suspect**. The questions must be intrusive, interrogative, and focused entirely on the suspect's actions, statements, movements, and involvement as described in the report. Police officers may be mentioned only for context, but no question may be directed at them.

LEGAL CONTEXT
- Apply Bahraini criminal procedure and evidentiary standards.
- Questions must remain neutral (no assumption of guilt) but should be direct, precise, and confrontational in detail, targeting factual gaps about the suspect.
- Questions must help clarify timelines, motivations, physical movements, interactions, and any inconsistencies in the suspect's account.

Session: {session_id}
Suspect: {witness}
Language: {language}
Context (rewritten report + notes): {context_notes}

REQUIREMENTS
1) Output MUST be ONLY a valid JSON array (no markdown, no additional commentary).
2) Each item MUST include: "id", "text", "context", "priority".
3) All content MUST be written in {language}.
4) Each question MUST:
   - Address the suspect **directly**, using second-person format.
   - Mention the suspect's name when relevant.
   - Be interrogative and specific (e.g., exact times, actions, distances, movements, locations).
   - Target the suspect's behavior, statements, or interactions described in the report.
   - Reference police officers only as contextual anchors, not as the subject of the question.
5) Questions MUST NOT:
   - Be directed at police officers.
   - Criticize or examine police decisions or investigative steps.
   - Include assumptions of guilt.
6) Keep each "text" ≤140 characters; each "context" ≤140 characters.
7) Avoid duplicates; cover diverse aspects of the suspect's involvement.
8) Maintain a formal but intrusive investigative tone.
9) Order all items by priority: High → Medium → Low.
10) Use zero-padded IDs: q01, q02, ..., q10.

RETURN ONLY THIS JSON SHAPE:
[
  {{
    "id": "q01",
    "text": "Direct interrogative question addressed to the suspect (≤140 chars, {language})",
    "context": "Why this suspect-focused detail matters (≤140 chars, {language})",
    "priority": "High"
  }}
]

Generate 10 items total."""

        questions = []
        
        if inference_profile_arn:
            try:
                if 'nova' in inference_profile_arn.lower():
                    response = bedrock_runtime.invoke_model(
                        modelId=inference_profile_arn,
                        body=json.dumps({
                            "messages": [{"role": "user", "content": [{"text": prompt}]}],
                            "inferenceConfig": {"maxTokens": 2000, "temperature": 0.7}
                        })
                    )
                    result = json.loads(response['body'].read())
                    content = result['output']['message']['content'][0]['text']
                else:
                    print("The inference profile does not match a Nova model")
                
                try:
                    start = content.find('[')
                    end = content.rfind(']') + 1
                    if start >= 0 and end > start:
                        questions = json.loads(content[start:end])
                        print(f"Generated {len(questions)} questions via Bedrock")
                except (json.JSONDecodeError, IndexError) as parse_error:
                    print(f"Failed to parse Bedrock response: {parse_error}")
                    questions = []
                
            except Exception as bedrock_error:
                print(f"Bedrock error: {str(bedrock_error)}")
                questions = []
        
        # Prepare data for S3 storage
        timestamp = datetime.now().isoformat()
        s3_data = {
            "sessionId": session_id,
            "questions": questions,
            "generatedAt": timestamp,
            "promptContext": {
                "witness": witness,
                "language": language,
                "contextNotes": context_notes
            }
        }
        
        # Store in S3 organized by sessionId
        s3_key = f"advanced-analysis/questions/{session_id}/{timestamp.replace(':', '-')}.json"
        try:
            s3.put_object(
                Bucket=questions_bucket,
                Key=s3_key,
                Body=json.dumps(s3_data),
                ContentType='application/json'
            )
            print(f"Stored questions to S3: {s3_key}")
        except Exception as s3_error:
            print(f"S3 storage failed (skipping): {s3_error}")
            s3_key = "storage-skipped-for-testing"
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'questions': questions,
                's3ObjectKey': s3_key
            })
        }
        
    except Exception as e:
        print(f"Error generating questions: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Failed to generate questions',
                'details': str(e)
            })
        }
