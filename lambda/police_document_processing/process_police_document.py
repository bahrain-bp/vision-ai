# lambda/police_document_processing/process_police_document.py
import json
import boto3
import os
from typing import Dict, Any
from datetime import datetime
from urllib.parse import unquote_plus

# PyMuPDF import (from layer)
import fitz

# Initialize AWS clients
s3_client = boto3.client('s3')
bedrock_client = boto3.client('bedrock-runtime')

# Environment variables
BUCKET_NAME = os.environ['BUCKET_NAME']
BEDROCK_MODEL_ID = os.environ.get('INFERENCE_PROFILE_ARN', 'amazon.nova-lite-v1:0')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler triggered by S3 ObjectCreated events.
    
    Processes police PDF documents:
    1. Validates the PDF is in police-documents folder
    2. Downloads PDF from S3
    3. Extracts text using PyMuPDF
    4. Sends extracted text to Bedrock Nova Lite for summarization
    5. Saves summary to S3
    """
    
    print(f"📥 Received event: {json.dumps(event)}")
    
    processed_count = 0
    skipped_count = 0
    errors = []
    
    for record in event.get('Records', []):
        try:
            bucket = record['s3']['bucket']['name']
            key = unquote_plus(record['s3']['object']['key'])
            
            print(f"\n{'='*60}")
            print(f"Processing: s3://{bucket}/{key}")
            print(f"{'='*60}")
            
            # Validate path
            if '/police-documents/' not in key:
                print(f"⏭️  SKIPPED: Not in police-documents folder")
                skipped_count += 1
                continue
            
            if not key.endswith('.pdf'):
                print(f"⏭️  SKIPPED: Not a PDF file")
                skipped_count += 1
                continue
            
            # Extract case ID
            try:
                path_parts = key.split('/')
                if len(path_parts) < 4 or path_parts[0] != 'cases':
                    raise ValueError(f"Invalid path structure: {key}")
                
                case_id = path_parts[1]
                filename = path_parts[-1]
                
                print(f"✅ Valid police document detected")
                print(f"   Case ID: {case_id}")
                print(f"   File: {filename}")
                
            except (IndexError, ValueError) as e:
                print(f"❌ ERROR: Invalid path format - {e}")
                errors.append(f"Invalid path: {key}")
                skipped_count += 1
                continue
            
            # Process the PDF
            try:
                summary = process_police_pdf(bucket, key, case_id)
                processed_count += 1
                print(f"✅ Successfully processed case: {case_id}")
                
            except Exception as e:
                error_msg = f"Failed to process {key}: {str(e)}"
                print(f"❌ ERROR: {error_msg}")
                errors.append(error_msg)
                continue
                
        except Exception as e:
            error_msg = f"Unexpected error processing record: {str(e)}"
            print(f"❌ CRITICAL ERROR: {error_msg}")
            errors.append(error_msg)
            continue
    
    print(f"\n{'='*60}")
    print(f"📊 Processing Summary:")
    print(f"   ✅ Processed: {processed_count}")
    print(f"   ⏭️  Skipped: {skipped_count}")
    print(f"   ❌ Errors: {len(errors)}")
    print(f"{'='*60}")
    
    if errors:
        print(f"\n⚠️  Errors encountered:")
        for error in errors:
            print(f"   - {error}")
    
    return {
        'statusCode': 200 if not errors else 207,
        'body': json.dumps({
            'processed': processed_count,
            'skipped': skipped_count,
            'errors': len(errors),
            'error_details': errors if errors else None
        })
    }


def process_police_pdf(bucket: str, key: str, case_id: str) -> str:
    """
    Download PDF, extract text, send to Nova Lite for summarization, save summary.
    """
    
    # ==========================================
    # STEP 1: Download PDF from S3
    # ==========================================
    print(f"🔄 Step 1: Downloading PDF from S3...")
    
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        pdf_bytes = response['Body'].read()
        pdf_size_mb = len(pdf_bytes) / (1024 * 1024)
        print(f"   ✅ Downloaded PDF: {pdf_size_mb:.2f} MB")
    except Exception as e:
        raise Exception(f"Failed to download PDF from S3: {str(e)}")
    
    # ==========================================
    # STEP 2: Extract Text from PDF
    # ==========================================
    print(f"🔄 Step 2: Extracting text from PDF using PyMuPDF...")
    
    try:
        extracted_text = extract_pdf_text(pdf_bytes)
        print(f"   ✅ Extracted text: {len(extracted_text)} characters")
        
        # Show preview
        preview = extracted_text[:200].replace('\n', ' ')
        print(f"   📄 Preview: {preview}...")
        
    except Exception as e:
        raise Exception(f"Failed to extract text from PDF: {str(e)}")
    
    # ==========================================
    # STEP 3: Validate Extraction
    # ==========================================
    print(f"🔄 Step 3: Validating extracted text...")
    
    if not extracted_text or len(extracted_text.strip()) < 50:
        raise Exception(
            f"Text extraction failed - only got {len(extracted_text)} chars. "
            f"PDF might be scanned/corrupted."
        )
    
    print(f"   ✅ Text extraction successful")
    
    # ==========================================
    # STEP 4: Summarize with Nova Lite
    # ==========================================
    print(f"🔄 Step 4: Sending extracted text to Nova Lite for summarization...")
    
    try:
        summary = summarize_with_bedrock(extracted_text)
        print(f"   ✅ Received summary: {len(summary)} characters")
    except Exception as e:
        raise Exception(f"Bedrock summarization failed: {str(e)}")
    
    # ==========================================
    # STEP 5: Validate Summary
    # ==========================================
    print(f"🔄 Step 5: Validating summary...")
    
    if not summary or len(summary) < 100:
        raise Exception(f"Generated summary is too short: {len(summary)} chars")
    
    print(f"   ✅ Summary validation passed")
    
    # ==========================================
    # STEP 6: Save Summary to S3
    # ==========================================
    print(f"🔄 Step 6: Saving summary to S3...")
    
    summary_key = f"cases/{case_id}/police-summary.txt"
    
    try:
        metadata = {
            'source-pdf': key,
            'case-id': case_id,
            'generated-at': datetime.utcnow().isoformat(),
            'model': BEDROCK_MODEL_ID,
            'summary-length': str(len(summary)),
            'extraction-method': 'pymupdf'
        }
        
        s3_client.put_object(
            Bucket=bucket,
            Key=summary_key,
            Body=summary.encode('utf-8'),
            ContentType='text/plain; charset=utf-8',
            Metadata=metadata
        )

        
        print(f"   ✅ Summary saved to: s3://{bucket}/{summary_key}")

        # ==========================================
        #  Save HTML Wrapper
        # ==========================================
        save_html_wrapper(bucket, case_id, summary, metadata['generated-at'])
        
    except Exception as e:
        raise Exception(f"Failed to save summary to S3: {str(e)}")
    
    print(f"✅ Processing complete for case: {case_id}")
    return summary


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    Extract text from PDF using PyMuPDF.
    Handles Arabic RTL text properly.
    """
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        text_parts = []
        
        for page_num, page in enumerate(doc, 1):
            print(f"      Extracting page {page_num}/{doc.page_count}...")
            
            # Get text blocks with positioning information
            blocks = page.get_text("blocks")
            
            if not blocks:
                # Fallback to simple text extraction
                page_text = page.get_text("text")
            else:
                # Sort blocks by position (top to bottom, right to left for Arabic)
                sorted_blocks = sorted(blocks, key=lambda b: (b[1], -b[0]))
                
                # Extract text from sorted blocks
                page_text = "\n".join([
                    block[4].strip() 
                    for block in sorted_blocks 
                    if len(block) > 4 and block[4].strip()
                ])
            
            if page_text.strip():
                text_parts.append(page_text)
        
        full_text = "\n\n".join(text_parts)
        return full_text.strip()


