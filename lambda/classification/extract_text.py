import io
import json
import logging
import os
import re
from urllib.parse import unquote_plus

import boto3
import fitz
from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
cognito_idp = boto3.client("cognito-idp")
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "us-east-1"),
)

BUCKET_NAME = os.environ["BUCKET_NAME"]
MODEL_ID = os.environ.get("MODEL_ID", "us.meta.llama3-2-90b-instruct-v1:0")
PDF_RENDER_DPI = int(os.environ.get("PDF_RENDER_DPI", "220"))
VISION_MAX_TOKENS = int(os.environ.get("VISION_MAX_TOKENS", "4000"))
VISION_TEMPERATURE = float(os.environ.get("VISION_TEMPERATURE", "0.2"))
VISION_TOP_P = float(os.environ.get("VISION_TOP_P", "0.9"))
TEXT_MAX_TOKENS = int(os.environ.get("TEXT_MAX_TOKENS", "4000"))
TEXT_TEMPERATURE = float(os.environ.get("TEXT_TEMPERATURE", "0.2"))
TEXT_TOP_P = float(os.environ.get("TEXT_TOP_P", "0.9"))

NORMALIZATION_SYSTEM_PROMPT = """
أنت محرّك لتطبيع/تنظيم نصوص المستندات القانونية.

مهمتك:
- إعادة بناء المحتوى النصي الكامل لصفحة من التقرير باللغة العربية (مع الحفاظ على اللغة كما هي).
- يجب أن تكون مُلتزمًا تمامًا بالنص الأصلي في الصفحة بدون أي تغيير في المعنى.
- لا تقم بتلخيص النص، ولا اختصاره، ولا شرحه.
- لا تضف أي معلومات غير موجودة في الصفحة الأصلية.
- لا تضف عناوين، أو تذييلات، أو ملاحظات من عندك.
- حافظ على جميع التفاصيل كما هي، بما في ذلك الأرقام، التواريخ، العناوين، التسميات، وأسماء الحقول كما ظهرت في الصفحة.
- طَبِّع/نظِّم المخرجات كنص نظيف ومتصل وسهل القراءة والمعالجة لاحقًا.
- حافظ على هيكل وترتيب النص كما هو في الصفحة الأصلية (العناوين، الفقرات، البنود، التسلسل).
- يجب أن يحتوي الإخراج على **النص الموجود في الصفحة فقط**. لا تضف أي مقدمات، أو تعليقات، أو اعتذارات، أو شروح.
- ابدأ إجابتك بأول سطر نص موجود في الصفحة مباشرة، ولا تبدأ بعبارات مثل: "إليك النص" أو "ها هو…".
- أنهِ إجابتك بآخر سطر نص في الصفحة، ولا تضف أي نص بعده.

""".strip()

