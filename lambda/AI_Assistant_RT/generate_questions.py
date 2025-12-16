import json
import boto3
import os
import re
from datetime import datetime

# Initialize Bedrock client
bedrock_runtime = boto3.client(
    service_name='bedrock-runtime',
    region_name='us-east-1'
)

# Environment variables
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'amazon.nova-lite-v1:0')
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# Model configuration 
DEFAULT_TEMPERATURE = 0.7
TOP_P = 0.9
MAX_TOKENS = 2000

def lambda_handler(event, context):
    """
    Generate AI-powered investigation questions using Amazon Bedrock Nova Lite.
    """
    
    try:
        # Parse request body
        body = json.loads(event['body'])
        
        # Extract all fields
        case_id = body.get('caseId')
        session_id = body.get('sessionId')
        person_type = body.get('personType')
        case_summary = body.get('caseSummary')
        victim_testimony = body.get('victimTestimony')
        current_transcript = body.get('currentTranscript')
        language = body.get('language', 'English')
        question_count = body.get('questionCount', 5)
        previous_questions = body.get('previousQuestions', [])
        
        # Accept optional temperature parameter
        temperature = body.get('temperature', DEFAULT_TEMPERATURE)
        
        # Validate temperature range
        if not isinstance(temperature, (int, float)) or not (0.0 <= temperature <= 1.0):
            print(f"WARN: Invalid temperature {temperature}, using default {DEFAULT_TEMPERATURE}")
            temperature = DEFAULT_TEMPERATURE
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Generating {question_count} questions for case {case_id}, session {session_id}")
            print(f"INFO: Person type: {person_type}, Language: {language}")
            print(f"INFO: Temperature: {temperature}")
            print(f"INFO: Has case summary: {bool(case_summary)}")
            print(f"INFO: Has victim testimony: {bool(victim_testimony)}")
            print(f"INFO: Current transcript length: {len(current_transcript) if current_transcript else 0}")
            print(f"INFO: Previous questions count: {len(previous_questions)}")
        
        # Validation
        if not current_transcript or current_transcript.strip() == '':
            return error_response(400, "Current transcript is required and cannot be empty")
        
        if not case_summary:
            return error_response(400, "Case summary is required")
        
        # ✅ Generate questions with iterative regeneration to ensure required count
        questions = generate_unique_questions(
            case_summary=case_summary,
            victim_testimony=victim_testimony,
            current_transcript=current_transcript,
            person_type=person_type,
            language=language,
            required_count=question_count,
            previous_questions=previous_questions,
            temperature=temperature
        )
        
        if LOG_LEVEL == 'INFO':
            print(f"INFO: Successfully generated {len(questions)} questions with temperature {temperature}")
        
        return {
            'statusCode': 200,
            'headers': get_cors_headers(),
            'body': json.dumps({
                'success': True,
                'questions': questions,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            })
        }
        
    except Exception as e:
        print(f"ERROR: Question generation failed: {str(e)}")
        return error_response(500, f"Question generation failed: {str(e)}")

