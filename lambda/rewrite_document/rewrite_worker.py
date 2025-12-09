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


def find_latest_extracted_folder(bucket: str) -> Optional[str]:
    """Find the most recently modified folder in classification/extracted/."""
    try:
        prefix = "classification/extracted/"
        logger.info(f"🔍 Finding latest folder in: s3://{bucket}/{prefix}")
        
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix,
            Delimiter='/'
        )
        
        if 'CommonPrefixes' not in response:
            logger.warning(f"❌ No folders found in s3://{bucket}/{prefix}")
            return None
        
        folders = [p['Prefix'] for p in response['CommonPrefixes']]
        logger.info(f"📂 Found {len(folders)} folders")
        
        if not folders:
            return None
        
        # Get the last modified time of each folder by checking its contents
        folder_times = []
        for folder in folders:
            folder_response = s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=folder,
                MaxKeys=1
            )
            if 'Contents' in folder_response and folder_response['Contents']:
                last_modified = folder_response['Contents'][0]['LastModified']
                folder_times.append((folder, last_modified))
                logger.info(f"  📁 {folder} - Last modified: {last_modified}")
        
        if not folder_times:
            logger.warning("No folders with contents found")
            return None
        
        # Sort by last modified time, most recent first
        folder_times.sort(key=lambda x: x[1], reverse=True)
        latest_folder = folder_times[0][0]
        
        logger.info(f"✅ Latest folder: {latest_folder}")
        return latest_folder
        
    except Exception as e:
        logger.error(f"❌ Failed to find latest folder: {e}", exc_info=True)
        return None


def find_text_file_in_folder(bucket: str, folder_prefix: str) -> Optional[str]:
    """Find the first .txt file in an S3 folder."""
    try:
        # Ensure folder prefix ends with /
        if not folder_prefix.endswith('/'):
            folder_prefix += '/'
        
        logger.info(f"🔍 Searching for .txt files in: s3://{bucket}/{folder_prefix}")
        
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=folder_prefix,
            MaxKeys=100
        )
        
        if 'Contents' not in response:
            logger.warning(f"❌ No files found in s3://{bucket}/{folder_prefix}")
            logger.warning(f"📝 Response: {response}")
            return None
        
        # Log all found objects for debugging
        logger.info(f"📂 Found {len(response['Contents'])} objects:")
        for obj in response['Contents']:
            logger.info(f"  - {obj['Key']}")
        
        # Find first .txt file
        for obj in response['Contents']:
            key = obj['Key']
            if key.endswith('.txt') and not key.endswith('/'):
                logger.info(f"✅ Found text file: {key}")
                return key
        
        logger.warning(f"⚠️ No .txt files found in s3://{bucket}/{folder_prefix}")
        return None
    except Exception as e:
        logger.error(f"❌ Failed to list files in s3://{bucket}/{folder_prefix} - {e}")
        logger.error(f"Error details: {str(e)}", exc_info=True)
        return None


def read_text_from_s3(bucket: str, key: str) -> str:
    """Read text file from S3 bucket."""
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read().decode("utf-8")
    except Exception as e:
        logger.error(f"❌ Failed to read s3://{bucket}/{key} - {e}")
        raise