VISION_USER_PROMPT = """
أنت نظام ذكي لاستخراج وتصحيح النصوص العربية من المستندات.

سأرسل لك في كل مرة:
1. صورة لصفحة من مستند (صورة ممسوحة من PDF أو ورقة تصوير).
2. نصًّا خاماً مستخرجاً من نفس الصفحة بواسطة أداة أخرى (قد يحتوي على أخطاء وتشويش).

مهمتك:

1. **اعتبر الصورة هي المصدر الأساسي والحقيقي للنص**، واستخدم النص الخام فقط كمساعدة لتسريع الفهم إذا كان واضحاً.
2. إذا تعارض ما تراه في الصورة مع النص الخام، **قدّم ما في الصورة** واعتبر النص الخام خاطئاً.
3. استخرج كل النص المهم من الصورة:
   - العناوين، الجمل، الفقرات، العناصر المرقمة، والجداول إن وُجدت.
   - النص العربي والإنجليزي والأرقام والرموز المفهومة.
4. **نظّم الناتج ليكون قابلاً للقراءة**:
   - لا تترك حروفاً متقطعة (مثلاً: "ال س ل ا م" ← "السلام").
   - صحّح ترتيب الحروف واتجاهها إن كان مقلوباً أو معكوساً.
   - تخلّص من الرموز والقطع المشوّهة مثل: ï»؛, �, ☐, أو أي نص واضح أنه غير مفهوم أو ناتج عن خطأ مسح.
5. **فصل الفقرات**:
   - اجعل كل فقرة في سطر مستقل.
   - ضع سطرًا فارغًا واحدًا بين الفقرة والتي تليها.
6. **الجداول**:
   - إذا كان هناك جدول، اكتبه نصياً:
     - كل صف في سطر.
     - الأعمدة مفصولة بعلامة | (بايب).
     - مثال:
       الاسم | الرقم الشخصي | رقم الهاتف
7. مربعات النص أو الملاحظات الجانبية:
   - استخرج محتواها وأدرجه في المكان المنطقي حسب سياق النص وترتيب القراءة.
8. لا تُلخّص ولا تترجم ولا تغيّر المعنى:
   - أعِد كتابة النص كما هو قدر الإمكان، مع تحسين التنسيق فقط وتصحيح الأخطاء البصرية.
9. الناتج النهائي يجب أن يكون:
   - نصًا خامًا فقط (plain text)، بدون أي شرح أو تعليقات من عندك.
   - بدون عناوين مثل "الناتج هو:" أو "النص بعد التصحيح:"، فقط ابدأ مباشرة بالنص.
   -بدون تعليقات مضافة او ملاحظات او قواعد استخدمت لاستخراج النص.
10. اذا كان النص المرسل فارغا ولم تستطع استخراج نص من الصورة ارجع النص فارغا


عندما أرسل لك:
- أولاً: النص الخام المستخرج بين ثلاث علامات اقتباس ثلاثية 
- وثانياً: صورة الصفحة،

ابدأ في استخراج النص المنظَّم مباشرة.

\"\"\"
{RAW_TEXT}
\"\"\"
""".strip()

DOCX_USER_PROMPT = """
You are given raw text extracted from a DOCX legal report.

The text may contain:
- Paragraphs with broken line breaks.
- Inline representations of tables.
- Key-value or form-like sections.

Your task:
- Reconstruct ALL text from this DOCX document in natural reading order.
- Do NOT summarize or delete any information.
- Fix line breaks inside paragraphs so that each paragraph becomes continuous text.
- When you detect a table, output it in the following format:
  Row 1: ColumnName1=Value1, ColumnName2=Value2, ...
  Row 2: ...
- Use the headers you see as ColumnName keys.
- Do not drop any rows or columns.

Output:
- Return ONLY plain continuous text (with paragraph breaks and table rows as described).
- Do not use JSON or code fences.
- Do not add comments, explanations, notes, or prefaces (e.g., do NOT write "Here is...").
- Start directly with the document text.

Here is the raw extracted text:
\"\"\"
{DOCX_RAW_TEXT}
\"\"\"
""".strip()


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


def error_response(message, status=500):
    return {
        "statusCode": status,
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
            return error_response("Unauthorized", status=401)

        body = json.loads(event.get("body", "{}"))
        s3_key = unquote_plus(body["key"])
        session_id = body.get("sessionId")
        if not session_id or not s3_key:
            return error_response("sessionId and s3 key are required", status=400)

        safe_session = str(session_id).replace("/", "_")
        if ".." in s3_key.split("/"):
            return error_response("Invalid s3 key", status=400)

        allowed_prefix = f"classification/upload/{caller_sub}/"
        if not s3_key.startswith(allowed_prefix):
            return error_response("Access to the requested key is not allowed", status=403)

        if f"/{safe_session}/" not in s3_key:
            return error_response("Key does not belong to the provided session", status=403)

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

    pages_text = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page_index, page in enumerate(doc, 1):
            raw_text = extract_pdf_raw_text(page)
            page_image = render_pdf_page_image(page)
            normalized = normalize_pdf_page(raw_text, page_image)
            page_body = normalized or raw_text
            pages_text.append(format_page_output(page_index, page_body))
    finally:
        doc.close()

    full_text = "\n\n".join(pages_text).strip()
    if not full_text:
        return error_response("failed to extract the text", status=500)
    return api_response(full_text)


def extract_pdf_raw_text(page):
    blocks = page.get_text("blocks") or []
    text_blocks = []
    for block in blocks:
        block_type = block[6] if len(block) > 6 else (block[5] if len(block) > 5 else 0)
        if block_type != 0:
            continue
        text = (block[4] or "").strip()
        if text:
            text_blocks.append((block[0], block[1], text))  # x0, y0, text

    if not text_blocks:
        fallback_text = (page.get_text("text") or "").strip()
        return merge_lines(fallback_text)

    sorted_blocks = sorted(text_blocks, key=lambda b: (b[1], b[0]))
    raw_lines = [b[2] for b in sorted_blocks]
    return merge_lines("\n".join(raw_lines))


def render_pdf_page_image(page):
    zoom = PDF_RENDER_DPI / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)
    return pix.tobytes("png")