def build_bedrock_prompt(case_summary, victim_testimony, current_transcript, 
                         person_type, language, question_count, previous_questions):
    """
    Build structured prompt for Bedrock Nova Lite.
    
    NOTE: We may request MORE questions than the user asked for to account for duplicate filtering.
    The caller should specify the buffer in question_count.
    """
    
    # Determine language instructions
    if language.lower() == 'arabic':
        output_instruction = f"""قدم بالضبط {question_count} أسئلة بتنسيق JSON باللغة العربية.
جميع الأسئلة والتفسيرات والفئات يجب أن تكون باللغة العربية فقط."""
        lang_note = "⚠️ مهم جداً: استخدم اللغة العربية فقط في جميع الحقول (text, reasoning, sourceContext, category)."
        category_instruction = """الفئات المتاحة (استخدم الأسماء العربية):
- توضيح: لطلب معلومات أكثر وضوحاً أو تفصيلاً
- تحقق: لتأكيد الحقائق أو البيانات
- زمني: لتحديد تسلسل الأحداث
- دافع: لفهم الأسباب أو النوايا
- تناقض: لتحديد التناقضات بين الشهادات"""
        
        json_example = """مثال على التنسيق المطلوب:
[
  {
    "text": "السؤال هنا باللغة العربية",
    "category": "توضيح",
    "reasoning": "التفسير باللغة العربية",
    "sourceContext": "السياق باللغة العربية",
    "confidence": "high",
    "priority": "high"
  }
]"""
    else:
        output_instruction = f"""Provide exactly {question_count} questions in JSON format in English.
All questions, explanations, and categories MUST be in English only."""
        lang_note = "⚠️ CRITICAL: Use English ONLY for all fields (text, reasoning, sourceContext, category names)."
        category_instruction = """Available categories (use English names):
- clarification: Seeking clearer or more detailed information
- verification: Confirming facts or statements
- timeline: Establishing sequence of events
- motivation: Understanding reasons or intent
- contradiction: Identifying inconsistencies between testimonies"""
        
        json_example = """Example format required:
[
  {
    "text": "Your question here in English",
    "category": "clarification",
    "reasoning": "Brief explanation in English",
    "sourceContext": "Context in English",
    "confidence": "high",
    "priority": "high"
  }
]"""
    
    # Build prompt
    prompt_parts = [
        "You are an investigation assistant for Bahrain's Public Prosecution. Your role is to help investigators by generating relevant follow-up questions during witness testimonies.",
        "",
        lang_note,
        "=== CASE CONTEXT ===",
        case_summary,
        ""
    ]
    
    # Add victim testimony if available and relevant
    if victim_testimony and person_type in ['witness', 'accused']:
        prompt_parts.extend([
            "=== VICTIM'S TESTIMONY (For Cross-Reference) ===",
            victim_testimony,
            ""
        ])
    
    # Add current testimony
    prompt_parts.extend([
        f"=== CURRENT {person_type.upper()}'S TESTIMONY ===",
        current_transcript,
        ""
    ])
    
    # ✅ ENHANCED: Stricter deduplication instructions
    if previous_questions:
        prompt_parts.extend([
            "=== PREVIOUSLY ASKED QUESTIONS - STRICT AVOIDANCE REQUIRED ===",
            "",
            "🚫 CRITICAL CONSTRAINT: Do NOT generate questions that:",
            "1. Are word-for-word copies of questions below",
            "2. Are paraphrased versions asking the same thing",
            "3. Target the same specific information using different wording",
            "4. Translate questions below to a different language",
            "",
            "ENFORCEMENT RULE:",
            "Before including any question in your output, mentally check:",
            "'Does this question seek the SAME INFORMATION as any question below?'",
            "If YES → reject it and think of a completely different aspect to explore",
            "If NO → include it",
            "",
            "EXAMPLES OF WHAT COUNTS AS DUPLICATES:",
            "- 'What time did this occur?' vs 'When exactly did this happen?' → DUPLICATE",
            "- 'Who was present?' vs 'Who witnessed this event?' → DUPLICATE",
            "- 'What did they say?' vs 'Can you repeat their exact words?' → DUPLICATE",
            "- English question vs same question translated to Arabic → DUPLICATE",
            "",
            "Questions you MUST NOT repeat in any form:",
            "\n".join([f"  {i+1}. {q}" for i, q in enumerate(previous_questions)]),
            "",
            "⚠️ If you generate ANY question similar to the above, it will be automatically rejected.",
            ""
        ])
    
    # Task and quality standards
    prompt_parts.extend([
        "=== YOUR TASK ===",
        output_instruction,
        lang_note,
        "",
        "=== QUESTION QUALITY STANDARDS ===",
        "",
        "1. BE SPECIFIC TO THIS CASE:",
        "   - Reference actual names, dates, locations, and allegations from the case context",
        f"   - Connect what the victim/complainant reported with what this {person_type} is saying",
        "   - Use exact phrases from testimonies, not generic observations",
        "",
        "2. RESOLVE DISCREPANCIES & CLARIFY VAGUENESS:",
        "   - Identify where testimony differs from other accounts",
        '   - Push for precision when vague language is used ("something," "around," "maybe")',
        "   - Ask for exact details instead of approximations",
        "",
        "3. GATHER VERIFIABLE FACTS:",
        "   - Focus on what was directly seen, heard, or experienced",
        "   - Ask for observable details: exact words, specific times, physical positions",
        "   - Seek information that can be corroborated by others",
        "",
        "4. TEST RELIABILITY:",
        "   - Probe how the person knows what they claim to know",
        "   - Ask about their vantage point, attention level, and certainty",
        "   - Verify direct knowledge vs assumptions",
        "",
        "=== CRITICAL: CONTRADICTION DETECTION ===",
        "",
        "When victim testimony is available, ACTIVELY LOOK FOR CONTRADICTIONS:",
        "",
        "CONTRADICTION INDICATORS:",
        "- Victim said X happened, but this person says Y happened",
        "- Victim reported specific details that conflict with current testimony",
        "- Timeline discrepancies (victim said 'morning', witness says 'evening')",
        "- Different descriptions of same event, object, or person",
        "- Conflicting statements about who was present, what was said, or what occurred",
        "",
        "When you identify ANY discrepancy between testimonies:",
        "→ Create a 'contradiction' question that explicitly highlights the conflict",
        "→ Reference BOTH accounts in the question",
        "→ Ask the person to explain the difference",
        "",
        "EXAMPLE CONTRADICTION QUESTIONS:",
        '- "The victim stated X occurred at [time/place], but you mentioned Y. Can you explain this difference?"',
        '- "According to the victim\'s account, [detail A], however you described [detail B]. How do you account for this discrepancy?"',
        '- "The victim reported that [specific claim], which contradicts your statement about [conflicting claim]. Can you clarify?"',
        "",
        "=== QUESTION PATTERNS (use the thinking approach, not exact wording) ===",
        "",
        "PATTERN 1 - When testimonies conflict:",
        "Ask to clarify by comparing what victim/complainant said vs what they observed",
        "",
        "PATTERN 2 - When testimony is vague:",
        "Push for exact details by highlighting the vague language used",
        "",
        "PATTERN 3 - When testing credibility:",
        "Question how they could know what they claim from their position/situation",
        "",
        "PATTERN 4 - When finding corroboration:",
        "Identify people or evidence mentioned and ask if they observed them",
        "",
        "=== AVOID ===",
        '- Generic questions: "What happened next?" "Tell me more"',
        "- Questions about feelings or opinions",
        "- Yes/no questions that don't gather new facts",
        "- Questions already clearly answered",
        "- Repeating any previously asked questions",
        "",
        "=== QUESTION CATEGORIES ===",
        "Assign each question one of these categories:",
        "- clarification: Seeking clearer or more detailed information",
        "- verification: Confirming facts or statements",
        "- timeline: Establishing sequence of events",
        "- motivation: Understanding reasons or intent",
        "- contradiction: Identifying inconsistencies between testimonies or within same testimony",  
        "",
        "⚠️ CRITICAL: You MUST use ONLY these 5 category names. Do NOT create new categories.",
        "",
        "=== CONFIDENCE SCORING (AI System Certainty) ===",
        "",
        "Rate how confident the AI system is that this question is well-formed and relevant:",
        "",
        "HIGH CONFIDENCE - When you are certain that:",
        "- The question directly relates to testimony or case facts",
        "- The question is clear, specific, and answerable",
        "- The reasoning is solid and the question serves a clear purpose",
        "- You have sufficient context to formulate this question",
        "",
        "MEDIUM CONFIDENCE - When:",
        "- The question is reasonable but based on limited context",
        "- You're making some assumptions to ask this question",
        "- The connection to case facts is less direct",
        "",
        "=== PRIORITY SCORING (Investigative Importance) ===",
        "",
        "Rate how critical this question is to the investigation:",
        "",
        "HIGH PRIORITY - Questions that:",
        "- Address direct contradictions between testimonies",
        "- Target key allegations central to the case",
        "- Test credibility on main claims",
        "- Could prove or disprove critical facts",
        "- Resolve major discrepancies or vagueness",
        "- Seek evidence that can change case outcome",
        "",
        "MEDIUM PRIORITY - Questions that:",
        "- Clarify background or contextual details",
        "- Verify secondary facts",
        "- Establish timeline for supporting events",
        "- Explore minor inconsistencies",
        "- Fill in peripheral information",
        "",
        "=== OUTPUT FORMAT ===",
        "Return ONLY a valid JSON array with this exact structure:",
        "[",
        "  {",
        '    "text": "Your question here",',
        '    "category": "clarification|verification|timeline|motivation|contradiction",',
        '    "reasoning": "Brief explanation of why this question is important",',
        '    "sourceContext": "What prompted this question (e.g., case summary, victim testimony, current testimony)",',
        '    "confidence": "high|medium",',
        '    "priority": "high|medium"',
        "  }",
        "]",
        "",
        "FINAL COMPLIANCE CHECK:",
        "Ensure all questions maintain professional dignity and respect appropriate for Bahrain's legal proceedings.",
        "Generate the questions now:"
    ])
    
    return "\n".join(prompt_parts)