def preprocess_input_text(text: str) -> str:
    """
    Preprocess the raw extracted text BEFORE sending to Bedrock.
    This cleans up OCR artifacts, removes duplicates, and structures the data properly.
    """
    logger.info("🔧 Preprocessing input text...")
    
    # Step 1: Remove OCR artifacts and normalize whitespace
    text = re.sub(r'\r\n', '\n', text)  # Normalize line breaks
    text = re.sub(r'\r', '\n', text)
    text = re.sub(r'\t+', ' ', text)  # Tabs to spaces
    text = re.sub(r' {3,}', '  ', text)  # Collapse excessive spaces
    
    # Step 2: Remove page numbers and headers that repeat on every page
    text = re.sub(r'(?m)^.*?صفحة\s*:?\s*\d+.*?$', '', text)
    text = re.sub(r'(?m)^.*?رقم الصفحة\s*:?\s*\d+.*?$', '', text)
    text = re.sub(r'(?m)^\d+\s*/\s*\d+\s*$', '', text)  # Page numbers like "1 / 5"
    
    # Step 3: Remove duplicate header blocks (مملكة البحرين / النيابة العامة)
    # Find all occurrences
    header_pattern = r'(?:مملكة البحرين|Kingdom of Bahrain)[\s\S]{0,400}?(?:النيابة العامة|Capital Prosecution|نيابة العاصمة)'
    headers = list(re.finditer(header_pattern, text, re.IGNORECASE))
    
    if len(headers) > 1:
        # Keep only the first, remove the rest
        for match in reversed(headers[1:]):
            text = text[:match.start()] + text[match.end():]
        logger.info(f"✂️ Removed {len(headers) - 1} duplicate header blocks")
    
    # Step 4: Remove duplicate "قضية نيابة / جنائي" lines that repeat
    case_header_pattern = r'(?m)^.*?قضية نيابة\s*/\s*جنائي\s*/\s*جنائي عام.*?رقم البلاغ.*?$'
    case_headers = list(re.finditer(case_header_pattern, text))
    
    if len(case_headers) > 1:
        seen_text = set()
        for match in reversed(case_headers):
            match_text = match.group(0).strip()
            if match_text in seen_text:
                # Remove duplicate
                text = text[:match.start()] + text[match.end():]
            else:
                seen_text.add(match_text)
        logger.info(f"✂️ Removed {len(case_headers) - len(seen_text)} duplicate case header lines")
    
    # Step 5: Deduplicate identical paragraphs (OCR often repeats entire blocks)
    paragraphs = text.split('\n\n')
    seen_paragraphs = {}
    unique_paragraphs = []
    
    for para in paragraphs:
        para_clean = para.strip()
        if not para_clean or len(para_clean) < 10:
            unique_paragraphs.append(para)
            continue
        
        # Create a signature for comparison (first 100 chars)
        signature = para_clean[:100]
        
        if signature not in seen_paragraphs:
            seen_paragraphs[signature] = para_clean
            unique_paragraphs.append(para)
        else:
            # Check if it's truly identical or just similar
            if para_clean == seen_paragraphs[signature]:
                logger.info(f"✂️ Removed duplicate paragraph starting with: {signature[:50]}...")
                continue
            else:
                unique_paragraphs.append(para)
    
    text = '\n\n'.join(unique_paragraphs)
    
    # Step 6: Clean up excessive newlines
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Step 7: Remove common OCR garbage patterns
    text = re.sub(r'[ΓòΓöΓÇ]{3,}', '', text)  # Garbled encoding
    text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F]', '', text)  # Control characters
    
    logger.info(f"✅ Preprocessing complete. Cleaned text length: {len(text)}")
    return text.strip()


