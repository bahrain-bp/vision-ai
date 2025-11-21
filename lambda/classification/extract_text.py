import json
import os
import logging
import boto3
from urllib.parse import unquote_plus
from botocore.config import Config


logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
    config = Config(
        read_timeout=3600,
        connect_timeout=3600 
    )
)

BUCKET_NAME = os.environ["BUCKET_NAME"]
MODEL_ID = os.environ.get("NOVA_MODEL_ID", "amazon.nova-lite-v1:0")

import re

def error_response(status_code, message):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'error': message})
    }

def handler(event, context):
    """
    Input (API Gateway):
      { "key": "classification/uploads/file.pdf" }

    Output:
      { "extracted_text": "..." }

    Supported:
      - .pdf   -> Bedrock Nova Lite (format=pdf)
      - .docx  -> Bedrock Nova Lite (format=docx)
      - .txt   -> read directly from S3

    """

    try:
        # 1) Parse request body
        body = json.loads(event.get('body', '{}'))
        s3_key = unquote_plus(body["key"])
        sessionId = body.get('sessionId')
        if not sessionId or not s3_key:
            return error_response(400, 'sessionId and s3 key are required')

        logger.info(f"Extracting from s3://{BUCKET_NAME}/{s3_key}")

        # 2) s3 link
        s3_uri = f"s3://{BUCKET_NAME}/{s3_key}"
        filename = s3_key.split("/")[-1].lower()
        

        # 3) Route by extension
        if filename.endswith(".pdf"):
            return bedrock_extract(s3_uri, "document", "pdf")

        if filename.endswith(".docx"):
            return bedrock_extract(s3_uri, "document", "docx")

        if filename.endswith(".txt"):
            obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
            text = obj["Body"].read().decode("utf-8", errors="ignore")
            return api_response(text)

        # 4) Unsupported
        msg = "Unsupported file type. Allowed: .pdf, .docx, .txt"
        logger.warning(msg)
        return api_response(msg, status=400)

    except Exception as e:
        logger.exception("Extraction error")
        return api_response(str(e), status=500)


def bedrock_extract(s3_uri, filename, fmt):
    """
    Use Amazon Nova Lite on Bedrock to extract text
    from a pdf/docx document.
    """

    system_list = [
        {
            "text": (
                "أنت مساعد في التحقيقات الجنائية. "
                "مهمتك استخراج النصوص من المستندات بدقة شديدة دون تعديل أو حذف أو إضافة."
            )
        }
    ]
    conversation = [
        {
            "role": "user",
            "content": [
                {
                    "text": (
                        "اقرأ هذا المستند وأخرج النص كاملًا كما هو، "
                        "بنفس اللغة الأصلية، بدون ترجمة أو تلخيص أو شرح. "
                        "أرجع النص الخام فقط."
                        "أخرج النص دون تغيير كاملًا"
                        "لا تعدل ولا تحذف ولا تضيف أي شيئ"
                    )
                },
                {
                    "document": {
                        "format": fmt,  # "pdf" or "docx"
                        "name": filename,
                        "source": {
                            "s3Location": {
                                "uri": f"{s3_uri}"
                            },
                        }
                    }
                }
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
        },
    )

    extracted = response["output"]["message"]["content"][0]["text"]
    return api_response(extracted)


def api_response(text, status=200):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json;"
            " charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        "body": json.dumps({"extracted_text": text}, ensure_ascii=False),
    }