def generate_unique_questions(case_summary, victim_testimony, current_transcript,
                              person_type, language, required_count, previous_questions, temperature):
    """
    Generate questions with iterative regeneration to ensure we get the required count.
    
    Strategy:
    1. Request MORE questions initially (1.5x buffer)
    2. Filter duplicates
    3. If still not enough, regenerate with rejected questions added to previousQuestions
    4. Maximum 3 attempts to avoid infinite loops
    
    Args:
        All parameters from original lambda_handler
        required_count: The EXACT number of questions the user requested
        
    Returns:
        List of exactly required_count unique questions (or as many as possible)
    """
    MAX_ATTEMPTS = 3
    BUFFER_MULTIPLIER = 1.5  # Request 50% extra initially
    
    all_unique_questions = []
    cumulative_previous_questions = list(previous_questions) if previous_questions else []
    
    for attempt in range(1, MAX_ATTEMPTS + 1):
        # Calculate how many more questions we need
        remaining_needed = required_count - len(all_unique_questions)
        
        if remaining_needed <= 0:
            break  # We have enough questions
        
        # Request extra questions with buffer (only on first attempt)
        if attempt == 1:
            request_count = int(remaining_needed * BUFFER_MULTIPLIER)
        else:
            # On retry, request exactly what we need (no buffer)
            request_count = remaining_needed
        
        if LOG_LEVEL == 'INFO':
            print(f"🔄 Attempt {attempt}/{MAX_ATTEMPTS}: Requesting {request_count} questions")
            print(f"   Already have: {len(all_unique_questions)}, Need: {required_count}")
            print(f"   Avoiding {len(cumulative_previous_questions)} previous questions")
        
        # Build prompt for this attempt
        prompt = build_bedrock_prompt(
            case_summary=case_summary,
            victim_testimony=victim_testimony,
            current_transcript=current_transcript,
            person_type=person_type,
            language=language,
            question_count=request_count,
            previous_questions=cumulative_previous_questions
        )
        
        # Call Bedrock
        bedrock_response = invoke_bedrock(prompt, temperature)
        
        # Parse response
        new_questions = parse_bedrock_response(
            bedrock_response,
            expected_count=request_count,
            previous_questions=cumulative_previous_questions
        )
        
        if LOG_LEVEL == 'INFO':
            print(f"✅ Attempt {attempt} generated {len(new_questions)} unique questions")
        
        # Add new unique questions to our collection
        all_unique_questions.extend(new_questions)
        
        # Add these questions to cumulative list (so we don't regenerate them)
        cumulative_previous_questions.extend([q['text'] for q in new_questions])
        
        # If we got fewer questions than requested, Bedrock is struggling
        if len(new_questions) < request_count * 0.5:  # Less than 50% of what we asked for
            if LOG_LEVEL == 'INFO':
                print(f"⚠️ Bedrock only generated {len(new_questions)}/{request_count} - may need higher temperature")
            # Optionally increase temperature for next attempt
            temperature = min(0.95, temperature + 0.1)
    
    # Return exactly the required count (or whatever we managed to get)
    final_questions = all_unique_questions[:required_count]
    
    if LOG_LEVEL == 'INFO':
        print(f"📊 Final result: {len(final_questions)}/{required_count} unique questions after {attempt} attempts")
        if len(final_questions) < required_count:
            print(f"⚠️ WARNING: Could only generate {len(final_questions)} unique questions (requested {required_count})")
    
    # Re-assign sequential IDs
    for i, q in enumerate(final_questions, 1):
        q['id'] = f"q{i}"
    
    return final_questions

