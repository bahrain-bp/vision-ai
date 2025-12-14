import json
import boto3
import os

# Initialize clients
bedrock_runtime = boto3.client('bedrock-runtime', region_name='us-east-1')
s3_client = boto3.client('s3')

# Environment variables
BUCKET_NAME = os.environ.get('BUCKET_NAME')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'amazon.nova-lite-v1:0')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

def lambda_handler(event, context):
    """
    Evaluate manually entered question using Bedrock.
    
    Input:
    {
        "question": "User's question text",
        "caseId": "CASE-001",
        "sessionId": "session-123",
        "personType": "witness",
        "caseSummary": "",
        "currentTranscript": "..."
    }
    
    Returns:
    {
        "success": true,
        "evaluation": {
            "clarity": 85,
            "relevance": 90,
            "appropriateness": 95,
            "category": "verification",
            "issues": ["Could be more specific"],
            "suggestions": ["Add timeframe"],
            "improvedVersion": "...",
            "overallScore": 90
        }
    }
    """
    
    try:
        body = json.loads(event['body'])
        
        question = body.get('question')
        case_id = body.get('caseId')
        person_type = body.get('personType')
        current_transcript = body.get('currentTranscript', '')
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Evaluating question for case {case_id}")
            print(f"INFO: Question: {question[:100]}...")
        
        # Fetch case summary from S3
        case_summary = get_case_summary(case_id)
        
        # Build evaluation prompt
        prompt = build_evaluation_prompt(
            question=question,
            case_summary=case_summary,
            current_transcript=current_transcript,
            person_type=person_type
        )
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Calling Bedrock for evaluation")
        
        # Call Bedrock
        evaluation = invoke_bedrock(prompt)
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Evaluation complete - Score: {evaluation.get('overallScore')}")
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'success': True,
                'evaluation': evaluation
            })
        }
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

def get_case_summary(case_id):
    """
    Fetch case summary from S3
    """
    try:
        summary_key = f"cases/{case_id}/police-summary.txt"
        
        response = s3_client.get_object(
            Bucket=BUCKET_NAME,
            Key=summary_key
        )
        
        case_summary = response['Body'].read().decode('utf-8')
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Retrieved case summary ({len(case_summary)} chars)")
        
        return case_summary
        
    except s3_client.exceptions.NoSuchKey:
        print(f"WARN: Case summary not found for {case_id}")
        return "Case summary not available"
    except Exception as e:
        print(f"ERROR: Failed to fetch case summary: {str(e)}")
        return "Case summary not available"

def build_evaluation_prompt(question, case_summary, current_transcript, person_type):
    """
    Build the evaluation prompt for Bedrock
    """
    # Truncate transcript if too long (to save tokens)
    truncated_transcript = current_transcript[:1000] if len(current_transcript) > 1000 else current_transcript
    
    return f"""You are an expert legal investigator trainer for Bahrain's Public Prosecution. Evaluate this question.

CASE CONTEXT:
{case_summary[:500]}

CURRENT TESTIMONY:
{truncated_transcript}

PERSON BEING QUESTIONED: {person_type}

QUESTION TO EVALUATE:
"{question}"

EVALUATION CRITERIA:

1. CLARITY (0-100): Clear, specific, unambiguous?
   - Deduct for vague terms, compound questions, confusing structure

2. RELEVANCE (0-100): Relevant to case and testimony?
   - Award for connecting to case facts, addressing gaps
   - Deduct for irrelevant tangents

3. APPROPRIATENESS (0-100): Follows legal/cultural standards?
   - Respect Bahraini norms, avoid leading questions, maintain dignity

4. CATEGORY: clarification, verification, timeline, motivation, or contradiction

5. ISSUES: List specific problems (empty array if none)

6. SUGGESTIONS: List improvements (empty array if none)

7. IMPROVED VERSION: Better phrasing (null if already good)

8. OVERALL SCORE: Average of clarity, relevance, appropriateness

Return ONLY valid JSON (no markdown, no explanation):
{{
  "clarity": 85,
  "relevance": 90,
  "appropriateness": 95,
  "category": "verification",
  "issues": [],
  "suggestions": [],
  "improvedVersion": null,
  "overallScore": 90
}}"""

def invoke_bedrock(prompt):
    """
    Call Bedrock Nova Lite model
    """
    request_body = {
        "messages": [{
            "role": "user",
            "content": [{"text": prompt}]
        }],
        "inferenceConfig": {
            "maxTokens": 1000,
            "temperature": 0.3,  # Lower for consistent evaluation
            "topP": 0.9
        }
    }
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        content = response_body['output']['message']['content'][0]['text']
        
        # Clean up response (remove markdown if present)
        cleaned = content.strip()
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        if cleaned.startswith('```'):
            cleaned = cleaned[3:]
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        
        # Parse JSON
        evaluation = json.loads(cleaned)
        
        return evaluation
        
    except Exception as e:
        print(f"ERROR: Bedrock invocation failed: {str(e)}")
        raise

def get_cors_headers():
    """
    Return CORS headers for API Gateway
    """
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }