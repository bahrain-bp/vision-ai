import os
import json
import boto3
import logging
from typing import Dict, List, Any, Optional

# Initialize logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

# Configuration (use environment variables in Lambda)
RESULTS_BUCKET = os.environ.get("RESULTS_BUCKET")


def find_result_json_key(bucket: str, job_id: str) -> Optional[str]:
    """
    Aggressively search for result.json anywhere under camera-footage/output/
    that contains the job_id in its path.

    Handles BDA's nested structure:
    camera-footage/output//75a7d166-.../0/standard_output/0/result.json
    """
    logger.info(f"Searching for result.json in bucket: {bucket}, job_id: {job_id}")

    # Clean up job_id (remove leading/trailing slashes)
    clean_job_id = job_id.strip("/")

    # Search the entire output directory
    prefix = "camera-footage/output/"
    logger.info(f"Searching all objects under: {prefix}")

    paginator = s3.get_paginator("list_objects_v2")

    try:
        found_keys = []
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]

                # Check if this key contains our job_id AND ends with result.json
                if clean_job_id in key and key.endswith("result.json"):
                    logger.info(f"Found result.json at: {key}")
                    found_keys.append(key)

        # Return the first match (there should only be one)
        if found_keys:
            return found_keys[0]

    except Exception as e:
        logger.error(f"Error searching for result.json: {str(e)}")

    # If not found, log debugging info
    logger.warning(f"No result.json found for job_id: {job_id}")
    logger.info(
        f"Searched under prefix '{prefix}' for keys containing '{clean_job_id}' and ending with 'result.json'"
    )

    # Show what's actually in S3 for debugging
    try:
        logger.info(
            "Listing first 20 objects under camera-footage/output/ for debugging:"
        )
        count = 0
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix, MaxKeys=20):
            for obj in page.get("Contents", []):
                count += 1
                logger.info(f"{obj['Key']}")
                if count >= 20:
                    break
            if count >= 20:
                break
    except Exception as e:
        logger.error(f"Failed to list objects for debugging: {str(e)}")

    return None