def summarize_with_bedrock(extracted_text: str) -> str:
    """
    Send EXTRACTED text to Nova Lite for summarization.
    Truncates text if too long to fit model context window.
    """
    
    # Nova Lite context window: ~30K tokens (~20K chars safe limit)
    MAX_CHARS = 20000
    
    if len(extracted_text) > MAX_CHARS:
        print(f"   ⚠️  Text too long ({len(extracted_text)} chars), truncating to {MAX_CHARS}")
        extracted_text = extracted_text[:MAX_CHARS]
        print(f"   ✅ Truncated to {len(extracted_text)} chars")
    
    # Build prompt with extracted text
    prompt = f"""{build_summarization_prompt()}

النص المستخرج من التقرير:

{extracted_text}
"""
    
    bedrock_request = {
        "messages": [{
            "role": "user",
            "content": [{
                "text": prompt
            }]
        }],
        "inferenceConfig": {
            "maxTokens": 2000,
            "temperature": 0.3,
            "topP": 0.9
        }
    }
    
    try:
        response = bedrock_client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(bedrock_request)
        )
        
        response_body = json.loads(response['body'].read())
        summary = response_body['output']['message']['content'][0]['text']
        
        return summary.strip()
        
    except Exception as e:
        print(f"   ❌ Bedrock error: {str(e)}")
        raise


