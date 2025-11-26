"""
AWS Lambda handler for rewriting Arabic investigation reports using AWS Bedrock (Nova Lite).

This handler:
1. Reads investigation reports from S3 (mock data or user-provided)
2. Sends text to AWS Bedrock Nova Lite for professional rewriting
3. Saves the rewritten report back to S3
4. Returns the result as JSON to the frontend

Supports chunking for future implementation of long document handling.
"""

import json
import boto3
import os
import logging
import hashlib
from datetime import datetime
from typing import Dict, Tuple, Any, Optional

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")
s3_client = boto3.client("s3")

# Configuration
BUCKET_NAME = os.environ.get("BUCKET_NAME", "vision-investigation-system-052904446370")
MODEL_ID = "amazon.nova-lite-v1:0"
DEFAULT_MOCK_S3_KEY = "rewritten/report.txt"
# Balanced limit: processes in 15-20 seconds while maintaining quality
MAX_INPUT_CHARS = 5000  # Sweet spot between speed and quality

# CORS headers
CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
}


def create_response(status_code: int, body: Dict[str, Any], headers: Optional[Dict] = None) -> Dict:
    """Return API Gateway compatible response dict."""
    response_headers = CORS_HEADERS.copy()
    if headers:
        response_headers.update(headers)

    return {
        "statusCode": status_code,
        "headers": response_headers,
        "body": json.dumps(body)
    }


def handle_cors_preflight() -> Dict:
    """Return empty 200 for OPTIONS request."""
    return create_response(200, {})