def invoke_bedrock(prompt, temperature=DEFAULT_TEMPERATURE):
    """
    Call Amazon Bedrock Nova Lite model with custom temperature and category validation.
    """
    
    request_body = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "inferenceConfig": {
            "maxTokens": MAX_TOKENS,
            "temperature": temperature,
            "topP": TOP_P
        }
    }
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        
        # Extract text from Nova Lite response
        content = response_body.get('output', {}).get('message', {}).get('content', [])
        
        if content and len(content) > 0:
            raw_text = content[0].get('text', '')
            
            # ✅ VALIDATE AND FIX CATEGORIES BEFORE RETURNING
            validated_text = validate_and_fix_categories(raw_text)
            
            return validated_text
        
        raise Exception("No content in Bedrock response")
        
    except Exception as e:
        print(f"ERROR: Bedrock invocation failed: {str(e)}")
        raise


def validate_and_fix_categories(bedrock_text):
    """
    Validate that all question categories are in the allowed list.
    If not, map invalid categories to valid ones.
    
    Allowed categories: clarification, verification, timeline, motivation, contradiction
    
    Args:
        bedrock_text: Raw JSON text from Bedrock
        
    Returns:
        Corrected JSON text with valid categories
    """
    
    VALID_CATEGORIES = ['clarification', 'verification', 'timeline', 'motivation', 'contradiction']
    
    # Category mapping for common invalid categories
    CATEGORY_MAPPING = {
        'credibility': 'verification',
        'evidence': 'verification',
        'behavioral': 'clarification',
        'detail': 'clarification',
        'factual': 'verification',
        'consistency': 'contradiction',
        'corroboration': 'verification',
        'observation': 'verification',
        'background': 'clarification',
        'context': 'clarification'
    }
    
    try:
        # Clean markdown if present
        cleaned_text = bedrock_text.strip()
        if cleaned_text.startswith('```json'):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith('```'):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith('```'):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()
        
        # Parse JSON
        questions_data = json.loads(cleaned_text)
        
        # Validate and fix categories
        fixed_count = 0
        for question in questions_data:
            original_category = question.get('category', '').lower()
            
            # Check if category is valid
            if original_category not in VALID_CATEGORIES:
                # Try to map to valid category
                mapped_category = CATEGORY_MAPPING.get(original_category, 'clarification')
                
                if LOG_LEVEL == 'INFO':
                    print(f"⚠️ CATEGORY FIX: '{original_category}' → '{mapped_category}'")
                    print(f"   Question: {question.get('text', '')[:80]}...")
                
                question['category'] = mapped_category
                fixed_count += 1
        
        if fixed_count > 0 and LOG_LEVEL == 'INFO':
            print(f"✅ Fixed {fixed_count} invalid categor{'y' if fixed_count == 1 else 'ies'}")
        
        # Return corrected JSON as string
        return json.dumps(questions_data)
        
    except json.JSONDecodeError:
        # If JSON parsing fails, return original text (parse_bedrock_response will handle error)
        if LOG_LEVEL == 'INFO':
            print("WARN: Could not parse JSON for category validation, returning original")
        return bedrock_text
    except Exception as e:
        print(f"ERROR: Category validation failed: {str(e)}")
        return bedrock_text


