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
        context_notes = body.get('contextNotes', '')
        
        print(f"Generating questions for session: {session_id}")
        
        # Try to fetch police report from S3 if contextNotes not provided
        if not context_notes:
            try:
                report_key = f"advanced-analysis/police-reports/{session_id}/report.txt"
                print(f"Attempting to fetch police report from S3: {report_key}")
                response = s3.get_object(Bucket=questions_bucket, Key=report_key)
                context_notes = response['Body'].read().decode('utf-8')
                print(f"Successfully loaded police report from S3 ({len(context_notes)} characters)")
            except Exception as s3_error:
                print(f"No police report found in S3: {s3_error}")
                context_notes = 'General investigation session'
        
        # Build prompt for Bedrock (enhanced)
        prompt = f"""You are an expert investigator assistant for the Bahrain Public Prosecution. Based on the inputs below, generate 7–10 strategic FOLLOW-UP interview questions (post-interview) that help clarify, confirm, or expand critical details before finalizing the case report.

LEGAL CONTEXT
- Apply Bahraini criminal procedure law and evidentiary standards.
- Questions must align with Bahrain's legal framework for witness testimony, evidence collection, and case documentation.
- Consider requirements under Bahraini law for establishing facts, corroboration, and admissibility of evidence.

Session: {session_id}
Witness: {witness}
Language: {language}
Context (rewritten report + notes): {context_notes}

REQUIREMENTS
1) Output MUST be ONLY a valid JSON array (no markdown, no leading/trailing text).
2) Each item MUST have exactly these fields: "id", "text", "context", "priority".
3) "priority" MUST be one of "High", "Medium", "Low".
4) Write all content in the specified Language exactly: {language}.
5) Questions MUST be neutral, non-leading, and legally appropriate under Bahraini law (no speculation or accusations).
6) Avoid duplicates; cover diverse angles (who/what/when/where/why/how, corroboration, scope, sequence, specifics).
7) Keep each "text" ≤ 140 characters; each "context" ≤ 140 characters.
8) Prefer questions that:
   - Establish timeline and sequence of events
   - Identify other witnesses, exhibits, or corroborating evidence
   - Clarify ambiguities or fill information gaps from the Context
   - Pin down specific, verifiable details (times, locations, objects, roles)
9) Do NOT restate contradictions as accusations; phrase as clarifying prompts.
10) Order the array by priority: High first, then Medium, then Low.

RETURN ONLY THIS JSON SHAPE:
[
  {{
    "id": "q01",
    "text": "Your question here (≤140 chars, {language})",
    "context": "Why this question matters (≤140 chars, {language})",
    "priority": "High"
  }}
]

Generate 7–10 items total, using zero-padded ids: q01, q02, ..."""

        questions = []
        
        # Try Bedrock first
        if inference_profile_arn:
            try:
                # Different API format for different models
                if 'nova' in inference_profile_arn.lower():
                    # Amazon Nova format
                    response = bedrock_runtime.invoke_model(
                        modelId=inference_profile_arn,
                        body=json.dumps({
                            "messages": [{"role": "user", "content": [{"text": prompt}]}],
                            "inferenceConfig": {"maxTokens": 2000, "temperature": 0.7}
                        })
                    )
                    result = json.loads(response['body'].read())
                    content = result['output']['message']['content'][0]['text']

                else: print("The inference profile does not match a Nova model")
                
                # Extract JSON from response
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
        
        # Store in S3 (optional for testing)
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
                'Content-Type': 'application/json; charset=utf-8'
            },
            'body': json.dumps({
                'sessionId': session_id,
                'questions': questions,
                's3ObjectKey': s3_key
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        print(f"Error generating questions: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json; charset=utf-8'
            },
            'body': json.dumps({
                'error': 'Failed to generate questions',
                'details': str(e)
            }, ensure_ascii=False)
        }