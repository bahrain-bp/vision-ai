import json
import logging
import os
from typing import Any, Dict, Tuple
from urllib.parse import unquote_plus

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


def ensure_key_access(key: str, user_sub: str, session_id: str) -> Tuple[bool, str]:
    safe_session = str(session_id).replace("/", "_")
    if ".." in key.split("/"):
        return False, "Invalid key"

    allowed_prefix = f"classification/extracted/{user_sub}/"
    if not key.startswith(allowed_prefix):
        return False, "Access to the requested key is not allowed"

    if f"/{safe_session}/" not in key:
        return False, "Key does not belong to the provided session"

    return True, ""


def load_text_from_s3(key: str) -> str:
    obj = s3.get_object(Bucket=BUCKET_NAME, Key=key)
    return obj["Body"].read().decode("utf-8", errors="ignore")


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
    target_language = "ar" if any("\u0600" <= ch <= "\u06FF" for ch in text) else "en"
    default_labels = {
        "violation": "مخالفة" if target_language == "ar" else "violation",
        "misdemeanor": "جنحة" if target_language == "ar" else "misdemeanor",
        "felony": "جناية" if target_language == "ar" else "felony",
    }

    system_prompt = (
        "أنت مصنف قانوني لتقارير تحقيق بحرينية. صنّف الواقعة في فئة واحدة فقط من الفئات الثلاث: "
        "مخالفة (violation)، جنحة (misdemeanor)، جناية (felony). لا تستخدم أي فئة أخرى. "
        "اكتشف لغة التقرير وأعد الاستجابة بنفس اللغة. أعد JSON فقط بالمفاتيح: category، confidence، reason. "
        "category يجب أن يكون التسمية باللغة المكتشفة لإحدى الفئات الثلاث فقط. "
        "confidence عدد عشري بين 0 و 1. السبب مختصر (<=140 حرفاً) وبنفس لغة التقرير."
    )

    user_prompt = (
        "نص التقرير:\n\"\"\"\n"
        f"{text}\n"
        "\"\"\"\n"
        "اكتشف اللغة وأعد فقط JSON بهذا الشكل:\n"
        "{\n"
        '  \"category\": \"مخالفة أو جنحة أو جناية (أو كلماتها المكافئة باللغة المكتشفة)\",\n'
        '  \"confidence\": 0.0,\n'
        '  \"reason\": \"سبب مختصر جداً في نفس اللغة\"\n'
        "}\n"
        "لا تضف أي نص آخر ولا أي فئات إضافية."
    )

    response = bedrock.converse(
        modelId=MODEL_ID,
        system=[{"text": system_prompt}],
        messages=[{"role": "user", "content": [{"text": user_prompt}]}],
        inferenceConfig={"maxTokens": 256, "temperature": 0.0, "topP": 1.0},
    )

    raw_text = response["output"]["message"]["content"][0].get("text", "")
    logger.info("Bedrock classification raw response: %s", raw_text[:400])

    parsed: Dict[str, Any] = {}
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

    arabic_map = {"مخالفة": "violation", "جنحة": "misdemeanor", "جناية": "felony"}
    english_map = {"violation": "violation", "misdemeanor": "misdemeanor", "felony": "felony"}

    code_from_label = arabic_map.get(raw_category) or english_map.get(category_norm)

    try:
        confidence = float(parsed.get("confidence", 0))
    except Exception:
        confidence = 0.0
    confidence = max(0.0, min(confidence, 1.0))

    reason = parsed.get("reason") or ""
    category_label = default_labels.get(code_from_label, default_labels["violation"])

    return {
        "category": category_label,
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
        s3_key = unquote_plus(body.get("key", "")).strip()
        session_id = (body.get("sessionId") or "").strip()

        if not s3_key or not session_id:
            return error_response(400, "sessionId and key are required")

        ok, msg = ensure_key_access(s3_key, user_sub, session_id)
        if not ok:
            return error_response(403, msg)

        logger.info("Classifying report for user=%s session=%s key=%s", user_sub, session_id, s3_key)

        text = load_text_from_s3(s3_key)
        if not text.strip():
            return error_response(400, "Extracted text is empty")

        result = classify_report(text)

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
