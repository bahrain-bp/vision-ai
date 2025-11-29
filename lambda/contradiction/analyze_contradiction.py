import boto3
import json
import os
from datetime import datetime

s3 = boto3.client("s3")
bedrock = boto3.client("bedrock-runtime")

BUCKET = os.environ["BUCKET_NAME"]
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

def handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        case_id = body.get("caseId")
        witness_id = body.get("witnessId")
        if not case_id or not witness_id:
            return error(400, "caseId and witnessId are required")

        transcript_key = f"DetectContradiction/cases/{case_id}/interviews/{witness_id}.txt"
        transcript = load_s3_text(transcript_key)
        if transcript is None:
            return error(404, f"Transcript not found: {transcript_key}")

        # Other witnesses
        prefix_interviews = f"DetectContradiction/cases/{case_id}/interviews/"
        cross_transcripts = {}
        for key in list_all_keys(BUCKET, prefix_interviews):
            if key.endswith(".txt") and witness_id not in key:
                other_id = key.split("/")[-1].replace(".txt", "")
                txt = load_s3_text(key)
                if txt:
                    cross_transcripts[other_id] = txt

        # Reports (content)
        reports = list_reports(case_id)

        prompt = build_prompt(case_id, transcript, cross_transcripts, reports)

        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 2000, "temperature": 0.2}
            }),
            accept="application/json",
            contentType="application/json"
        )

        raw = response["body"].read()
        result = json.loads(raw)

        text_output = None
        try:
            text_output = result["output"]["message"]["content"][0]["text"]
        except (KeyError, IndexError, TypeError):
            pass
        if not text_output:
            text_output = result.get("outputText")
        if not text_output and isinstance(result.get("results"), list) and result["results"]:
            text_output = result["results"][0].get("outputText")
        if not text_output or not isinstance(text_output, str):
            raise ValueError("Bedrock response missing expected text output")

        contradictions = extract_json(text_output)

        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        output_key = f"DetectContradiction/cases/{case_id}/contradiction/{witness_id}/{timestamp}.json"
        output_obj = {
            "caseId": case_id,
            "witnessId": witness_id,
            "results": contradictions,
            "storedAt": output_key,
            "generatedAt": timestamp
        }

        s3.put_object(
            Bucket=BUCKET,
            Key=output_key,
            Body=json.dumps(output_obj, indent=2),
            ContentType="application/json"
        )

        return ok(output_obj)

    except Exception as e:
        print("ERROR:", repr(e))
        return error(500, "An internal error occurred.")

def list_all_keys(bucket, prefix):
    paginator = s3.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys

def load_s3_text(key):
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        return obj["Body"].read().decode("utf-8")
    except Exception:
        return None

def list_reports(case_id):
    prefix = f"DetectContradiction/cases/{case_id}/reports/"
    keys = list_all_keys(BUCKET, prefix)
    reports = []
    for key in keys:
        if key.endswith(".txt"):
            txt = load_s3_text(key)
            if txt:
                reports.append({"key": key, "text": txt[:5000]})
    return reports

def build_prompt(case_id, transcript, cross_transcripts, reports):
    def clip(s, n=8000):
        return s[:n]
    cross_text = "\n---\n".join([f"[{wid}] {clip(txt, 4000)}" for wid, txt in cross_transcripts.items()])
    report_text = "\n---\n".join([f"[{r['key']}] {clip(r['text'], 4000)}" for r in reports])

    return f"""
أنت نظام ذكاء اصطناعي متخصص في كشف التناقضات في التحقيقات.

المهمة:
- اكتشف التناقضات الداخلية داخل شهادة الشاهد نفسه.
- اكتشف التناقضات مع شهادات الشهود الآخرين.
- تحقق من التناقضات أو الدعم مع تقارير الشرطة والأدلة.
- لا تكرر نفس التناقض أكثر من مرة. إذا ظهر نفس التناقض مع عدة مصادر، اجمعها في عنصر واحد مع ذكر جميع المصادر في الحقل "source".

المخرجات:
- يجب أن تكون النتيجة مصفوفة JSON فقط، بدون أي تعليق إضافي أو نص خارج المصفوفة.
- يجب أن تكون جميع النصوص باللغة العربية الفصحى الواضحة.
- يجب ترتيب النتائج حسب اللون (الخطورة): الأحمر أولاً، ثم الأصفر، ثم الأخضر.
- يجب أن تكون صياغة الحقل "text" جملة كاملة تصف التناقض بشكل واضح، وليس مجرد مقتطف قصير.
- لا تكرر التناقضات؛ اجمعها في عنصر واحد مع قائمة المصادر.

المخطط (Schema):
[
  {{
    "text": "النص المقتبس أو الملخص",
    "source": "witness|cross|report (يمكن أن تكون قائمة مثل witness+report)",
    "evidence": "تفسير قصير يشير إلى السطر أو التقرير",
    "severity": "red|yellow|green"
  }}
]

التعريفات:
- الأحمر (red): تناقض مباشر مع شاهد آخر أو تقرير رسمي.
- الأصفر (yellow): غامض أو يحتمل التناقض ويحتاج مراجعة.
- الأخضر (green): متسق أو مدعوم من مصادر أخرى.

نص الشاهد:
{clip(transcript, 12000)}

شهادات أخرى:
{cross_text}

تقارير الشرطة:
{report_text}

أعد فقط مصفوفة JSON حسب المخطط أعلاه. إذا لم توجد نتائج، أعد [].
"""

def extract_json(text):
    if not text:
        return []
    if text.strip().startswith("```"):
        text = text.strip().strip("`")
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end <= start:
        return []
    try:
        data = json.loads(text[start:end])
        normalized = []
        seen = set()
        for item in data:
            if isinstance(item, dict):
                key = (item.get("text", ""), item.get("severity", "").lower())
                if key not in seen:
                    normalized.append({
                        "text": item.get("text", ""),
                        "source": item.get("source", "witness"),
                        "evidence": item.get("evidence", ""),
                        "severity": item.get("severity", "").lower(),
                    })
                    seen.add(key)
        # enforce ordering: red → yellow → green
        order = {"red": 0, "yellow": 1, "green": 2}
        normalized.sort(key=lambda x: order.get(x["severity"], 3))
        return normalized
    except Exception:
        return []


def ok(body):
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        },
        "body": json.dumps(body)
    }

def error(code, msg):
    return {
        "statusCode": code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        },
        "body": json.dumps({"error": msg})
    }
