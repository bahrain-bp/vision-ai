import json
import os
import io
import logging
import boto3
import fitz
from urllib.parse import unquote_plus
from docx import Document
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.text.paragraph import Paragraph
from docx.table import Table


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
MAX_CHARS_PER_CHUNK =  6000


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

def api_response(text, status=200):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": json.dumps({"extracted_text": text}, ensure_ascii=False),
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

        filename = s3_key.split("/")[-1].lower()

        if filename.endswith(".pdf"):
            return extract_pdf(s3_key)

        if filename.endswith(".docx"):
            return extract_docx(s3_key)

        if filename.endswith(".txt"):
            obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
            text = obj["Body"].read().decode("utf-8", errors="ignore")
            return api_response(text)

        msg = "Unsupported file type. Allowed: .pdf, .docx, .txt"
        logger.warning(msg)
        return error_response(msg, status=400)

    except Exception as e:
        logger.exception("Extraction error")
        return error_response(str(e), status=500)

def extract_pdf(s3_key):
    pdf_obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
    pdf_bytes = pdf_obj["Body"].read()

    extracted_text = extract_pdf_with_pymupdf(pdf_bytes)
    if not extracted_text:
        return error_response(500,"failed to extract the text")

    cleaned_text = clean_pages_text(extracted_text)
    return api_response(cleaned_text)

def extract_pdf_with_pymupdf(pdf_bytes):
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    try:
        for page_index, page in enumerate(doc, 1):
            words = page.get_text(
                "words", flags=fitz.TEXT_PRESERVE_LIGATURES | fitz.TEXT_PRESERVE_WHITESPACE
            )
            page_lines = []
            if not words:
                # Fallback to block text if no words returned.
                blocks = page.get_text(
                    "blocks",
                    flags=fitz.TEXT_PRESERVE_LIGATURES | fitz.TEXT_PRESERVE_WHITESPACE,
                )
                for block in blocks:
                    text = (block[4] or "").strip()
                    if text:
                        page_lines.append(text)
                pages.append(page_lines)
                continue

            words.sort(key=lambda w: (w[5], w[6], w[7]))  # block, line, word index
            current_block = None
            current_line = None
            line_words = []

            def flush_line():
                if line_words:
                    page_lines.append(" ".join(line_words))

            for w in words:
                block_no, line_no, word_text = w[5], w[6], w[4]
                if (block_no, line_no) != (current_block, current_line):
                    flush_line()
                    if current_block is not None and block_no != current_block:
                        # Blank line between blocks to respect paragraph breaks.
                        page_lines.append("")
                    line_words = [word_text]
                    current_block, current_line = block_no, line_no
                else:
                    line_words.append(word_text)
            flush_line()
            pages.append(page_lines)
    finally:
        doc.close()
    flat_lines = []
    for idx, page_lines in enumerate(pages, 1):
        flat_lines.append(f"=== Page {idx} ===")
        flat_lines.extend(page_lines)
        flat_lines.append("")  # page spacer

    return "\n".join(flat_lines).strip()


def extract_docx(s3_key):
    """Fetch DOCX from S3 and extract with python-docx, returning page-labeled text."""
    obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
    data = obj["Body"].read()
    extracted_text = extract_docx_with_pydocx(data)

    if not extracted_text:
        return error_response(500,"failed to extract the text")

    cleaned_text = clean_pages_text(extracted_text)
    return api_response(cleaned_text)


def extract_docx_with_pydocx(docx_bytes):
    """Extract DOCX text deterministically and label as a single page."""

    document = Document(io.BytesIO(docx_bytes))

    def iter_block_items(parent):
        for child in parent.element.body.iterchildren():
            if isinstance(child, CT_P):
                yield Paragraph(child, parent)
            elif isinstance(child, CT_Tbl):
                yield Table(child, parent)

    lines = []
    for block in iter_block_items(document):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if text:
                lines.append(text)
        elif isinstance(block, Table):
            for row in block.rows:
                row_text = "\t".join(cell.text.strip() for cell in row.cells)
                if row_text.strip():
                    lines.append(row_text)
            lines.append("")  # spacer after table

    body = "\n".join(lines).strip()
    if not body:
        return ""
    return f"=== Page 1 ===\n{body}"


def chunk_text(text, max_chars=MAX_CHARS_PER_CHUNK):
    """Split text into newline-preserving chunks that stay within model limits."""
    if not text:
        return []

    chunks = []
    current = []
    current_len = 0

    def flush_current():
        nonlocal current, current_len
        if current:
            chunk = "\n".join(current).strip()
            if chunk:
                chunks.append(chunk)
            current = []
            current_len = 0

    for line in text.splitlines():
        if len(line) >= max_chars:
            flush_current()
            for start in range(0, len(line), max_chars):
                segment = line[start : start + max_chars].strip()
                if segment:
                    chunks.append(segment)
            continue

        projected_len = current_len + (1 if current else 0) + len(line)
        if projected_len > max_chars:
            flush_current()

        current.append(line)
        current_len += (1 if current_len else 0) + len(line)

    flush_current()
    return chunks


def clean_pages_text(text, max_chars=MAX_CHARS_PER_CHUNK):
    """
    Stream pages and chunk in one pass: keeps headers, chunks per page, cleans via Bedrock.
    Fewer passes than splitting then chunking separately.
    """
    if not text:
        return ""

    lines = text.splitlines()
    cleaned_pages = []
    page_chunks = []
    chunk_lines = []
    chunk_len = 0
    current_title = None
    page_index = 1

    def flush_chunk():
        nonlocal chunk_lines, chunk_len, page_chunks
        if not chunk_lines:
            return
        chunk = "\n".join(chunk_lines).strip()
        if chunk:
            page_chunks.append(enhance_chunk(chunk))
        chunk_lines = []
        chunk_len = 0

    def flush_page():
        nonlocal page_chunks, current_title, page_index
        flush_chunk()
        if current_title is None and not page_chunks:
            return
        title = current_title or f"=== Page {page_index} ==="
        cleaned_body = "\n\n".join(page_chunks) if page_chunks else ""
        cleaned_pages.append(f"{title}\n{cleaned_body}".strip())
        page_chunks = []
        page_index += 1

    for line in lines:
        if line.startswith("=== Page "):
            flush_page()
            current_title = line.strip()
            continue

        projected_len = chunk_len + (1 if chunk_lines else 0) + len(line)
        if projected_len > max_chars:
            flush_chunk()

        chunk_lines.append(line)
        chunk_len += (1 if chunk_len else 0) + len(line)

    flush_page()

    if not cleaned_pages and text.strip():
        # Fallback: treat the whole text as one page.
        chunks = chunk_text(text.strip(), max_chars)
        cleaned_chunks = [enhance_chunk(c) for c in chunks] if chunks else []
        if cleaned_chunks:
            cleaned_pages.append("\n\n".join(cleaned_chunks))
        else:
            cleaned_pages.append(text.strip())

    return "\n\n".join(cleaned_pages).strip()


def enhance_chunk(content):
 
    user_content = [
        {
            "text": (
                "Clean this page of text: fix words broken by line breaks, normalize spaces, and keep list"
                " items on their own lines. Preserve order and do not translate, summarize, or add content."
            )
        },
        {"text": content},
    ]

    extraction_response = bedrock.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": user_content}],
        inferenceConfig={"maxTokens": 7000, "temperature": 0.0},
    )
    return extraction_response["output"]["message"]["content"][0]["text"]
 
 