def build_rewrite_prompts(original_text: str) -> Tuple[str, str]:
    system = (
        "أنت محرِّر تقارير جنائية يعمل لصالح النيابة العامة في مملكة البحرين.\n"
        "مصدر البيانات هو ملف بلاغ شرطي/قضية نيابة يحتوي على جداول مطبوعة "
        "ومجموعة محاضر بعنوان (فتح المحضر بالتاريخ والوقت المذكورين أعلاه...).\n\n"
        "مهمتك:\n"
        "- إنتاج تقرير واحد منظم وواضح فقط، باللغة العربية الرسمية، بدون أي زخرفة.\n"
        "- لا تضف أي معلومة جديدة غير موجودة في النص الأصلي.\n"
        "- لا تحذف أي معلومة جوهرية متعلقة بالقضية (أسماء، أرقام شخصية، تواريخ، أوقات، أماكن، أقوال، قرارات، أرقام بلاغات، حالة المتهم، حالة الصلح، وجود تصوير، إلخ).\n"
        "- يجوز لك حذف السطور المكررة (مثل تكرار رأس الصفحة، جملة \"قضية نيابة / جنائي / جنائي عام رقم البلاغ\"، أو تكرار نفس الفقرة نصاً).\n"
        "- إذا كانت نفس المعلومة مكررة في أكثر من مكان (مثلاً رقم البلاغ أو بيانات الأطراف)، اذكرها مرة واحدة في القسم المناسب.\n"
        "- إذا كانت هناك جمل مقطوعة أو غير مفهومة بسبب OCR ولا يمكن فهم معناها، يجوز حذفها دون تخمين.\n"
        "- إذا كان المستند يحتوي على أكثر من ملف أو إجراء غير مرتبط بالقضية الرئيسية، ضع هذه الأجزاء في قسم (ملاحق إضافية) فقط ولا تدمجها في صلب التقرير.\n"
        "- لا تعيد كتابة التقرير أكثر من مرة.\n"
        "- لا تعيد صياغة نفس المحتوى بصيغتين مختلفتين.\n\n"
        "قواعد الجداول والتنسيق:\n"
        "- مسموح فقط بجدول Markdown واحد لقسم (الأطراف) يتضمن الصفة والاسم والرقم الشخصي وباقي البيانات.\n"
        "- جميع الأقسام الأخرى (المضبوطات، الأضرار، التواريخ، الأسئلة، المحاضر، القرارات) تُكتب كنص أو نقاط، وليست جداول.\n"
        "- لا تنسخ تصميم الجداول الأصلية كما هو؛ استخرج البيانات وامزجها في النص أو النقاط المناسبة.\n"
        "- لا تنسخ جداول إدخال النظام مثل: (أطراف البلاغ) أو (الأشياء العينية) أو (الأسئلة) بنفس شكلها.\n"
        "- الأقوال (أقوال المبلغ، المدعى عليه، الشهود) تُكتب في فقرات نصية، ليست في جدول.\n"
        "- محاضر الشرطة كلها (فتح المحضر، انتقال الموقع، استعلامات، بحث وتحري...) تُكتب كنص أو نقاط فقط بلا أي جدول.\n"
        "- المعلومات الإدارية العامة (مملكة البحرين، النيابة العامة، نيابة العاصمة...) تُذكر مرة واحدة في بيانات القضية فقط.\n"
        "- استخدم عناوين المستوى الثاني Markdown بهذا الشكل فقط: '## العنوان'.\n"
        "- لا تستخدم عناوين بمستويات أخرى مثل '###' أو '####'.\n"
        "- لا تكتب عناوين تبدأ بنمط غريب مثل '#### ال-'.\n\n"
        "ضوابط حساسة:\n"
        "- ممنوع اختراع أسماء أشخاص أو جهات أو أرقام شخصية أو أرقام بلاغات أو مبالغ مالية غير موجودة.\n"
        "- ممنوع تغيير حالة المتهم (موقوف/مطلوب/مخلى سبيل) إلا كما ورد في النص.\n"
        "- ممنوع اختراع قرار نيابة أو حكم محكمة غير مذكور.\n"
        "- إذا لم تجد معلومة مطلوبة في الهيكل، اكتب بدلاً منها: 'غير مذكور في المستند'.\n"
        "- إذا كان هناك أكثر من بلاغ أو أكثر من رقم قضية مذكور، دوِّنها كلها في قسم بيانات القضية أو التواريخ المهمة مع توضيح علاقتها قدر الإمكان من النص نفسه فقط.\n"
    )

    user = (
        "إليك النص الأصلي الكامل لملف بلاغ/قضية قادم من مركز شرطة/نيابة:\n\n"
        f"{original_text}\n\n"
        "المطلوب: إعادة تنظيم وكتابة تقرير واحد فقط بصيغة واضحة ومنسقة، "
        "وفق الهيكل التالي بالضبط، مع ملء أكبر قدر ممكن من الحقول من النص الأصلي "
        "دون اختراع أي معلومة.\n\n"
        "استخدم هذا الهيكل كما هو (وبنفس ترتيب العناوين):\n\n"
        "## بيانات القضية\n\n"
        "- رقم البلاغ الرئيسي / رقم القضية (مثال: 13227/2025):\n"
        "- نوع القضية / تصنيفها (مثال: سرقة، جنائي عام، جنحة ...):\n"
        "- مركز الشرطة المحيل (مثال: مركز شرطة جنوب العاصمة):\n"
        "- النيابة المختصة (مثال: نيابة العاصمة):\n"
        "- تاريخ ووقت تلقي البلاغ الأول:\n"
        "- أرقام البلاغات أو التعميمات الأخرى المرتبطة (إن وجدت):\n"
        "- وجود تصوير أمني (نعم / لا / غير مذكور):\n"
        "- رغبة الأطراف في الصلح (نعم / لا / غير مذكور):\n\n"
        "## الأطراف\n\n"
        "اكتب جدول Markdown واحد لكل الأطراف المذكورين في الملف، "
        "بغض النظر عن مكان ظهورهم في الجداول أو المحاضر. هذا هو **الجدول الوحيد المسموح** في التقرير:\n\n"
        "| الصفة | الاسم الكامل | الجنسية | الرقم الشخصي | الهاتف | ملاحظات |\n"
        "| --- | --- | --- | --- | --- | --- |\n"
        "| (المبلغ / المتضرر / المدعى عليه / شاهد / ضابط / رئيس جمعية / إلخ) | (الاسم كما ورد) | (الجنسية) | (الرقم الشخصي إن وجد) | (رقم الهاتف إن وجد) | (مثل: موقوف، مطلوب، جمعية، جهة عمل، إلخ) |\n\n"
        "إذا كانت بعض الحقول غير موجودة في النص، اكتب: 'غير مذكور'.\n\n"
        "## ملخص الحادث\n\n"
        "- لخص الحادث في فقرة أو فقرتين: الزمان، المكان، ما الذي حدث، "
        "وما هي التهمة الأساسية المنسوبة إلى المدعى عليه.\n\n"
        "## مسرح الحادث\n\n"
        "- اذكر عنوان موقع الحادث كما ورد (منطقة، مجمع، شارع، مبنى، وصف إضافي).\n"
        "- إذا ذُكر أكثر من موقع (مثلاً: محل تجاري + عنوان سكن المتهم)، وضّح ذلك في نقاط.\n\n"
        "## المضبوطات والأشياء العينية\n\n"
        "- إذا وُجدت 'الأشياء العينية' أو محضر مضبوطات أو أشياء متلفة/مسروقة، "
        "اكتبها في شكل نقاط متتابعة، لكل عنصر سطر واحد مثلاً:\n"
        "- (الدور: مسروق/متلف/محجوز...) – (الصنف) – (الوصف التفصيلي) – (الحالة) – (ملاحظات إن وجدت).\n"
        "- إذا لم توجد مضبوطات، اكتب: لا توجد مضبوطات أو أشياء عينية مذكورة.\n\n"
        "## الأضرار (إن وجدت)\n\n"
        "- إذا وردت أضرار مادية (مثل تلف في أقفال، زجاج، أبواب...)، "
        "اذكرها أيضاً في شكل نقاط، كل نقطة توضح: الموقع المتضرر – وصف الضرر – القيمة التقديرية إن وجدت.\n"
        "- إذا لم تُذكر أضرار، اكتب: لا توجد أضرار مذكورة.\n\n"
        "## الأقوال\n\n"
        "اكتب أقوال كل طرف في فقرات منفصلة، مستخلصة من محاضر الاستجواب:\n\n"
        "**أقوال المبلغ/المتضرر:**\n"
        "- لخص ما ورد في محاضر أقواله (أسئلة/أجوبة) بدون تكرار الأسئلة بحرفيتها، "
        "مع الحفاظ على التفاصيل المهمة (كيف عرف بالواقعة، ماذا شاهد، ماذا يطلب...).\n\n"
        "**أقوال المدعى عليه:**\n"
        "- لخص إقراره أو إنكاره كما ورد.\n\n"
        "**أقوال الشهود (إن وجدوا):**\n"
        "- لكل شاهد فقرة قصيرة تلخص ما قاله.\n\n"
        "## إجراءات الشرطة\n\n"
        "- **هام:** لا تستخدم أي جدول في هذا القسم.\n"
        "- استخرج من جميع محاضر \"فتح المحضر\" وما بعدها تسلسل إجراءات الشرطة "
        "مرتبة زمنياً من الأقدم إلى الأحدث في شكل نقاط:\n"
        "- تلقي البلاغ، الاتصال بالضابط المناوب، الانتقال لمسرح الجريمة، المعاينة والتصوير، "
        "تفريغ كاميرات المراقبة، الاستعلامات الأمنية، إرسال الإحضاريات الإلكترونية، "
        "القبض على المتهم، توقيفه، وغيرها.\n\n"
        "## التنازل أو الصلح\n\n"
        "- إذا ورد في المحاضر أو في الأسئلة أن الأطراف يرغبون في الصلح أو لا يرغبون، "
        "أو أن هناك تنازل عن البلاغ، اذكر تفاصيل ذلك (التاريخ، من تنازل، هل تم دفع مبالغ...).\n"
        "- إذا لم يُذكر أي شيء عن الصلح أو التنازل، اكتب: 'غير مذكور في المستند'.\n\n"
        "## إجراءات وقرارات النيابة\n\n"
        "- لخص كافة قرارات النيابة العامة كما وردت في المستند في شكل نقاط:\n"
        "- مثل: طلب الإذن بضبط وإحضار المتهم، التصرف في القضية، الإحالة لنيابة معينة، الحفظ، "
        "الإحالة للمحكمة، تكليف بالحضور، إصدار لائحة الاتهام، الربط الآلي مع المحاكم...\n"
        "- لكل قرار: اذكر التاريخ (إن وجد)، واسم وكيل النيابة أو عضو النيابة، ونص القرار باختصار.\n\n"
        "## تسليم المضبوطات (إن وجد)\n\n"
        "- إذا تم تسليم أي مضبوطات أو مبالغ لشخص أو جهة، اذكر من استلم، متى، وما هي الأشياء المسلَّمة في نقاط.\n"
        "- إذا لم يُذكر تسليم مضبوطات، اكتب: 'غير مذكور في المستند'.\n\n"
        "## التواريخ المهمة والخط الزمني\n\n"
        "- لا تستخدم جدول هنا؛ اكتفِ بقائمة مرتبة زمنياً.\n"
        "- اكتب قائمة منسقة بالتواريخ والأحداث مثل:\n"
        "  - التاريخ والوقت – الحدث – الجهة/الشخص (مثال: 2025-07-22 14:02 – تلقي البلاغ في مركز شرطة جنوب العاصمة – مركز الشرطة).\n\n"
        "## التوقيعات والمحررين\n\n"
        "- اذكر أسماء ورتب محرري المحاضر (مساعد ملازم، عريف، رقيب أول...)\n"
        "- اذكر أسماء الضباط المشرفين (مثال: الرائد/ علي فاضل، النقيب/ حسين شاكر).\n"
        "- اذكر أسماء أعضاء النيابة وأخصائي التحقيق كما وردت.\n"
        "- يمكنك كتابة ذلك في نقاط بسيطة.\n\n"
        "## الأسئلة الختامية (إن وُجد جدول أسئلة)\n\n"
        "- إذا كان هناك جدول في آخر المستند بعنوان 'الأسئلة' (مثل: هل يوجد تصوير أمني؟ هل يرغب أطراف البلاغ في الصلح؟)،\n"
        "  فحوِّله إلى نقاط نصية مثل:\n"
        "  - السؤال: (النص كما ورد) – الإجابة: (كما وردت).\n"
        "- إذا لم توجد أسئلة ختامية، يمكنك حذف هذا القسم أو كتابة: غير مذكور.\n\n"
        "## ملاحق إضافية (إن وجدت)\n\n"
        "- ضع هنا أي محتوى مهم لكنه ليس جزءاً مباشراً من تسلسل القضية، "
        "مثل: بلاغات أخرى معلَّقة على نفس الشخص بدون تفاصيل، أو نماذج إدارية مكررة، "
        "أو صفحات لا تضيف جديداً للقضية ولكن قد تُذكر كمرجع.\n"
        "- إذا لم توجد ملاحق حقيقية، لا تكتب هذا القسم.\n\n"
        "تعليمات نهائية:\n"
        "- اكتب التقرير مرة واحدة فقط، باتباع الهيكل السابق بالكامل وبتسلسل العناوين.\n"
        "- لا تنسخ الجمل المكررة أو رؤوس الصفحات إلا عند الحاجة.\n"
        "- لا تترك أي قسم فارغاً إذا كانت المعلومات متاحة في النص.\n"
        "- إذا لم تتوفر المعلومة لقسم معين، اكتب صراحة: 'غير مذكور في المستند'.\n"
        "- تذكّر: الجدول الوحيد المسموح به في الإخراج هو جدول (الأطراف)، "
        "وجميع الأقسام الأخرى يجب أن تكون نصاً أو نقاطاً فقط.\n"
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


def retry_with_simple_prompt(chunk_text: str, chunk_num: int, total_chunks: int) -> str:
    """
    Retry with a simpler, more neutral prompt to avoid content moderation.
    This is a fallback when the main prompt triggers safety filters.
    """
    logger.info(f"🔄 Retrying chunk {chunk_num} with simplified prompt")
    
    simple_prompt = (
        "يرجى تنظيم وتحسين صياغة النص التالي باللغة العربية الفصحى. "
        "احتفظ بجميع المعلومات والأسماء والتواريخ كما هي بالضبط، فقط حسّن الصياغة والتنظيم.\n\n"
        f"{chunk_text}"
    )
    
    request_body = {
        "messages": [{"role": "user", "content": [{"text": simple_prompt}]}],
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
            logger.warning(f"⚠️ Content still filtered. Returning original text with note.")
            return f"[لا يمكن إعادة الصياغة بسبب فلاتر الأمان]\n\n{chunk_text}"
        
        return response_body["output"]["message"]["content"][0]["text"]
        
    except Exception as e:
        logger.error(f"Retry failed for chunk {chunk_num}: {e}")
        # Last resort: return original with note
        return f"[لم تتم إعادة الصياغة - خطأ في المعالجة]\n\n{chunk_text}"


def call_bedrock_for_chunk(chunk_text: str, chunk_num: int, total_chunks: int) -> str:
    """Call Bedrock to rewrite a single chunk."""
    system_prompt, _ = build_rewrite_prompts("")

    if total_chunks == 1:
        user_prompt = (
            "أعد كتابة التقرير التالي. حافظ على جميع الحقائق والأسماء والتواريخ كما هي.\n\n"
            f"{chunk_text}\n\n"
            "اكتب النسخة المعاد صياغتها بالعربية الفصحى فقط."
        )
    else:
        # Multi-chunk: Tell Bedrock this is a continuation
        if chunk_num == 1:
            user_prompt = (
                f"أعد كتابة الجزء الأول من تقرير التحقيق (جزء {chunk_num} من {total_chunks}). "
                "حافظ على جميع الحقائق والأسماء والتواريخ كما هي. "
                "لا تكرر عنوان 'مملكة البحرين' أو 'النيابة العامة' أو 'بيانات القضية' في الأجزاء اللاحقة.\n\n"
                f"{chunk_text}\n\n"
                "اكتب النسخة المعاد صياغتها بالعربية الفصحى فقط."
            )
        else:
            user_prompt = (
                f"أعد كتابة الجزء التالي من تقرير التحقيق (جزء {chunk_num} من {total_chunks}). "
                "هذا جزء متصل بما سبق، فلا تكرر العناوين الرئيسية أو بيانات القضية مرة أخرى. "
                "حافظ على جميع الحقائق والأسماء والتواريخ كما هي.\n\n"
                f"{chunk_text}\n\n"
                "اكتب النسخة المعاد صياغتها بالعربية الفصحى فقط، دون تكرار الرؤوس."
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
            logger.warning(f"⚠️ Content filtered by Bedrock. Trying alternative approach...")
            # Retry with simplified prompt
            return retry_with_simple_prompt(chunk_text, chunk_num, total_chunks)

        return response_body["output"]["message"]["content"][0]["text"]

    except Exception as e:
        error_str = str(e)
        logger.error(f"Chunk {chunk_num} failed: {error_str}")
        
        # Check if it's a content moderation error
        if "ValidationException" in error_str or "throttling" in error_str.lower():
            logger.warning(f"⚠️ Bedrock error (possibly content moderation). Trying alternative approach...")
            return retry_with_simple_prompt(chunk_text, chunk_num, total_chunks)
        
        raise


def remove_duplicate_sections(text: str) -> str:
    """Remove duplicate header sections and content blocks from merged chunks."""
    
    # Remove duplicate "مملكة البحرين" / "النيابة العامة" header blocks
    # Keep only the first occurrence
    header_pattern = r'(?:#+\s*)?(?:مملكة البحرين|Kingdom of Bahrain)[\s\S]{0,300}?(?:النيابة العامة|Capital Prosecution)'
    headers = list(re.finditer(header_pattern, text, re.IGNORECASE))
    
    if len(headers) > 1:
        # Remove all but the first
        for match in reversed(headers[1:]):
            text = text[:match.start()] + text[match.end():]
        logger.info(f"Removed {len(headers) - 1} duplicate header blocks")
    
    # Remove duplicate "بيانات القضية" sections
    case_data_pattern = r'##\s*بيانات القضية\s*\n[\s\S]{0,800}?(?=\n##|\Z)'
    case_sections = list(re.finditer(case_data_pattern, text))
    
    if len(case_sections) > 1:
        # Keep the most complete one (longest)
        longest = max(case_sections, key=lambda m: len(m.group(0)))
        for match in case_sections:
            if match != longest:
                text = text[:match.start()] + text[match.end():]
        logger.info(f"Removed {len(case_sections) - 1} duplicate case data sections")
    
    # Remove duplicate section headers (## Title appearing multiple times)
    section_pattern = r'(##\s+[^\n]+)'
    seen_headers = set()
    lines = text.split('\n')
    clean_lines = []
    
    for line in lines:
        if re.match(section_pattern, line):
            header_text = line.strip()
            if header_text in seen_headers:
                # Skip duplicate header
                continue
            seen_headers.add(header_text)
        clean_lines.append(line)
    
    text = '\n'.join(clean_lines)
    
    # Remove chunk markers like "الجزء 1 من 2"
    text = re.sub(r'الجزء\s*\d+\s*من\s*\d+', '', text)
    text = re.sub(r'\(الجزء\s+\d+\)', '', text)
    
    # Clean up excessive newlines
    text = re.sub(r'\n{4,}', '\n\n\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text


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

    # Merge chunks with smart deduplication
    result = rewritten_chunks[0]
    for chunk in rewritten_chunks[1:]:
        result += "\n\n" + chunk
    
    # Remove duplicates created during merge
    result = remove_duplicate_sections(result)

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


def save_rewritten_result(job_id: str, session_id: str, rewritten_text: str, original_length: int) -> str:
    """Save the rewritten text to S3 and return the key."""
    # Save to rewritten/{sessionId}.txt (single latest per session)
    result_key = f"rewritten/{session_id}.txt"
    
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=result_key,
        Body=rewritten_text.encode("utf-8"),
        ContentType="text/plain; charset=utf-8",
        Metadata={
            "jobId": job_id,
            "sessionId": session_id,
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
        logger.info(f"📋 Event details: text={bool(text)}, s3_key={s3_key}")
        
        # Get input text
        if not text:
            if s3_key:
                # Check if s3_key is a folder or a file
                actual_key = s3_key
                
                # If it looks like a folder, find the text file inside
                if not s3_key.endswith('.txt'):
                    logger.info(f"📁 s3_key appears to be a folder: '{s3_key}'")
                    
                    # First try to find .txt file in the specified folder
                    found_key = find_text_file_in_folder(BUCKET_NAME, s3_key)
                    
                    # If no .txt file found in specified folder, try the latest folder
                    if not found_key:
                        logger.warning(f"⚠️ No .txt file in specified folder, searching latest folder...")
                        latest_folder = find_latest_extracted_folder(BUCKET_NAME)
                        
                        if latest_folder:
                            logger.info(f"🔄 Trying latest folder: {latest_folder}")
                            found_key = find_text_file_in_folder(BUCKET_NAME, latest_folder)
                    
                    if not found_key:
                        logger.error(f"❌ No .txt file found in folder: {s3_key} or latest folder")
                        update_job_status(job_id, "FAILED", {
                            "error": f"No .txt file found. Please ensure text has been extracted from the document.",
                            "sessionId": session_id,
                            "searchedPath": s3_key
                        })
                        return
                    
                    actual_key = found_key
                    logger.info(f"✅ Using file: {actual_key}")
                
                text = read_text_from_s3(BUCKET_NAME, actual_key)
                logger.info(f"➡ Loaded text from S3: {get_safe_log_info(text, session_id)}")
            else:
                logger.error(f"No text or s3Key provided for job {job_id}")
                update_job_status(job_id, "FAILED", {
                    "error": "No text or s3Key provided",
                    "sessionId": session_id
                })
                return
        
        # Preprocess the input text BEFORE sending to Bedrock
        logger.info(f"📝 Original text length: {len(text)} chars")
        preprocessed_text = preprocess_input_text(text)
        logger.info(f"✅ Preprocessed text length: {len(preprocessed_text)} chars")
        
        # Validate text size
        if len(preprocessed_text) > MAX_TOTAL_CHARS:
            logger.warning(f"Job {job_id}: Text too long ({len(preprocessed_text)} chars)")
            update_job_status(job_id, "FAILED", {
                "error": f"Text too long. Max {MAX_TOTAL_CHARS} chars allowed",
                "currentChars": len(preprocessed_text),
                "sessionId": session_id
            })
            return
        
        # Perform rewrite
        logger.info(f"Starting Bedrock processing for job {job_id}")
        bedrock_output = call_bedrock_for_rewrite(preprocessed_text)
        
        # Validate and sanitize
        is_valid, sanitized, violations = validate_and_sanitize(preprocessed_text, bedrock_output)
        
        if not is_valid:
            logger.warning(f"Job {job_id}: Validation violations: {violations}")
            rewritten_text = sanitized
        else:
            rewritten_text = bedrock_output
        
        # Save result to S3
        result_key = save_rewritten_result(job_id, session_id, rewritten_text, len(preprocessed_text))
        
        # Update status to COMPLETED
        update_job_status(job_id, "COMPLETED", {
            "resultKey": result_key,
            "resultLength": len(rewritten_text),
            "originalLength": len(preprocessed_text),
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
            