def get_safe_log_info(text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Return safe hashed log info without exposing private data."""
    return {
        "text_hash": hashlib.md5(text.encode()).hexdigest()[:8],
        "text_length": len(text),
        "session_id": session_id or "unknown"
    }


def read_text_from_s3(bucket: str, key: str) -> str:
    """Read text file from S3 bucket."""
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read().decode("utf-8")
    except Exception as e:
        logger.error(f"❌ Failed to read s3://{bucket}/{key} - {e}")
        raise


def get_input_text(event: Dict) -> Tuple[str, Optional[str]]:
    """Load text either from request body OR S3 OR default mock file."""
    session_id = None
    body = {}

    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            body = {}

    session_id = body.get("sessionId")
    text = body.get("text")

    if text:
        logger.info(f"➡ Using text from request body: {get_safe_log_info(text, session_id)}")
        # apply truncation if needed
        if len(text) > MAX_INPUT_CHARS:
            logger.info(
                f"Input too long ({len(text)} chars). Truncating to {MAX_INPUT_CHARS} characters."
            )
            text = text[:MAX_INPUT_CHARS]
        return text, session_id

    s3_key = body.get("s3Key")
    if s3_key:
        text = read_text_from_s3(BUCKET_NAME, s3_key)
        logger.info(f"➡ Loaded text from S3: {get_safe_log_info(text, session_id)}")
        if len(text) > MAX_INPUT_CHARS:
            logger.info(
                f"Input too long ({len(text)} chars). Truncating to {MAX_INPUT_CHARS} characters."
            )
            text = text[:MAX_INPUT_CHARS]
        return text, session_id

    text = read_text_from_s3(BUCKET_NAME, DEFAULT_MOCK_S3_KEY)
    logger.info(f"➡ Loaded DEFAULT mock text: {get_safe_log_info(text, session_id)}")
    if len(text) > MAX_INPUT_CHARS:
        logger.info(
            f"Input too long ({len(text)} chars). Truncating to {MAX_INPUT_CHARS} characters."
        )
        text = text[:MAX_INPUT_CHARS]
    return text, session_id


def build_rewrite_prompts(original_text: str) -> Tuple[str, str]:
    """Generate system + user prompts for Nova Lite."""
    system = """أنت مساعد متخصص في إعادة صياغة تقارير التحقيق القانونية للنيابة العامة والشرطة في مملكة البحرين.

مهمتك: إعادة كتابة التقرير بشكل احترافي ومنظم مع الحفاظ على كافة المعلومات.

التعليمات الإلزامية:
1. احتفظ بجميع الأسماء والتواريخ والأرقام والحقائق كما هي تماماً
2. لا تضف أي معلومات جديدة غير موجودة في النص الأصلي
3. لا تحذف أي تفاصيل مهمة أو شهادات
4. استخدم اللغة العربية الفصحى فقط
5. اتبع الأسلوب الرسمي القانوني
6. صحح الأخطاء الإملائية والنحوية
7. نظم المحتوى بشكل منطقي ومتسلسل
8. استخدم العناوين الواضحة والجداول حيث يلزم
9. أكمل التقرير بالكامل من البداية للنهاية دون توقف

التنسيق المطلوب:
- استخدم Markdown للعناوين (# ## ###)
- استخدم الجداول للبيانات المنظمة
- اكتب بوضوح واحترافية
"""

    user = f"""أعد صياغة تقرير التحقيق التالي بشكل احترافي ومنظم:

{original_text}

مهم جداً: لا تكتب أرقام الصفحات مثل "27 / 1 صفحة" أو "صفحة: 5" نهائياً.

اكتب التقرير المعاد صياغته بالكامل:
"""
    return system, user


def call_bedrock_for_rewrite(original_text: str) -> str:
    """
    Call AWS Bedrock Nova Lite to rewrite the investigation report.
    """
    system_prompt, user_prompt = build_rewrite_prompts(original_text)

    # Nova Lite expects a top-level `system` field for system instructions
    request_body = {
        "system": [{"text": system_prompt}],
        "messages": [
            {"role": "user", "content": [{"text": user_prompt}]}
        ],
        # Balanced for speed AND completeness: 2500 tokens = ~1800 words, processes in 15-20 sec
        "inferenceConfig": {"maxTokens": 2500, "temperature": 0.15, "topP": 0.85}
    }

    try:
        logger.info("Invoking Bedrock Nova Lite model for rewriting")
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(request_body)
        )

        response_body = json.loads(response["body"].read())
        try:
            rewritten_text = response_body["output"]["message"]["content"][0]["text"]
        except (KeyError, IndexError) as e:
            logger.error(f"Unexpected Bedrock response format: {e}")
            raise KeyError("Missing expected fields in Bedrock response") from e

        logger.info(f"Bedrock rewrite completed. Output length: {len(rewritten_text)}")
        return rewritten_text

    except Exception as e:
        logger.error(f"Bedrock invocation failed: {str(e)}")
        raise


def save_rewritten_report_to_s3(rewritten: str, original: str, session_id: Optional[str]) -> str:
    """Upload rewritten text to S3 and return new key."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    sid = session_id or "unknown"
    key = f"rewritten/{sid}_{timestamp}_report.txt"

    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=key,
        Body=rewritten.encode("utf-8"),
        Metadata={"originalLength": str(len(original)), "rewrittenLength": str(len(rewritten))}
    )

    return key


def lambda_handler(event: Dict, context: Any) -> Dict:
    """MAIN ENTRYPOINT"""
    try:
        request_id = getattr(context, "aws_request_id", "unknown")
        http_method = event.get("httpMethod", "").upper()
        logger.info(f"➡ Handling {http_method} | Request ID = {request_id}")

        # CORS preflight
        if http_method == "OPTIONS":
            return handle_cors_preflight()

        # Only POST allowed
        if http_method != "POST":
            logger.warning(f"Unsupported HTTP method: {http_method}")
            return create_response(
                405,
                {"status": "error", "message": "Method not allowed. Use POST or OPTIONS."}
            )

        # Extract input text and session ID
        text, session_id = get_input_text(event)

        if not text or not text.strip():
            logger.warning("No text provided for rewriting")
            return create_response(
                400,
                {"status": "error", "message": "No text provided for rewriting"}
            )

        log_info = get_safe_log_info(text, session_id)
        logger.info(f"Processing rewrite request. Request ID: {request_id}. Info: {log_info}")

        # Call Bedrock to rewrite
        rewritten_text = call_bedrock_for_rewrite(text)

        # Save to S3
        output_s3_key = save_rewritten_report_to_s3(rewritten_text, text, session_id)

        # Return success response
        response_data = {
            "status": "success",
            "rewrittenText": rewritten_text,
            "outputS3Key": output_s3_key,
            "model": MODEL_ID
        }

        logger.info(f"Rewrite request completed successfully. Request ID: {request_id}")
        return create_response(200, response_data)

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {str(e)}")
        return create_response(
            400,
            {"status": "error", "message": f"Invalid JSON in request: {str(e)}"}
        )

    except KeyError as e:
        logger.error(f"Missing required field in response: {str(e)}")
        return create_response(
            500,
            {"status": "error", "message": f"Unexpected response format from Bedrock: {str(e)}"}
        )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        return create_response(
            500,
            {"status": "error", "message": f"Internal server error: {str(e)}"}
        )
