import io
import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
import unicodedata
from urllib.parse import unquote_plus

import boto3
import fitz
import pytesseract
from PIL import Image
from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph


logger = logging.getLogger()
logger.setLevel(logging.INFO)

os.environ.setdefault("PATH", "")
os.environ["PATH"] = "/opt/bin:" + os.environ["PATH"]
os.environ.setdefault("LD_LIBRARY_PATH", "")
os.environ["LD_LIBRARY_PATH"] = "/opt/lib:" + os.environ["LD_LIBRARY_PATH"]
os.environ.setdefault("TESSDATA_PREFIX", "/opt/tesseract/share")
pytesseract.pytesseract.tesseract_cmd = os.environ.get("TESSERACT_CMD", "/opt/bin/tesseract")

s3 = boto3.client("s3")
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
PDF_MIN_TEXT_CHARS = int(os.environ.get("PDF_MIN_TEXT_CHARS", "40"))
PDF_OCR_LANGS = os.environ.get("PDF_OCR_LANGS", "ara+eng")
PDF_THREAD_WORKERS = int(os.environ.get("PDF_THREAD_WORKERS", "4"))
DOCX_PARA_BREAK = "__DOCX_PARA_BREAK__"

NORMALIZATION_SYSTEM_PROMPT = """
أنت محرّك لتطبيع/تنظيم نصوص المستندات القانونية.

مهمتك:
- إعادة بناء المحتوى النصي الكامل لصفحة من التقرير باللغة العربية (مع الحفاظ على اللغة كما هي).
- يجب أن تكون مُلتزمًا تمامًا بالنص الأصلي في الصفحة بدون أي تغيير في المعنى.
- لا تقم بتلخيص النص، ولا اختصاره، ولا شرحه.
- لا تضف أي معلومات غير موجودة في الصفحة الأصلية.
- لا تضف عناوين، أو تذييلات، أو ملاحظات من عندك.
- حافظ على جميع التفاصيل كما هي، بما في ذلك الأرقام، التواريخ، العناوين، التسميات، وأسماء الحقول كما ظهرت في الصفحة.
- طَبِّع/نظِّم المخرجات كنص نظيف ومتصل وسهل القراءة والمعالجة لاحقًا.
- حافظ على هيكل وترتيب النص كما هو في الصفحة الأصلية (العناوين، الفقرات، البنود، التسلسل).
- يجب أن يحتوي الإخراج على **النص الموجود في الصفحة فقط**. لا تضف أي مقدمات، أو تعليقات، أو اعتذارات، أو شروح.
- ابدأ إجابتك بأول سطر نص موجود في الصفحة مباشرة، ولا تبدأ بعبارات مثل: \"إليك النص\" أو \"ها هو…\".
- أنهِ إجابتك بآخر سطر نص في الصفحة، ولا تضف أي نص بعده.

""".strip()

