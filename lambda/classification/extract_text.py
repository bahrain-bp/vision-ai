import json
import os
import logging
import boto3
import fitz
from urllib.parse import unquote_plus
from botocore.config import Config


logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
cognito_idp = boto3.client("cognito-idp")
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
)

BUCKET_NAME = os.environ["BUCKET_NAME"]
MODEL_ID = os.environ.get("NOVA_MODEL_ID", "us.meta.llama3-2-11b-instruct-v1:0")


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
      { "key": "classification/upload/...", "sessionId": "..." }

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
            return bedrock_extract_pdf_chunked(s3_key)

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


def bedrock_extract_pdf_chunked(s3_key):
    pdf_obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
    pdf_bytes = pdf_obj["Body"].read()
    
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    all_text = []
    
    for page_num in range(0, len(doc), 2):
        chunk_doc = fitz.open()
        end_page = min(page_num + 1, len(doc) - 1)
        chunk_doc.insert_pdf(doc, from_page=page_num, to_page=end_page)
        chunk_bytes = chunk_doc.tobytes()
        chunk_doc.close()
        
        text = extract_chunk(chunk_bytes)
        if end_page == page_num:
            all_text.append(f"=== Page {page_num + 1} ===\n{text}")
        else:
            all_text.append(f"=== Pages {page_num + 1}-{end_page + 1} ===\n{text}")
    
    doc.close()
    full_text = "\n\n".join(all_text)
    return api_response(full_text)


def extract_chunk(pdf_bytes):
    extraction_response = bedrock.converse(
        modelId=MODEL_ID,
        messages=[{
            "role": "user",
            "content": [
                {
                    "text": (
                        "Extract clean plain text from this PDF segment. Preserve the reading order and paragraph"
                        " breaks. Keep bullet/numbered list items on separate lines. Do not summarize, translate,"
                        " or add commentary. Return only the extracted text."
                    )
                },
                {"document": {"format": "pdf", "name": "page", "source": {"bytes": pdf_bytes}}},
            ],
        }],
        inferenceConfig={"maxTokens": 2048, "temperature": 0.0},
    )
    raw_text = extraction_response["output"]["message"]["content"][0]["text"]

    refinement_response = bedrock.converse(
        modelId=MODEL_ID,
        messages=[{
            "role": "user",
            "content": [{
                "text": (
                    "Clean the extracted text: fix words broken by line breaks, normalize spaces, and remove obvious"
                    " repeated headers or footers if they appear on every page. Do not add or remove actual content"
                    " beyond these fixes. Return only the cleaned text. \n\n"
                    f"{raw_text}"
                )
            }],
        }],
        inferenceConfig={"maxTokens": 2048, "temperature": 0.0},
    )
    return refinement_response["output"]["message"]["content"][0]["text"]


def bedrock_extract(s3_uri, document_name, fmt):
    system_list = [
        {
            "text": (
                "You are a document text extractor. Return the document's text in reading order as plain text."
                " Preserve paragraphs and list formatting with line breaks; render tables in a readable row/column"
                " text form. Do not summarize, translate, or add commentary. If content is unreadable, omit it rather"
                " than guessing."
            )
        }
    ]
 
    conversation = [
        {
            "role": "user",
            "content": [
                {
                    "text": (
                        f"Extract the text from the attached document.\n"
                        f"- Format: {fmt}\n"
                        f"- Name: {document_name}\n"
                        "Return plain text only. Keep the order of content and basic structure (paragraphs, lists,"
                        " simple tables). Do not summarize or add notes."
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