def calculate_similarity(q1: str, q2: str) -> float:
    """
    Calculate similarity between two questions using word overlap.
    Returns score from 0.0 (completely different) to 1.0 (identical).
    
    Uses Jaccard similarity: |intersection| / |union| of word sets.
    """
    # Remove punctuation and convert to lowercase
    q1_clean = re.sub(r'[^\w\s]', '', q1.lower())
    q2_clean = re.sub(r'[^\w\s]', '', q2.lower())
    
    q1_words = set(q1_clean.split())
    q2_words = set(q2_clean.split())
    
    if not q1_words or not q2_words:
        return 0.0
    
    # Jaccard similarity: intersection / union
    intersection = len(q1_words.intersection(q2_words))
    union = len(q1_words.union(q2_words))
    
    return intersection / union if union > 0 else 0.0

def remove_duplicate_questions(new_questions: list, previous_questions: list, similarity_threshold: float = 0.55) -> list:
    """
    Filter out questions too similar to previous ones.
    
    Args:
        new_questions: List of newly generated question dicts
        previous_questions: List of previous question strings
        similarity_threshold: Maximum allowed similarity (default 0.55 = 55% word overlap)
                             LOWERED from 0.65 to catch more paraphrased duplicates
    
    Returns:
        Filtered list of unique questions
    """
    if not previous_questions:
        return new_questions
    
    filtered = []
    
    for new_q in new_questions:
        new_text = new_q.get('text', '')
        is_duplicate = False
        
        # Check against all previous questions
        for prev_text in previous_questions:
            similarity = calculate_similarity(new_text, prev_text)
            
            if similarity >= similarity_threshold:
                if LOG_LEVEL == 'INFO':
                    print(f"⚠️ DUPLICATE DETECTED (similarity: {similarity:.2%})")
                    print(f"   New: {new_text[:80]}...")
                    print(f"   Previous: {prev_text[:80]}...")
                is_duplicate = True
                break
        
        # Also check against already-filtered questions in this batch
        if not is_duplicate:
            for filtered_q in filtered:
                similarity = calculate_similarity(new_text, filtered_q.get('text', ''))
                
                if similarity >= similarity_threshold:
                    if LOG_LEVEL == 'INFO':
                        print(f"⚠️ DUPLICATE IN BATCH (similarity: {similarity:.2%})")
                    is_duplicate = True
                    break
        
        if not is_duplicate:
            filtered.append(new_q)
        else:
            if LOG_LEVEL == 'INFO':
                print(f"❌ Filtered duplicate: {new_text[:100]}")
    
    return filtered