VISION_USER_PROMPT = """
أنت نظام ذكي لاستخراج وتصحيح النصوص العربية من المستندات.

سأرسل لك في كل مرة:
1. صورة لصفحة من مستند (صورة ممسوحة من PDF أو ورقة تصوير).
2. نصًّا خاماً مستخرجاً من نفس الصفحة بواسطة أداة أخرى (قد يحتوي على أخطاء وتشويش).

مهمتك:

1. **اعتبر الصورة هي المصدر الأساسي والحقيقي للنص**، واستخدم النص الخام فقط كمساعدة لتسريع الفهم إذا كان واضحاً.
2. إذا تعارض ما تراه في الصورة مع النص الخام، **قدّم ما في الصورة** واعتبر النص الخام خاطئاً.
3. استخرج كل النص المهم من الصورة:
   - العناوين، الجمل، الفقرات، العناصر المرقمة، والجداول إن وُجدت.
   - النص العربي والإنجليزي والأرقام والرموز المفهومة.
4. **نظّم الناتج ليكون قابلاً للقراءة**:
   - لا تترك حروفاً متقطعة (مثلاً: \"ال س ل ا م\" ← \"السلام\").
   - صحّح ترتيب الحروف واتجاهها إن كان مقلوباً أو معكوساً.
   - تخلّص من الرموز والقطع المشوّهة مثل: ï»؛, , ☐, أو أي نص واضح أنه غير مفهوم أو ناتج عن خطأ مسح.
5. **فصل الفقرات**:
   - اجعل كل فقرة في سطر مستقل.
   - ضع سطرًا فارغًا واحدًا بين الفقرة والتي تليها.
6. **الجداول**:
   - ضع كل صف في سطر واحد
7. مربعات النص أو الملاحظات الجانبية:
   - استخرج محتواها وأدرجه في المكان المنطقي حسب سياق النص وترتيب القراءة.
8. لا تُلخّص ولا تترجم ولا تغيّر المعنى:
   - أعِد كتابة النص كما هو قدر الإمكان، مع تحسين التنسيق فقط وتصحيح الأخطاء البصرية.
9. الناتج النهائي يجب أن يكون:
   - نصًا خامًا فقط (plain text)، بدون أي شرح أو تعليقات من عندك.
   - بدون عناوين مثل \"الناتج هو:\" أو \"النص بعد التصحيح:\"، فقط ابدأ مباشرة بالنص.
   -بدون تعليقات مضافة او ملاحظات او قواعد استخدمت لاستخراج النص.
10. اذا كان النص المرسل فارغا ولم تستطع استخراج نص من الصورة ارجع النص فارغا


عندما أرسل لك:
- أولاً: النص الخام المستخرج بين ثلاث علامات اقتباس ثلاثية 
- وثانياً: صورة الصفحة،

ابدأ في استخراج النص المنظَّم مباشرة.

\\\"\\\"\\\"
{RAW_TEXT}
\\\"\\\"\\\"
""".strip()


def handler(event, context):
    """
    Worker lambda invoked asynchronously.
    Input: { "jobId": "...", "key": "...", "sessionId": "..." }
    Updates S3 status file with result or error.
    """
    job_id = event.get("jobId")
    s3_key = unquote_plus(event.get("key", ""))
    session_id = event.get("sessionId")

    status_key = f"classification/jobs/{job_id}/status.json"

    try:
        safe_session = str(session_id).replace("/", "_")
        if ".." in s3_key.split("/"):
            raise ValueError("Invalid s3 key")

        if not s3_key.startswith("classification/upload/"):
            raise ValueError("Invalid key prefix")
        if f"/{safe_session}/" not in s3_key:
            raise ValueError("Key does not belong to the provided session")

        logger.info("Extracting from s3://%s/%s (session=%s)", BUCKET_NAME, s3_key, safe_session)

        filename = s3_key.split("/")[-1].lower()

        if filename.endswith(".pdf"):
            extracted_text = extract_pdf(s3_key)
        elif filename.endswith(".docx"):
            extracted_text = extract_docx(s3_key)
        elif filename.endswith(".txt"):
            obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
            extracted_text = obj["Body"].read().decode("utf-8", errors="ignore")
        else:
            raise ValueError("Unsupported file type. Allowed: .pdf, .docx, .txt")

        # Update status to COMPLETED
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=status_key,
            Body=json.dumps({
                "status": "COMPLETED",
                "extractedText": extracted_text
            }, ensure_ascii=False),
            ContentType="application/json"
        )

    except Exception as e:
        logger.exception("Extraction error")
        # Update status to FAILED
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=status_key,
            Body=json.dumps({
                "status": "FAILED",
                "error": str(e)
            }),
            ContentType="application/json"
        )


def extract_pdf(s3_key):
    pdf_obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
    pdf_bytes = pdf_obj["Body"].read()

    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        page_count = doc.page_count
        max_workers = max(1, min(PDF_THREAD_WORKERS, page_count))
        futures = []
        pages_text = [None] * page_count

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for page_index, page in enumerate(doc, 1):
                page_image = render_pdf_page_image(page)
                raw_text = extract_pdf_raw_text(page)
                futures.append(
                    executor.submit(process_pdf_page, page_index, raw_text, page_image)
                )

            for future in as_completed(futures):
                page_index, page_output = future.result()
                pages_text[page_index - 1] = page_output

    full_text = "\\n\\n".join([p for p in pages_text if p]).strip()
    if not full_text:
        raise ValueError("failed to extract the text")
    return full_text