def load_json_from_s3(bucket: str, key: str) -> Dict[str, Any]:
    logger.info(f"Loading result.json from S3: bucket={bucket}, key={key}")
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        body = resp["Body"].read()
        logger.info(f"Successfully loaded result.json from S3")
        return json.loads(body.decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to load result.json from S3: {str(e)}")
        raise


def transform_bda_output(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform raw BDA JSON into UI-friendly structure.
    - Extracts metadata
    - Converts chapters -> events (timestamp seconds)
    - Extracts OCR lines (camera overlay)
    - Pulls global summary
    """
    logger.info("Transforming BDA output into UI-friendly structure")

    # --- metadata ---
    md = raw.get("metadata", {})
    duration_millis = md.get("duration_millis") or raw.get("video", {}).get(
        "duration_millis"
    )
    metadata = {
        "asset_id": md.get("asset_id"),
        "s3_bucket": md.get("s3_bucket"),
        "s3_key": md.get("s3_key"),
        "format": md.get("format"),
        "frame_rate": md.get("frame_rate"),
        "codec": md.get("codec"),
        "duration_seconds": round((duration_millis or 0) / 1000.0, 3),
        "frame_width": md.get("frame_width"),
        "frame_height": md.get("frame_height"),
    }
    logger.debug(f"Extracted metadata: {metadata}")

    # --- chapters -> events ---
    events: List[Dict[str, Any]] = []
    chapters = raw.get("chapters", [])
    for idx, ch in enumerate(chapters):
        start_ms = ch.get("start_timestamp_millis", ch.get("start_millis", 0))
        end_ms = ch.get("end_timestamp_millis", ch.get("end_millis", 0))
        events.append(
            {
                "id": f"chapter-{idx}",
                "timestamp": round((start_ms or 0) / 1000.0, 3),
                "start_millis": start_ms,
                "end_millis": end_ms,
                "duration_seconds": round(
                    ((end_ms or 0) - (start_ms or 0)) / 1000.0, 3
                ),
                "description": ch.get("summary", "").strip(),
                "type": "chapter",
                "confidence": ch.get("confidence"),
            }
        )

    # If BDA produced "shots" with different boundaries, optionally add them to events
    for s in raw.get("shots", []):
        if s:
            events.append(
                {
                    "id": f"shot-{s.get('shot_index')}",
                    "timestamp": round(
                        (s.get("start_timestamp_millis", 0)) / 1000.0, 3
                    ),
                    "start_millis": s.get("start_timestamp_millis"),
                    "end_millis": s.get("end_timestamp_millis"),
                    "duration_seconds": round(
                        (s.get("duration_millis", 0)) / 1000.0, 3
                    ),
                    "description": None,
                    "type": "shot",
                    "confidence": s.get("confidence"),
                }
            )

    # Sort events by timestamp
    events = sorted(events, key=lambda e: e["timestamp"])
    logger.debug(f"Extracted {len(events)} events")

    # --- OCR extraction per frame (camera overlay)
    ocr: List[Dict[str, Any]] = []
    # In BDA output frames may be nested under chapters -> frames or top-level "frames"
    frames_collections = []

    # gather frames from chapters
    for ch in chapters:
        frames = ch.get("frames", [])
        if frames:
            frames_collections.extend(frames)

    # also check top-level frames if present
    frames_collections.extend(raw.get("frames", []))

    for f in frames_collections:
        ts = f.get("timestamp_millis")
        if ts is None:
            continue
        # extract text lines
        lines = []
        for tw in f.get("text_words", []) + f.get("text_lines", []):
            text = tw.get("text")
            if text and isinstance(text, str):
                lines.append(
                    {
                        "text": text,
                        "confidence": tw.get("confidence"),
                        "bounding_box": (
                            tw.get("locations", [{}])[0].get("bounding_box")
                            if tw.get("locations")
                            else None
                        ),
                    }
                )
        if lines:
            ocr.append(
                {
                    "frame_index": f.get("frame_index"),
                    "timestamp": round(ts / 1000.0, 3),
                    "timecode_smpte": f.get("timecode_smpte"),
                    "lines": lines,
                }
            )
    logger.debug(f"Extracted {len(ocr)} OCR entries")

    # --- global video summary ---
    global_summary = raw.get("video", {}).get("summary") or (
        chapters[0].get("summary") if chapters else ""
    )
    logger.info("Transformation complete")

    # --- build result ---
    parsed = {
        "metadata": metadata,
        "events": events,
        "summary": (global_summary or "").strip(),
        "ocr": ocr,
        # keep raw path for debug
        "_raw_contains": {
            "has_chapters": len(chapters) > 0,
            "shot_count": raw.get("statistics", {}).get("shot_count"),
        },
    }
    return parsed


# Lambda handler
def lambda_handler(event, context):
    logger.info("Lambda handler invoked")

    # CORS headers for all responses
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Content-Type": "application/json",
    }
    params = event.get("queryStringParameters") or {}
    job_id = params.get("jobId") or params.get("sessionId")

    if not job_id:
        logger.error("Missing jobId query parameter")
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": "Missing jobId query parameter"}),
        }

    # Step 1: find result.json
    logger.info(f"Fetching results for job_id: {job_id}")
    key = find_result_json_key(RESULTS_BUCKET, job_id)

    if not key:
        logger.error(f"result.json not found for job_id: {job_id}")
        return {
            "statusCode": 404,
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "error": "result.json not found for job",
                    "jobId": job_id,
                    "message": "Results are not ready yet. Please try again in a few moments.",
                }
            ),
        }

    # Step 2: load raw json
    try:
        raw = load_json_from_s3(RESULTS_BUCKET, key)
    except Exception as e:
        logger.error(f"Failed to load result.json: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps(
                {"error": "failed to load result.json", "message": str(e)}
            ),
        }

    # Step 3: transform
    logger.info(f"Transforming results for job_id: {job_id}")
    parsed = transform_bda_output(raw)

    logger.info(f"Successfully parsed results for job_id: {job_id}")
    return {"statusCode": 200, "headers": cors_headers, "body": json.dumps(parsed)}


# -------------------------------------------
# Local test helper (reads the uploaded file)
# -------------------------------------------
if __name__ == "__main__":
    # Local dev: use the file you uploaded
    local_path = "/mnt/data/result (1).json"
    print("Local test loading:", local_path)
    with open(local_path, "r", encoding="utf-8") as fh:
        raw = json.load(fh)
    parsed = transform_bda_output(raw)
    print(json.dumps(parsed, indent=2)[:2000])