def normalize_pdf_page(raw_text, image_bytes):
    try:
        prompt = VISION_USER_PROMPT.format(RAW_TEXT=raw_text or "")
        content = [
            {"image": {"format": "png", "source": {"bytes": image_bytes}}},
            {"text": prompt},
        ]
        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": NORMALIZATION_SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": content}],
            inferenceConfig={
                "maxTokens": VISION_MAX_TOKENS,
                "temperature": VISION_TEMPERATURE,
                "topP": VISION_TOP_P,
            },
        )
        raw_output = response["output"]["message"]["content"][0]["text"].strip()
        return raw_output or raw_text
    except Exception:
        logger.exception("Bedrock vision normalization failed; falling back to raw text")
        return raw_text


def extract_docx(s3_key):
    obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
    data = obj["Body"].read()

    raw_text = extract_docx_raw_text(data)
    normalized = normalize_docx_text(raw_text) if raw_text else ""
    final_text = normalized or raw_text

    if not final_text:
        return error_response("failed to extract the text", status=500)

    return api_response(format_page_output(1, final_text))


def extract_docx_raw_text(docx_bytes):
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
            lines.append("[TABLE]")
            lines.extend(table_to_row_style(block))
            lines.append("[/TABLE]")

    return "\n".join(lines).strip()


def table_to_row_style(table):
    """Convert a python-docx table into Row N: column=value lines."""
    if not table.rows:
        return []

    headers = [cell.text.strip() for cell in table.rows[0].cells]
    header_count = len(headers)
    safe_headers = [
        header if header else f"Column{idx + 1}" for idx, header in enumerate(headers)
    ]

    lines = []
    for row_index, row in enumerate(table.rows[1:], start=1):
        pairs = []
        for col_index, cell in enumerate(row.cells):
            header = safe_headers[col_index] if col_index < header_count else f"Column{col_index + 1}"
            value = cell.text.strip()
            pairs.append(f"{header}={value}")
        lines.append(f"Row {row_index}: " + ", ".join(pairs))
    return lines


def normalize_docx_text(raw_text):
    try:
        prompt = DOCX_USER_PROMPT.format(DOCX_RAW_TEXT=raw_text)
        response = bedrock.converse(
            modelId=MODEL_ID,
            system=[{"text": NORMALIZATION_SYSTEM_PROMPT}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={
                "maxTokens": TEXT_MAX_TOKENS,
                "temperature": TEXT_TEMPERATURE,
                "topP": TEXT_TOP_P,
            },
        )
        raw_output = response["output"]["message"]["content"][0]["text"].strip()
        return raw_output or raw_text
    except Exception:
        logger.exception("Bedrock DOCX normalization failed; falling back to raw text")
        return raw_text


def merge_lines(text):
    if not text:
        return ""
    return re.sub(r"([^\n])\n(?=[^\n])", r"\1 ", text.strip())


def format_page_output(page_index, body):
    return f"=== Page {page_index} ===\n{body.strip()}"