def extract_pdf_raw_text(page):
    blocks = page.get_text("blocks") or []
    text_blocks = []
    for block in blocks:
        block_type = block[6] if len(block) > 6 else (block[5] if len(block) > 5 else 0)
        if block_type != 0:
            continue
        text = (block[4] or "").strip()
        if text:
            text_blocks.append((block[0], block[1], text))

    if not text_blocks:
        fallback_text = (page.get_text("text") or "").strip()
        return merge_lines(fallback_text)

    sorted_blocks = sorted(text_blocks, key=lambda b: (b[1], b[0]))
    raw_lines = [b[2] for b in sorted_blocks]
    return merge_lines("\\n".join(raw_lines))


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
    if not raw_text:
        raise ValueError("failed to extract the text")

    return format_page_output(1, raw_text)


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
            text = normalize_docx_line(block.text)
            if text:
                lines.append(text)
                lines.append(DOCX_PARA_BREAK)
        elif isinstance(block, Table):
            lines.extend(table_to_row_style(block))
            lines.append(DOCX_PARA_BREAK)
    collapsed = collapse_docx_paragraphs(lines)
    return "\\n".join(collapsed).strip()


def table_to_row_style(table):
    if not table.rows:
        return []

    headers = [normalize_docx_line(cell.text) for cell in table.rows[0].cells]
    lines = []
    if any(headers):
        lines.append(" | ".join(headers))

    for row in table.rows[1:]:
        cells = []
        for col_index, cell in enumerate(row.cells):
            if col_index > 0 and row.cells[col_index - 1]._tc is cell._tc:
                continue
            cells.append(normalize_docx_line(cell.text))
        lines.append(" | ".join(cells))
    return lines


def merge_lines(text):
    if not text:
        return ""
    merged = re.sub(r"([^\\n])\\n(?=[^\\n])", r"\\1 ", text.strip())
    return unicodedata.normalize("NFKC", merged)


def normalize_docx_line(text: str) -> str:
    if text is None:
        return ""
    cleaned = text.replace("\\u00a0", " ").strip()
    return unicodedata.normalize("NFKC", cleaned)


def collapse_docx_paragraphs(lines):
    out = []
    buffer = ""

    def flush():
        nonlocal buffer
        if buffer.strip():
            out.append(buffer.strip())
        buffer = ""

    sentence_end = re.compile(r"[.!؟!]+$")

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line == DOCX_PARA_BREAK:
            flush()
            continue
        if " | " in line:
            flush()
            out.append(line)
            continue
        if line.startswith(("-", "•", "*")):
            flush()
            buffer = line
            flush()
            continue
        if buffer:
            buffer = f"{buffer} {line}"
        else:
            buffer = line
        if sentence_end.search(line):
            flush()

    flush()
    return out


def format_page_output(page_index, body):
    return f"=== Page {page_index} ===\\n{body.strip()}"


def is_sparse_pdf_text(text: str) -> bool:
    if text is None:
        return True
    compact = re.sub(r"\\s+", "", text)
    return len(compact) < PDF_MIN_TEXT_CHARS


def process_pdf_page(page_index: int, raw_text: str, page_image: bytes):
    text = raw_text
    if is_sparse_pdf_text(text):
        ocr_text = ocr_pdf_page(page_image)
        if ocr_text:
            text = merge_lines(ocr_text)

    normalized = normalize_pdf_page(text, page_image)
    page_body = normalized or text
    return page_index, format_page_output(page_index, page_body)


def ocr_pdf_page(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        text = pytesseract.image_to_string(image, lang=PDF_OCR_LANGS)
        return text.strip()
    except Exception:
        logger.exception("Tesseract OCR failed")
        return ""
