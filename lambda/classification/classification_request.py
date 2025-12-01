import json
import logging
import os
from typing import Any, Dict

import boto3
from botocore.config import Config

# Clients
s3 = boto3.client("s3")
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    config=Config(read_timeout=60, connect_timeout=60),
)

# Env
BUCKET_NAME = os.environ["BUCKET_NAME"]
MODEL_ID = os.environ.get("NOVA_MODEL_ID", "amazon.nova-lite-v1:0")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}


def get_user_sub(event: Dict[str, Any]) -> str | None:
    authorizer = event.get("requestContext", {}).get("authorizer", {}) or {}
    claims = authorizer.get("claims") or authorizer.get("jwt", {}).get("claims") or {}
    return claims.get("sub")


def error_response(status: int, message: str) -> Dict[str, Any]:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": message}),
    }


def parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(event.get("body", "{}"))
    except Exception:
        return {}


def extract_json_block(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        return text[start : end + 1]
    return text


def classify_report(text: str) -> Dict[str, Any]:
    """
    Call Nova Lite to classify a report into one category and return it
    in the detected report language.
    """
    target_language = "ar" if any("؀" <= ch <= "ۿ" for ch in text) else "en"
    default_labels = {
        "violation": "مخالفة" if target_language == "ar" else "violation",
        "misdemeanor": "جنحة" if target_language == "ar" else "misdemeanor",
        "felony": "جناية" if target_language == "ar" else "felony",
    }

    system_prompt = """
أنت مصنف قانوني. صنف النص في فئة واحدة فقط من بين: مخالفة، جنحة، جناية.
اكتشف لغة النص (عربية أو غيرها) وأجب بنفس اللغة.
أعد JSON فقط بالمفاتيح: category، confidence، reason.
category يجب أن تكون إحدى التسميات الثلاث في لغة الرد.
confidence رقم بين 0 و1.
reason سبب مختصر للتصنيف.
لا تضف مقدمات أو شروحات أو اعتذارات ولا ترفض الإجابة.
    """.strip()

    user_prompt = f"""
صنّف النص التالي:
{text}

أعد فقط JSON بالشكل التالي:
{{
  "category": "مخالفة أو جنحة أو جناية (باللغة المطابقة للنص)",
  "confidence": 0.0,
  "reason": "سبب مختصر للتصنيف بنفس لغة النص"
}}
لا تضف أي شيء آخر.
    """.strip()

    response = bedrock.converse(
        modelId=MODEL_ID,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        inferenceConfig={"maxTokens": 256, "temperature": 0.0, "topP": 1.0},
    )

    raw_text = response["output"]["message"]["content"][0].get("text", "")
    logger.info("Bedrock classification raw response: %s", raw_text[:400])

    parsed: dict = {}
    try:
        parsed = json.loads(extract_json_block(raw_text))
    except Exception:
        logger.warning("Falling back: could not parse JSON; returning raw text")
        parsed = {
            "category": default_labels["violation"],
            "confidence": 0.0,
            "reason": raw_text,
        }

    raw_category = str(parsed.get("category", "")).strip()
    category_norm = raw_category.lower()

    arabic_map = {
        "مخالفة": "violation",
        "جنحة": "misdemeanor",
        "جناية": "felony",
    }
    english_map = {"violation": "violation", "misdemeanor": "misdemeanor", "felony": "felony"}

    code_from_label = arabic_map.get(raw_category) or english_map.get(category_norm)

    try:
        confidence = float(parsed.get("confidence", 0))
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(confidence, 1.0))

    reason = parsed.get("reason") or ""
    category_label = default_labels.get(code_from_label, default_labels["violation"])

    final_category = (
        category_label if confidence >= 0.5 else "The category couldn't be detected"
    )

    return {
        "category": final_category,
        "confidence": confidence,
        "reason": reason,
        "model": MODEL_ID,
    }

def handler(event, context):
    try:
        if event.get("httpMethod", "").upper() == "OPTIONS":
            return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

        user_sub = get_user_sub(event)
        if not user_sub:
            return error_response(401, "Unauthorized")

        body = parse_body(event)
        session_id = (body.get("sessionId") or "").strip()
        extracted_text = (body.get("extracted_text") or body.get("text") or "").strip()

        if not session_id:
            return error_response(400, "sessionId is required")
        if not extracted_text:
            return error_response(400, "extracted_text is required")

        logger.info("Classifying report for user=%s session=%s (inline text)", user_sub, session_id)

        if not extracted_text.strip():
            return error_response(400, "Extracted text is empty")

        result = classify_report(extracted_text)

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps(
                {
                    "category": result["category"],
                    "confidence": result["confidence"],
                    "reason": result["reason"],
                    "model": result["model"],
                }
            ),
        }

    except Exception as e:
        logger.exception("Classification failed")
        return error_response(500, str(e))
