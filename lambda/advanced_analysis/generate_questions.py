import json
import boto3
import os
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
        session_id = body.get('sessionId') or f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        witness = body.get('witness', 'Anonymous Witness')
        language = body.get('language', 'en')
        
        print(f"Generating questions for session: {session_id}")
        
        # Fetch latest rewritten file from S3
        rewrite_prefix = "rewritten/"
        response = s3.list_objects_v2(Bucket=questions_bucket, Prefix=rewrite_prefix)
        
        if 'Contents' not in response or len(response['Contents']) == 0:
            raise Exception("No rewritten files found")
        
        # Get latest file by LastModified (any session)
        latest_file = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)[0]
        latest_key = latest_file['Key']
        print(f"Using latest rewritten file: {latest_key}")
        
        obj_response = s3.get_object(Bucket=questions_bucket, Key=latest_key)
        context_notes = obj_response['Body'].read().decode('utf-8')
        print(f"Loaded rewritten report ({len(context_notes)} characters)")
        
        # Build prompt for Bedrock (enhanced)
        prompt = f"""You are an expert investigator assistant for the Bahrain Public Prosecution. Based on the inputs below, generate 7–10 strategic interview questions that the investigator may use when speaking directly to the **suspect**. These questions may be used during interview preparation, in the interview itself, or as follow-up clarifications. Questions must focus on the suspect's actions, statements, movements, and involvement as described in the report. Police officers may be mentioned for context only, but questions must never target police conduct.

LEGAL CONTEXT
- Apply Bahraini criminal procedure law and evidentiary standards.
- Questions must align with Bahrain's requirements for lawful suspect questioning, fact establishment, corroboration, reliability assessment, and admissibility of evidence.
- Maintain neutrality and avoid accusatory or leading phrasing.

Session: {session_id}
Suspect: {witness}
Language: {language}
Context (rewritten report + notes): {context_notes}

REQUIREMENTS
1) Output MUST be ONLY a valid JSON array (no markdown, no extra commentary).
2) Each item MUST include: "id", "text", "context", "priority".
3) "priority" MUST be one of: High, Medium, Low.
4) All content MUST be written in {language}.
5) All questions MUST:
   - Be **direct questions addressed to the suspect** ("you").
   - Reference specific details from the report (names, locations, times, objects, actions).
   - Clarify the suspect's behavior, decisions, movements, statements, or interactions.
   - Stay neutral and legally appropriate (no assumptions of guilt or intent).
   - Be structured clearly and precisely for investigative use.
6) Questions MAY:
   - Be used pre-interview, during the interview, or after the interview.
   - Mention police officers ONLY as background reference points (e.g., location, presence).
7) Questions MUST NOT:
   - Be directed toward police officers.
   - Critique or examine police decisions or investigative steps.
   - Contain speculative or guilt-assuming phrasing.
8) Questions should be detailed and comprehensive, including specific references to dates, times, locations, names, and actions from the report.
9) Context should provide clear investigative rationale explaining why this question matters for the case.
10) Cover diverse investigative dimensions: timeline, sequence, physical actions, witness interactions, object handling, motivations, surroundings, events.
11) Avoid duplicates; ensure each question targets a distinct aspect of the suspect's involvement.
12) Order items by priority: High → Medium → Low.
13) IDs must be zero-padded: q01, q02, ..., up to q10.

OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON array
- NO markdown code blocks (no ```json or ```)
- NO explanatory text before or after the JSON
- Ensure all strings are properly escaped
- Questions can be as long as needed to be specific and detailed
- Context should be comprehensive and explain the investigative importance

JSON FORMAT:
[
  {{
    "id": "q01",
    "text": "Question text in {language}",
    "context": "Context in {language}",
    "priority": "High"
  }}
]

Generate 7–10 questions. Output ONLY the JSON array, nothing else."""

        questions = []
        max_retries = 3
        
        # Try Bedrock with retries
        if inference_profile_arn:
            for attempt in range(max_retries):
                try:
                    if 'nova' in inference_profile_arn.lower():
                        response = bedrock_runtime.invoke_model(
                            modelId=inference_profile_arn,
                            body=json.dumps({
                                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                                "inferenceConfig": {"maxTokens": 4000, "temperature": 0.7}
                            })
                        )
                        result = json.loads(response['body'].read())
                        content = result['output']['message']['content'][0]['text']
                    else:
                        print("The inference profile does not match a Nova model")
                        break
                    
                    # Extract and repair JSON
                    start = content.find('[')
                    end = content.rfind(']') + 1
                    if start >= 0 and end > start:
                        json_str = content[start:end]
                        parsed = False
                        
                        # Strategy 1: Direct parse
                        try:
                            questions = json.loads(json_str)
                            print(f"Generated {len(questions)} questions on attempt {attempt + 1}")
                            parsed = True
                            break
                        except json.JSONDecodeError:
                            pass
                        
                        # Strategy 2: Remove markdown
                        if not parsed:
                            try:
                                cleaned = json_str.replace('```json', '').replace('```', '').strip()
                                questions = json.loads(cleaned)
                                print(f"Generated {len(questions)} questions (cleaned)")
                                parsed = True
                                break
                            except json.JSONDecodeError:
                                pass
                        
                        # Strategy 3: Aggressive repair
                        if not parsed:
                            try:
                                import re
                                repaired = json_str.replace('\n', ' ').replace('\r', '')
                                questions = json.loads(repaired)
                                print(f"Generated {len(questions)} questions (repaired)")
                                parsed = True
                                break
                            except json.JSONDecodeError as e:
                                print(f"Parse failed attempt {attempt + 1}: {e}")
                                if attempt < max_retries - 1:
                                    print("Retrying...")
                                    continue
                                else:
                                    print(f"Failed after {max_retries} attempts")
                                    questions = []
                    
                except Exception as bedrock_error:
                    print(f"Bedrock error on attempt {attempt + 1}: {str(bedrock_error)}")
                    if attempt < max_retries - 1:
                        continue
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
        
        # Store in S3
        s3_key = f"advanced-analysis/questions/session-{session_id}/{timestamp.replace(':', '-')}.json"
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