def parse_bedrock_response(bedrock_text, expected_count, previous_questions=None):
    """
    Parse Bedrock response, structure questions, and filter duplicates.
    
    Args:
        bedrock_text: Raw JSON text from Bedrock
        expected_count: Number of questions requested
        previous_questions: List of previous question texts to avoid duplicating
    """
    
    try:
        # Remove markdown code blocks if present
        cleaned_text = bedrock_text.strip()
        if cleaned_text.startswith('```json'):
            cleaned_text = cleaned_text[7:]
        if cleaned_text.startswith('```'):
            cleaned_text = cleaned_text[3:]
        if cleaned_text.endswith('```'):
            cleaned_text = cleaned_text[:-3]
        cleaned_text = cleaned_text.strip()
        
        # Parse JSON
        questions_data = json.loads(cleaned_text)
        
        # Structure with IDs (before filtering)
        questions = []
        for i, q in enumerate(questions_data, 1):
            questions.append({
                'id': f"q{i}",
                'text': q.get('text', ''),
                'category': q.get('category', 'clarification'),
                'reasoning': q.get('reasoning', ''),
                'sourceContext': q.get('sourceContext', ''),
                'confidence': q.get('confidence', 'medium'),  
                'priority': q.get('priority', 'medium')       
            })
        
        # ✅ FILTER DUPLICATES if previous questions provided
        if previous_questions and len(previous_questions) > 0:
            original_count = len(questions)
            questions = remove_duplicate_questions(
                questions, 
                previous_questions,
                similarity_threshold=0.55  # ✅ Lowered from 0.65 for stricter filtering
            )
            
            if LOG_LEVEL == 'INFO':
                filtered_count = original_count - len(questions)
                if filtered_count > 0:
                    print(f"✅ Filtered {filtered_count} duplicate(s) from {original_count} generated questions")
                else:
                    print(f"✅ All {original_count} questions are unique")
        
        # Return only the requested count after filtering
        final_questions = questions[:expected_count]
        
        # Re-assign IDs sequentially after filtering
        for i, q in enumerate(final_questions, 1):
            q['id'] = f"q{i}"
        
        return final_questions
        
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse Bedrock JSON response: {str(e)}")
        print(f"Raw response: {bedrock_text}")
        raise Exception("Failed to parse AI response")

def error_response(status_code, message):
    """Return error response"""
    return {
        'statusCode': status_code,
        'headers': get_cors_headers(),
        'body': json.dumps({
            'success': False,
            'error': message
        })
    }

def get_cors_headers():
    """Return CORS headers for API Gateway"""
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }