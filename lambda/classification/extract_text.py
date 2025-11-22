import json
import os
import logging
import boto3
from urllib.parse import unquote_plus
from botocore.config import Config


logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
cognito_idp = boto3.client("cognito-idp")
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    config=Config(read_timeout=3600, connect_timeout=3600),
)

BUCKET_NAME = os.environ["BUCKET_NAME"]
MODEL_ID = os.environ.get("NOVA_MODEL_ID", "amazon.nova-lite-v1:0")


def get_user_sub(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {}) or {}
    claims = authorizer.get("claims") or authorizer.get("jwt", {}).get("claims") or {}
    sub = claims.get("sub")
    if sub:
        return sub

    headers = event.get("headers") or {}
    auth_header = headers.get("authorization") or headers.get("Authorization")
    if auth_header and isinstance(auth_header, str):
        token = auth_header.split()[-1]
        try:
            resp = cognito_idp.get_user(AccessToken=token)
            for attr in resp.get("UserAttributes", []):
                if attr.get("Name") == "sub":
                    return attr.get("Value")
        except Exception:
            logger.warning("Access token validation failed")
    return None


def error_response(status_code, message):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }


def handler(event, context):
    """
    Input (API Gateway):
      { "key": "classification/uploads/file.pdf" }

    Output:
      { "extracted_text": "..." }
    """
    try:
        caller_sub = get_user_sub(event)
        if not caller_sub:
            return error_response(401, "Unauthorized")

        body = json.loads(event.get("body", "{}"))
        s3_key = unquote_plus(body["key"])
        sessionId = body.get("sessionId")
        if not sessionId or not s3_key:
            return error_response(400, "sessionId and s3 key are required")

        safe_session = str(sessionId).replace("/", "_")
        if ".." in s3_key.split("/"):
            return error_response(400, "Invalid s3 key")

        allowed_prefix = f"classification/upload/{caller_sub}/"
        if not s3_key.startswith(allowed_prefix):
            return error_response(403, "Access to the requested key is not allowed")

        if f"/{safe_session}/" not in s3_key:
            return error_response(403, "Key does not belong to the provided session")

        logger.info("User %s extracting from s3://%s/%s", caller_sub, BUCKET_NAME, s3_key)

        s3_uri = f"s3://{BUCKET_NAME}/{s3_key}"
        filename = s3_key.split("/")[-1].lower()
        fmt = filename.split(".")[-1] if "." in filename else "file"
        fmt_safe = "".join(ch for ch in fmt if ch.isalnum()) or "file"
        bedrock_name = f"document-{fmt_safe}"

        if filename.endswith(".pdf"):
            return bedrock_extract(s3_uri, bedrock_name, "pdf")

        if filename.endswith(".docx"):
            return bedrock_extract(s3_uri, bedrock_name, "docx")

        if filename.endswith(".txt"):
            obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
            text = obj["Body"].read().decode("utf-8", errors="ignore")
            return api_response(text)

        msg = "Unsupported file type. Allowed: .pdf, .docx, .txt"
        logger.warning(msg)
        return api_response(msg, status=400)

    except Exception as e:
        logger.exception("Extraction error")
        return api_response(str(e), status=500)


def bedrock_extract(s3_uri, document_name, fmt):
    """
    Use Amazon Nova Lite on Bedrock to extract text from a pdf/docx document.
    """

    system_list = [
        {
            "text": (
                "أنت نموذج متخصص في نسخ المستندات دون تلخيص أو إعادة صياغة. استخرج كل النصوص الواضحة كما هي "
                "وباللغة الأصلية، مع الحفاظ على ترتيب القراءة صفحة بصفحة وإضافة فواصل صفحات بصيغة [[page 1]], "
                "[[page 2]]، إلخ. ضمّن البيانات الحساسة والتحقيقية كاملة: الأطراف، الأرقام، التواريخ، الأماكن، "
                "الوقائع، الأقوال، القرارات، المرفقات، التوقيعات، الأختام، الملاحظات اليدوية والهامشية، الرؤوس "
                "والتذييل وأرقام الصفحات. امثل الجداول كـ Markdown (صفوف وأعمدة). لا تكرر المقاطع ولا تحذف أي "
                "جزء. إذا كان هناك نص غير مقروء اكتب [UNCERTAIN: وصف المشكلة]. أعد النص فقط."
            )
        }
    ]

    conversation = [
        {
            "role": "user",
            "content": [
                {
                    "text": (
                        f"اقرأ المستند المرفق (الصيغة: {fmt}, الاسم: {document_name}) وأعد نصاً حرفياً كاملاً دون "
                        "حذف أو اختصار، وباللغة الأصلية. حافظ على ترتيب الظهور صفحة بصفحة مع وضع علامات الصفحات "
                        "[[page 1]], [[page 2]], إلخ. ضمّن كل تفاصيل القضية الحساسة: البيانات الشخصية، أرقام "
                        "القضايا، التواريخ، الأماكن، الوقائع، الشهادات، الأدلة، التوجيهات، الملاحق، الجداول "
                        "(Markdown)، القوائم النقطية أو المرقمة، الحواشي، الأختام، والتوقيعات. لا تغيّر اللغة أو "
                        "الصياغة. إذا تعذّر قراءة جزء، اكتب [UNCERTAIN: وصف المشكلة]. أعد النص فقط."
                    )
                },
                {
                    "document": {
                        "format": fmt,
                        "name": document_name,
                        "source": {"s3Location": {"uri": f"{s3_uri}"}},
                    }
                },
            ],
        }
    ]

    response = bedrock.converse(
        modelId=MODEL_ID,
        system=system_list,
        messages=conversation,
        inferenceConfig={
            "maxTokens": 10000,
            "temperature": 0.0,
            "topP": 1.0,
        },
    )

    extracted = response["output"]["message"]["content"][0]["text"]
    return api_response(extracted)


def api_response(text, status=200):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": json.dumps({"extracted_text": text}, ensure_ascii=False),
    }
