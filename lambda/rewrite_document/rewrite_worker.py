"""
Lambda 2: Rewrite Worker
Performs the actual rewrite operation asynchronously and stores the result in S3.
This is invoked by Lambda 1 and does not return a response to API Gateway.
"""

import json
import boto3
import os
import logging
import hashlib
import re
from datetime import datetime
from typing import Dict, Tuple, Any, Optional, List, Set

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
bedrock_runtime = boto3.client("bedrock-runtime", region_name="us-east-1")
s3_client = boto3.client("s3")

# Configuration
BUCKET_NAME = os.environ.get("BUCKET_NAME", "vision-investigation-system-052904446370")
MODEL_ID = "amazon.nova-lite-v1:0"

# ===== Size & performance limits =====
MAX_TOTAL_CHARS = 60000  # Max chars for entire document
CHUNK_SIZE = 15000  # Characters per chunk
OVERLAP_SIZE = 500  # Overlap between chunks for context
MAX_TOKENS = 4000  # Bedrock output limit per chunk


def get_safe_log_info(text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Return safe hashed log info without exposing private data."""
    return {
        "text_hash": hashlib.md5(text.encode("utf-8")).hexdigest()[:8],
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


def build_rewrite_prompts(original_text: str) -> Tuple[str, str]:
    system = (
        "أنت محرر تقارير جنائية للنيابة العامة. مهمتك تنظيم التقرير فقط دون إضافة "
        "أو حذف أي معلومة موجودة في النص الأصلي.\n\n"
        "قواعد إلزامية:\n"
        "- لا تضف أي أسماء أو أرقام أو مواقع غير موجودة في النص.\n"
        "- لا تحذف أي معلومات جوهرية (أسماء، تواريخ، أماكن، أقوال، إجراءات).\n"
        "- إذا وُجدت الفقرة نفسها مكررة، احتفظ بنسخة واحدة فقط.\n"
        "- إذا وُجد عنوان رسمي مكرر (مثل مملكة البحرين – النيابة العامة)، احتفظ بأول تكرار فقط.\n"
        "- إذا كانت هناك جمل مكسورة أو كلمات غير مفهومة نتيجة OCR، احذفها دون محاولة تخمين معناها.\n"
        "- إذا احتوى النص على فتح/إغلاق المحضر عدة مرات، قم بترتيبها زمنيًا ودمجها دون تكرار.\n"
        "- إذا ظهر تقرير آخر داخل نفس المستند، ضع هذه الأجزاء في قسم (ملاحق إضافية) دون دمجها مع التقرير الرئيسي.\n"
        "- لا تكتب النص أكثر من مرة.\n"
        "- لا تعيد صياغة التقرير نفسه مرتين.\n"
        "- استخدم العربية الرسمية فقط.\n\n"
        "قواعد الجداول والتنسيق:\n"
        "- استخدم جداول markdown فقط للأقسام المحددة: الأطراف، المضبوطات، الأضرار، التواريخ المهمة.\n"
        "- لا تنسخ أي جداول من النص الأصلي (مثل: تفاصيل البلاغ، الأسئلة والإجابات، جداول OCR).\n"
        "- احذف الجداول الفارغة أو التي تحتوي على معلومات إدارية مكررة.\n"
        "- الأقوال والإجراءات تُكتب كفقرات نصية، ليس كجداول.\n"
        "- المعلومات الإدارية (مثل: مملكة البحرين، النيابة العامة، رقم البلاغ) تُكتب في قسم بيانات القضية فقط.\n"
        "- لا تكتب '####' أو '###' أو '#' أو 'ال-' في أي مكان.\n"
        "- استخدم '##' فقط للعناوين الرئيسية المحددة في الهيكل.\n"
        "- لا تكتب عناوين فرعية بصيغة '#### ال-' أو أي صيغة مشابهة.\n"
    )

    user = (
        "إليك النص الأصلي للتقرير كما ورد:\n\n"
        f"{original_text}\n\n"
        "المطلوب: إعادة كتابة التقرير بصيغة منظمة وفق الهيكل التالي **مرة واحدة فقط**، "
        "على أن تُملأ الحقول من النص الأصلي دون أي إضافة أو اختراع معلومات.\n\n"
        "**هيكل التقرير النهائي (اتبعه بالضبط ولا تكرر أي قسم):**\n\n"
        "## بيانات القضية\n\n"
        "- رقم البلاغ / رقم القضية:\n"
        "- نوع القضية (إن وجد):\n"
        "- الجهة (مثال: نيابة العاصمة، مركز شرطة الحورة):\n"
        "- تاريخ ووقت فتح المحضر:\n\n"
        "## الأطراف\n\n"
        "**يجب كتابة الأطراف في جدول markdown بهذا الشكل بالضبط:**\n\n"
        "| الصفة | الاسم الكامل | الجنسية | الرقم الشخصي | الهاتف |\n"
        "| --- | --- | --- | --- | --- |\n"
        "| (الصفة) | (الاسم كما ورد) | (الجنسية) | (الرقم) | (رقم الهاتف) |\n\n"
        "ملاحظة: اكتب سطر لكل شخص مذكور في النص. إذا كانت معلومة ناقصة، اكتب 'غير مذكور'.\n"
        "الصفات المحتملة: مبلغ، مدعى عليه، شاهد، ضابط، محرر محضر، مترجم، وكيل نيابة، إلخ.\n\n"
        "## ملخص الحادث\n"
        "- الزمان، المكان، وصف الفعل الإجرامي.\n\n"
        "## مسرح الحادث\n"
        "- العنوان الكامل كما ورد.\n\n"
        "## المضبوطات\n\n"
        "إذا وجدت مضبوطات، اكتبها في جدول:\n\n"
        "| م | الصنف | الوصف | الحالة | ملاحظات |\n"
        "| --- | --- | --- | --- | --- |\n"
        "| 1 | (الصنف) | (الوصف التفصيلي) | (الحالة) | (ملاحظات) |\n\n"
        "مثال:\n"
        "| م | الصنف | الوصف | الحالة | ملاحظات |\n"
        "| --- | --- | --- | --- | --- |\n"
        "| 1 | منشار كهربائي | منشار يدوي | مستعمل | مضبوط في الموقع |\n"
        "| 2 | أسلاك كهربائية | حزمة أسلاك متنوعة | جديدة | غير مذكور |\n\n"
        "## الأضرار\n\n"
        "إذا وجدت أضرار، اكتبها في جدول:\n\n"
        "| م | الموقع/الجزء المتضرر | وصف الضرر | القيمة التقديرية |\n"
        "| --- | --- | --- | --- |\n"
        "| 1 | (الموقع) | (وصف التلف) | (المبلغ إن وجد) |\n\n"
        "مثال:\n"
        "| م | الموقع/الجزء المتضرر | وصف الضرر | القيمة التقديرية |\n"
        "| --- | --- | --- | --- |\n"
        "| 1 | غرفة المصعد | كسر في الزجاج الأمامي | 500 دينار |\n"
        "| 2 | الشقة رقم 12 | تلف في الباب الخشبي | غير مذكور |\n\n"
        "## الأقوال\n"
        "اكتب أقوال كل شخص في فقرات منفصلة:\n\n"
        "**أقوال المبلغ:**\n\n"
        "(لخص ما قاله المبلغ من النص)\n\n"
        "**أقوال المدعى عليه:**\n\n"
        "(لخص ما قاله المدعى عليه من النص)\n\n"
        "**أقوال الشهود:**\n\n"
        "(لخص أقوال كل شاهد)\n\n"
        "## إجراءات الشرطة\n"
        "- كل إجراءات البحث والتحري والمعاينة كما وردت.\n"
        "- التوجه للموقع، المعاينة، التصوير، الحجز، التحقيق الميداني.\n\n"
        "## التنازل أو الصلح\n"
        "- إذا تنازل المبلغ عن البلاغ، اذكر التاريخ والسبب والتفاصيل كما وردت.\n"
        "- إذا تم الصلح بين الأطراف، اذكر ذلك.\n"
        "- إذا لم يحدث تنازل أو صلح، اكتب: غير مذكور.\n\n"
        "## إجراءات وقرارات النيابة\n"
        "اذكر جميع القرارات والإجراءات بالتواريخ:\n"
        "- قرارات وكيل النيابة (الحجز، الإفراج، تسليم المضبوطات، الإحالة، الحفظ...).\n"
        "- التواريخ الكاملة لكل قرار.\n"
        "- أسماء وكلاء النيابة الذين اتخذوا القرارات.\n\n"
        "## تسليم المضبوطات\n"
        "- إذا تم تسليم المضبوطات لأحد، اذكر: من استلم، متى، ما هي الأشياء.\n"
        "- إذا لم يتم التسليم، اذكر السبب.\n\n"
        "## التواريخ المهمة\n\n"
        "**يجب كتابة جميع التواريخ في جدول markdown:**\n\n"
        "| التاريخ والوقت | الحدث | الجهة/المسؤول |\n"
        "| --- | --- | --- |\n"
        "| (التاريخ والوقت) | (وصف الحدث) | (الجهة أو الشخص) |\n\n"
        "اكتب جميع التواريخ المذكورة في النص بترتيب زمني من الأقدم إلى الأحدث.\n\n"
        "## التوقيعات والمحررين\n\n"
        "اذكر جميع الأسماء والرتب والتوقيعات كما وردت في النص:\n\n"
        "**محرري المحاضر:**\n"
        "- (الرتبة والاسم، التاريخ)\n\n"
        "**الضباط المشرفين:**\n"
        "- (الرتبة والاسم)\n\n"
        "**وكلاء النيابة:**\n"
        "- (الاسم والقرارات)\n\n"
        "**أخصائيي التحقيق:**\n"
        "- (الاسم)\n\n"
        "## ملاحق إضافية (إن وجدت)\n\n"
        "**ملاحظة:** هذا القسم للتقارير المنفصلة أو الملحقة فقط.\n"
        "- لا تضع هنا الإجراءات العادية أو القرارات.\n"
        "- لا تكرر الجداول (الأطراف، المضبوطات، الأضرار، التواريخ) هنا.\n"
        "- إذا لم يكن هناك تقرير منفصل أو ملحق، احذف هذا القسم تماماً.\n\n"
        "---\n\n"
        "**تعليمات مهمة جداً:**\n\n"
        "**ما يجب كتابته:**\n"
        "1. اقرأ النص الأصلي كاملاً من البداية إلى النهاية.\n"
        "2. استخرج المعلومات الجوهرية فقط وضعها في الأقسام المحددة أعلاه.\n"
        "3. الجداول المطلوبة فقط: الأطراف، المضبوطات، الأضرار، التواريخ المهمة.\n"
        "4. جميع الأقوال تُكتب كفقرات نصية منظمة، ليس كجداول.\n"
        "5. جميع الإجراءات تُكتب كفقرات أو نقاط، ليس كجداول.\n\n"
        "**ما يجب حذفه وعدم نسخه:**\n"
        "1. لا تنسخ جداول OCR من النص الأصلي (مثل: جدول 'تفاصيل البلاغ' المكرر).\n"
        "2. لا تنسخ جداول 'الأسئلة والإجابات' من النص الأصلي.\n"
        "3. لا تنسخ معلومات إدارية مكررة في جداول.\n"
        "4. لا تكتب جداول فارغة أو غير مفيدة.\n"
        "5. لا تكرر العناوين الرسمية (مملكة البحرين، النيابة العامة) أكثر من مرة.\n"
        "6. لا تكرر أي قسم من الأقسام المذكورة أعلاه (بيانات القضية تُكتب مرة واحدة فقط).\n"
        "7. لا تكتب 'ملاحق إضافية' إذا لم يكن هناك تقرير منفصل.\n"
        "8. لا تضع جداول الأطراف/المضبوطات/الأضرار/التواريخ في قسم 'ملاحق إضافية'.\n"
        "9. **ممنوع تماماً:** لا تكتب '#### ال-' أو '### ال-' أو أي عنوان يبدأ بـ 'ال-'.\n"
        "10. **ممنوع تماماً:** لا تكتب فقرات متعددة تبدأ كل منها بـ '#### ال-' متبوعة بمعلومات.\n"
        "11. لا تكتب قوائم طويلة من الإجراءات بصيغة '#### ال- النيابة العامة'.\n\n"
        "**متطلبات الاكتمال:**\n"
        "1. لا تتوقف عن الكتابة حتى تنتهي من جميع الأقسام.\n"
        "2. تأكد من كتابة جميع القرارات والتواريخ والإجراءات حتى آخر سطر.\n"
        "3. إذا وجدت معلومات عن التنازل أو الصلح أو تسليم المضبوطات، يجب كتابتها.\n"
        "4. جدول التواريخ يجب أن يحتوي على جميع التواريخ من أول الحادث حتى آخر إجراء.\n"
        "5. لا تترك أي قسم فارغاً إذا كانت المعلومات موجودة في النص.\n"
        "6. اكتب التقرير **مرة واحدة فقط** بشكل كامل واحترافي - اتبع الهيكل المحدد بالضبط.\n"
        "7. كل قسم يُكتب في مكانه المحدد فقط، لا تكرر الأقسام في أماكن أخرى.\n"
        "8. إذا لم تجد معلومة مطلوبة، اكتب (غير مذكور).\n"
    )

    return system, user


def split_text_into_chunks(text: str) -> List[str]:
    """Split text into chunks with overlap to maintain context."""
    if len(text) <= CHUNK_SIZE:
        return [text]

    chunks = []
    start = 0

    while start < len(text):
        end = start + CHUNK_SIZE

        # If not the last chunk, try to break at sentence boundary
        if end < len(text):
            # Look for sentence endings within last 200 chars
            search_start = max(start, end - 200)
            last_period = text.rfind(".", search_start, end)
            last_newline = text.rfind("\n", search_start, end)
            break_point = max(last_period, last_newline)

            if break_point > start:
                end = break_point + 1

        chunks.append(text[start:end])
        start = end - OVERLAP_SIZE if end < len(text) else end

    logger.info(f"Split text into {len(chunks)} chunks")
    return chunks


def call_bedrock_for_chunk(chunk_text: str, chunk_num: int, total_chunks: int) -> str:
    """Call Bedrock to rewrite a single chunk."""
    system_prompt, _ = build_rewrite_prompts("")

    user_prompt = (
        f"أعد كتابة الجزء التالي من تقرير التحقيق (الجزء {chunk_num} من {total_chunks}). "
        "حافظ على جميع الحقائق والأسماء والتواريخ كما هي.\n\n"
        f"{chunk_text}\n\n"
        "اكتب النسخة المعاد صياغتها بالعربية الفصحى فقط."
    )

    request_body = {
        "system": [{"text": system_prompt}],
        "messages": [{"role": "user", "content": [{"text": user_prompt}]}],
        "inferenceConfig": {
            "maxTokens": MAX_TOKENS,
            "temperature": 0.0,
            "topP": 0.8
        }
    }

    try:
        response = bedrock_runtime.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(request_body, ensure_ascii=False).encode("utf-8")
        )

        response_body = json.loads(response["body"].read())
        stop_reason = response_body.get("stopReason", "")

        if isinstance(stop_reason, str) and ("content_filtered" in stop_reason.lower() or "blocked" in stop_reason.lower()):
            raise ValueError("Content blocked by safety filters")

        return response_body["output"]["message"]["content"][0]["text"]

    except Exception as e:
        logger.error(f"Chunk {chunk_num} failed: {e}")
        raise


def call_bedrock_for_rewrite(original_text: str) -> str:
    """Rewrite document by processing in chunks if needed."""
    chunks = split_text_into_chunks(original_text)

    if len(chunks) == 1:
        logger.info("Processing as single chunk")
        return call_bedrock_for_chunk(chunks[0], 1, 1)

    logger.info(f"Processing {len(chunks)} chunks")
    rewritten_chunks = []

    for i, chunk in enumerate(chunks, 1):
        logger.info(f"Processing chunk {i}/{len(chunks)}")
        rewritten = call_bedrock_for_chunk(chunk, i, len(chunks))
        rewritten_chunks.append(rewritten)

    # Merge chunks, removing overlap duplicates
    result = rewritten_chunks[0]
    for chunk in rewritten_chunks[1:]:
        # Simple merge - append with newline
        result += "\n" + chunk

    logger.info(f"Merged {len(chunks)} chunks. Final length: {len(result)}")
    return result


# ---------------------- Entity Extraction & Validation ----------------------

ROLE_KEYWORDS = [
    "مبلغ", "مدعى عليه", "مشكوًى عليه", "مشكو عليه", "شاهد", "مشتبه", "مذكور",
    "مجني عليه", "متهم", "محامي", "قاضي", "محقق", "كاتب ضبط"
]

SECTION_KEYWORDS = [
    "مقدمة", "ملخص", "ملخص الحادث", "تفاصيل الواقعة", "وقائع القضية", "أقوال",
    "الشهود", "أقوال الشاكي", "أقوال المدعى عليه", "أقوال المبلغ", "أقوال الشاهد",
    "التحقيق", "التقرير", "الخاتمة", "الطلبات", "القرار", "أطراف البلاغ", "مسرح الحادث"
]


def extract_entities(text: str) -> Dict[str, Set[str]]:
    """Extract names, roles, case numbers, dates, times, IDs, locations from Arabic text."""
    names: Set[str] = set()

    # Naive Arabic name pattern (2-5 tokens of letters) – conservative to reduce false positives
    for m in re.finditer(r"\b[\u0621-\u064A]{2,}(?:\s+[\u0621-\u064A]{2,}){1,4}\b", text):
        nm = m.group(0).strip()
        excluded_terms = (
            r"\b(مملكة|وزارة|النيابة|البحرين|شرطة|قرار|بلاغ|القضية|التحقيق|المحكمة|"
            r"الجنائية|العامة|الأمن|العدل|القانون|الحكومة|الداخلية|نيابة|مركز شرطة)\b"
        )
        if len(nm.split()) >= 2 and not re.search(excluded_terms, nm):
            names.add(nm)

    roles: Set[str] = set()
    for kw in ROLE_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", text):
            roles.add(kw)

    # Case number patterns
    case_numbers: Set[str] = set(
        re.findall(r"(?:رقم\s*(?:البلاغ|القضية)\s*[:：]?\s*(\d{2,}))", text)
    )

    # Dates: dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd
    dates: Set[str] = set(
        re.findall(r"\b(?:\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}|\d{4}[\-/]\d{1,2}[\-/]\d{1,2})\b", text)
    )

    # Times: HH:MM(:SS)
    times: Set[str] = set(re.findall(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", text))

    # National IDs: 9-12 digits
    national_ids: Set[str] = set(re.findall(r"\b\d{9,12}\b", text))

    # Locations: very crude detection via بعد 'في'/'بـ'
    locations: Set[str] = set()
    for m in re.finditer(
        r"\b(?:في|بـ)\s+([\u0621-\u064A]{2,}(?:\s+[\u0621-\u064A]{2,}){0,3})\b", text
    ):
        loc = m.group(1).strip()
        if not re.search(r"\b(المذكور|المذكورة|المدعى|الشاكي|المتهم)\b", loc):
            locations.add(loc)

    sections: Set[str] = set()
    for kw in SECTION_KEYWORDS:
        # Allow heading followed by colon and either space or newline
        pattern = rf"\n\s*{re.escape(kw)}\s*[:：]?(?:\s|\n)"
        if re.search(pattern, text):
            sections.add(kw)

    return {
        "names": names,
        "roles": roles,
        "case_numbers": case_numbers,
        "dates": dates,
        "times": times,
        "national_ids": national_ids,
        "locations": locations,
        "sections": sections
    }


def remove_duplicated_paragraphs(text: str) -> str:
    """Remove exact duplicate paragraphs that often appear due to artifacts."""
    paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    seen: Set[str] = set()
    result: List[str] = []

    for p in paras:
        key = hashlib.md5(p.encode("utf-8")).hexdigest()
        if key not in seen:
            seen.add(key)
            result.append(p)

    return "\n\n".join(result)


def case_boundary_protection(text: str) -> str:
    """
    Light cleanup to remove obviously fabricated headings but do NOT truncate
    valid multi-page reports or repeated headers like رقم البلاغ.
    """
    forbidden_heads = [
        r"^\s*تقرير التحقيق الرسمي\s*$",
        r"^\s*بيانات التحقيق\s*[:：]?\s*$"
    ]

    lines = text.splitlines()
    cleaned_lines: List[str] = []

    for ln in lines:
        if any(re.match(pat, ln.strip()) for pat in forbidden_heads):
            continue
        cleaned_lines.append(ln)

    return "\n".join(cleaned_lines)


def validate_and_sanitize(original: str, rewritten: str) -> Tuple[bool, str, List[str]]:
    """
    Validate rewritten text against original entities and structure.
    Returns (is_valid, sanitized_text, violations).
    If invalid, sanitized_text is cleaned.
    """
    orig = extract_entities(original)
    new = extract_entities(rewritten)
    violations: List[str] = []

    # New names introduced
    extra_names = new["names"] - orig["names"]
    if extra_names:
        violations.append(f"أسماء جديدة غير موجودة في الأصل: {', '.join(sorted(extra_names))}")

    # New roles introduced
    extra_roles = new["roles"] - orig["roles"]
    if extra_roles:
        violations.append(f"أدوار جديدة غير موجودة في الأصل: {', '.join(sorted(extra_roles))}")

    # Case number duplication/new
    if len(new["case_numbers"]) > len(orig["case_numbers"]) or (
        new["case_numbers"] - orig["case_numbers"]
    ):
        violations.append("رقم بلاغ/قضية إضافي أو مختلف تم إدخاله")

    # Missing critical info: names or case numbers removed
    missing_names = orig["names"] - new["names"]
    if missing_names:
        violations.append(
            f"تم حذف بعض الأسماء من النص: {', '.join(sorted(missing_names))}"
        )

    missing_case_numbers = orig["case_numbers"] - new["case_numbers"]
    if missing_case_numbers:
        violations.append("تم حذف رقم بلاغ/قضية موجود في النص الأصلي")

    # Sections fabricated
    fabricated_sections = new["sections"] - orig["sections"]
    if fabricated_sections:
        violations.append(
            f"أقسام مُضافة غير موجودة في الأصل: {', '.join(sorted(fabricated_sections))}"
        )

    # Detect duplicated paragraphs
    para_counts: Dict[str, int] = {}
    for p in re.split(r"\n{2,}", rewritten):
        p = p.strip()
        if not p:
            continue
        para_counts[p] = para_counts.get(p, 0) + 1

    if any(c > 1 for c in para_counts.values()):
        violations.append("تكرار فقرات")

    # Sanitization steps: remove duplicates, run light boundary protection
    sanitized = remove_duplicated_paragraphs(rewritten)
    sanitized = case_boundary_protection(sanitized)

    # If violations exist, try removing some obviously fabricated lines
    if violations:
        lines = sanitized.splitlines()
        kept: List[str] = []
        for ln in lines:
            if re.search(r"\b(?:تقرير التحقيق الرسمي|بيانات التحقيق)\b", ln):
                continue
            kept.append(ln)
        sanitized = "\n".join(kept)

    is_valid = len(violations) == 0
    return is_valid, sanitized, violations


def update_job_status(job_id: str, status: str, data: Optional[Dict] = None) -> None:
    """Update job status in S3."""
    status_key = f"rewrite-jobs/{job_id}/status.json"
    
    status_data = {
        "jobId": job_id,
        "status": status,
        "updatedAt": datetime.utcnow().isoformat()
    }
    
    if data:
        status_data.update(data)
    
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=status_key,
        Body=json.dumps(status_data, ensure_ascii=False),
        ContentType="application/json"
    )
    
    logger.info(f"Updated job {job_id} status to {status}")


def save_rewritten_result(job_id: str, rewritten_text: str, original_length: int) -> str:
    """Save the rewritten text to S3 and return the key."""
    result_key = f"rewrite-jobs/{job_id}/result.txt"
    
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=result_key,
        Body=rewritten_text.encode("utf-8"),
        ContentType="text/plain; charset=utf-8",
        Metadata={
            "jobId": job_id,
            "originalLength": str(original_length),
            "rewrittenLength": str(len(rewritten_text))
        }
    )
    
    logger.info(f"Saved rewritten result for job {job_id} to {result_key}")
    return result_key


def lambda_handler(event: Dict, context: Any) -> None:
    """
    Worker Lambda handler - processes rewrite jobs asynchronously.
    Does not return a response to API Gateway.
    """
    job_id = None
    
    try:
        # Extract job details from event (sent by Lambda 1)
        job_id = event.get("jobId")
        text = event.get("text")
        s3_key = event.get("s3Key")
        session_id = event.get("sessionId", "unknown")
        
        if not job_id:
            logger.error("No job ID provided in event")
            return
        
        logger.info(f"🔄 Processing rewrite job {job_id} for session {session_id}")
        
        # Get input text
        if not text:
            if s3_key:
                text = read_text_from_s3(BUCKET_NAME, s3_key)
                logger.info(f"➡ Loaded text from S3: {get_safe_log_info(text, session_id)}")
            else:
                logger.error(f"No text or s3Key provided for job {job_id}")
                update_job_status(job_id, "FAILED", {
                    "error": "No text or s3Key provided",
                    "sessionId": session_id
                })
                return
        
        # Validate text size
        if len(text) > MAX_TOTAL_CHARS:
            logger.warning(f"Job {job_id}: Text too long ({len(text)} chars)")
            update_job_status(job_id, "FAILED", {
                "error": f"Text too long. Max {MAX_TOTAL_CHARS} chars allowed",
                "currentChars": len(text),
                "sessionId": session_id
            })
            return
        
        # Perform rewrite
        logger.info(f"Starting Bedrock processing for job {job_id}")
        bedrock_output = call_bedrock_for_rewrite(text)
        
        # Validate and sanitize
        is_valid, sanitized, violations = validate_and_sanitize(text, bedrock_output)
        
        if not is_valid:
            logger.warning(f"Job {job_id}: Validation violations: {violations}")
            rewritten_text = sanitized
        else:
            rewritten_text = bedrock_output
        
        # Save result to S3
        result_key = save_rewritten_result(job_id, rewritten_text, len(text))
        
        # Update status to COMPLETED
        update_job_status(job_id, "COMPLETED", {
            "resultKey": result_key,
            "resultLength": len(rewritten_text),
            "originalLength": len(text),
            "model": MODEL_ID,
            "sessionId": session_id,
            "validationPassed": is_valid,
            "violations": violations if not is_valid else []
        })
        
        logger.info(f"✅ Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Error processing job {job_id}: {e}", exc_info=True)
        
        if job_id:
            update_job_status(job_id, "FAILED", {
                "error": str(e),
                "errorType": type(e).__name__
            })