def build_summarization_prompt() -> str:
    """
    Constructs the prompt for Nova Lite to summarize police reports.
    """
    return """أنت مساعد ذكاء اصطناعي للنيابة العامة في البحرين، متخصص في تلخيص تقارير التحقيقات الشرطية.

لخّص التقرير الشرطي التالي باللغة العربية. استخرج ونظّم:

1. **نوع القضية ووصف الحادث** (Case Type and Incident Description)
   - ما الذي حدث؟
   - طبيعة الحادث (حادث عمل، سرقة، اعتداء، إلخ)

2. **التاريخ والوقت والموقع** (Date, Time, and Location)
   - متى وقع الحادث؟
   - أين وقع؟

3. **الأطراف المعنية** (Parties Involved)
   - المجني عليه/المجني عليهم: الأسماء، الأعمار، الأدوار
   - المتهم/المتهمون: الأسماء، الأعمار، العلاقة بالمجني عليه
   - الشهود: الأسماء، الأدوار

4. **الوقائع الرئيسية والأدلة** (Key Facts and Evidence)
   - الأدلة المادية المذكورة
   - الإفادات أو الاعترافات الأولية
   - تفاصيل الجدول الزمني المهمة

5. **السياق القانوني** (Legal Context)
   - الانتهاكات أو التهم المزعومة
   - القوانين أو اللوائح ذات الصلة المذكورة

اجعل الملخص بين 300-500 كلمة. استخدم لغة عربية واضحة واحترافية مناسبة للإجراءات القانونية.

أخرج النص العادي فقط (بدون JSON، بدون markdown، بدون تنسيق)."""

# ==========================================
# 🎨 NEW FUNCTIONS - ADD AT THE END
# ==========================================

def markdown_to_html(text: str) -> str:
    """
    Convert simple markdown formatting to HTML.
    Handles: **bold**, bullet points, numbered lists
    """
    import re

    # Replace **bold** with <strong>bold</strong>
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)

    # Replace bullet points (- text or * text) with HTML list items
    lines = text.split('\n')
    html_lines = []
    in_list = False

    for line in lines:
        stripped = line.strip()

        # Check if it's a bullet point
        if stripped.startswith('- ') or stripped.startswith('* '):
            if not in_list:
                html_lines.append('<ul style="margin: 0.5rem 0; padding-right: 1.5rem;">')
                in_list = True
            content = stripped[2:]  # Remove "- " or "* "
            html_lines.append(f'<li>{content}</li>')

        # Check if it's a numbered list
        elif re.match(r'^\d+\.\s+', stripped):
            content = re.sub(r'^\d+\.\s+', '', stripped)
            html_lines.append(f'<p style="margin: 0.8rem 0;"><strong>{stripped.split(".")[0]}.</strong> {content}</p>')

        # Regular line
        else:
            if in_list:
                html_lines.append('</ul>')
                in_list = False
            if stripped:
                html_lines.append(f'<p style="margin: 0.5rem 0;">{line}</p>')
            else:
                html_lines.append('<br>')

    if in_list:
        html_lines.append('</ul>')

    return '\n'.join(html_lines)


def save_html_wrapper(bucket: str, case_id: str, summary_text: str, timestamp: str):
    """
    Create beautiful HTML wrapper for the text summary.
    Converts markdown formatting to HTML for proper display.
    """

    # Convert markdown to HTML
    html_summary = markdown_to_html(summary_text)
    
    html_content = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ملخص تقرير التحقيق - القضية {case_id}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
            min-height: 100vh;
            direction: rtl;
        }}

        .container {{
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }}

        .header {{
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 2.5rem 2rem;
            text-align: center;
        }}

        .header h1 {{
            font-size: 2rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }}

        .case-badge {{
            background: rgba(255,255,255,0.2);
            padding: 0.6rem 1.5rem;
            border-radius: 25px;
            display: inline-block;
            margin-top: 1rem;
            font-size: 1.1rem;
            font-weight: 500;
            backdrop-filter: blur(10px);
        }}

        .timestamp {{
            margin-top: 1rem;
            font-size: 0.85rem;
            opacity: 0.9;
        }}

        .content {{
            padding: 2.5rem;
            line-height: 1.9;
            color: #2c3e50;
            font-size: 1.05rem;
            text-align: justify;
        }}

        .content strong {{
            color: #1e3c72;
            font-weight: 600;
        }}

        .content ul {{
            list-style-type: disc;
            margin: 0.5rem 0;
            padding-right: 1.5rem;
        }}

        .content li {{
            margin: 0.3rem 0;
        }}

        .footer {{
            background: #f8f9fa;
            padding: 1.5rem;
            text-align: center;
            color: #6c757d;
            font-size: 0.9rem;
            border-top: 1px solid #dee2e6;
        }}

        .print-btn {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 0.8rem 2rem;
            border-radius: 25px;
            text-decoration: none;
            display: inline-block;
            margin-top: 1rem;
            font-weight: 500;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            cursor: pointer;
            border: none;
        }}

        .print-btn:hover {{
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }}

        @media print {{
            body {{
                background: white;
                padding: 0;
            }}
            .container {{
                box-shadow: none;
            }}
            .print-btn {{
                display: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 ملخص تقرير التحقيق الشرطي</h1>
            <div class="case-badge">القضية: {case_id}</div>
            <div class="timestamp">🕒 تم الإنشاء: {format_timestamp(timestamp)}</div>
        </div>

        <div class="content">{html_summary}</div>

        <div class="footer">
            <p>تم إنشاء هذا الملخص تلقائياً بواسطة نظام VISION-RT</p>
            <p style="margin-top: 0.5rem;">النيابة العامة - مملكة البحرين</p>
            <button class="print-btn" onclick="window.print()">
                🖨️ طباعة الملخص
            </button>
        </div>
    </div>
</body>
</html>"""
    
    html_key = f"cases/{case_id}/police-summary.html"
    
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=html_key,
            Body=html_content.encode('utf-8'),
            ContentType='text/html; charset=utf-8',
            Metadata={
                'case-id': case_id,
                'generated-at': timestamp,
                'source': 'text-summary-wrapper'
            }
        )

        print(f"   🎨 HTML wrapper saved to: s3://{bucket}/{html_key}")

    except Exception as e:
        # Don't fail the whole process if HTML save fails
        print(f"   ⚠️  Warning: Failed to save HTML wrapper: {str(e)}")


def format_timestamp(timestamp: str) -> str:
    """Format ISO timestamp to readable Arabic date"""
    try:
        # Parse ISO format: 2024-12-12T15:30:00.123456
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return dt.strftime('%Y/%m/%d - %H:%M')
    except:
        # Fallback if parsing fails
        return timestamp