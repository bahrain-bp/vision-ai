import os
import json
import boto3
import logging
from typing import Dict, List, Any, Optional, Tuple

# Initialize logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

# Configuration
RESULTS_BUCKET = os.environ.get("RESULTS_BUCKET")

if not RESULTS_BUCKET:
    logger.error("RESULTS_BUCKET environment variable not set")


def find_result_json_keys(
    bucket: str, job_id: str
) -> Tuple[Optional[str], Optional[str]]:
    """
    Find both standard_output and custom_output result.json files for a job.

    Returns:
        Tuple of (standard_output_key, custom_output_key)
    """
    logger.info(
        f"Searching for result.json files in bucket: {bucket}, job_id: {job_id}"
    )

    clean_job_id = job_id.strip("/")
    prefix = "camera-footage/output/"

    standard_key = None
    custom_key = None

    paginator = s3.get_paginator("list_objects_v2")

    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]

                # Check if this key contains our job_id AND ends with result.json
                if clean_job_id in key and key.endswith("result.json"):
                    if "standard_output" in key:
                        standard_key = key
                        logger.info(f"Found standard_output result.json at: {key}")
                    elif "custom_output" in key:
                        custom_key = key
                        logger.info(f"Found custom_output result.json at: {key}")

                # Break if we found both
                if standard_key and custom_key:
                    break

            if standard_key and custom_key:
                break

    except Exception as e:
        logger.error(f"Error searching for result.json files: {str(e)}")

    if not standard_key and not custom_key:
        logger.warning(f"No result.json files found for job_id: {job_id}")
        # Log debugging info
        try:
            logger.info("Listing first 20 objects for debugging:")
            count = 0
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix, MaxKeys=20):
                for obj in page.get("Contents", []):
                    count += 1
                    logger.info(f"  {obj['Key']}")
                    if count >= 20:
                        break
                if count >= 20:
                    break
        except Exception as e:
            logger.error(f"Failed to list objects for debugging: {str(e)}")

    return standard_key, custom_key


def load_json_from_s3(bucket: str, key: str) -> Dict[str, Any]:
    """Load and parse JSON from S3."""
    logger.info(f"Loading JSON from S3: s3://{bucket}/{key}")
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        body = resp["Body"].read()
        data = json.loads(body.decode("utf-8"))
        logger.info(f"Successfully loaded JSON from S3")
        return data
    except Exception as e:
        logger.error(f"Failed to load JSON from S3: {str(e)}")
        raise


def merge_bda_outputs(
    standard_data: Optional[Dict], custom_data: Optional[Dict]
) -> Dict[str, Any]:
    """
    Merge standard_output and custom_output into a unified structure.

    From standard_output:
    - video.summary (global video summary)
    - metadata (duration, format, etc.)

    From custom_output:
    - chapters[].inference_result containing:
      - chapter_summary
      - event (event_description, event_type, etc.)
      - person (person_description, person_confidence, etc.)
      - object (object_description, suspicious, etc.)
    """
    logger.info("Merging standard and custom BDA outputs")

    # Initialize result structure
    result = {"metadata": {}, "summary": "", "events": [], "chapters": []}

    # --- Extract from STANDARD OUTPUT ---
    if standard_data:
        logger.info("Processing standard_output data")

        # Metadata
        md = standard_data.get("metadata", {})
        duration_millis = md.get("duration_millis") or standard_data.get(
            "video", {}
        ).get("duration_millis")
        result["metadata"] = {
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

        # Global video summary
        result["summary"] = standard_data.get("video", {}).get("summary", "").strip()
        logger.info(f"Extracted video summary: {result['summary'][:100]}...")

    # --- Extract from CUSTOM OUTPUT ---
    if custom_data:
        logger.info("Processing custom_output data")

        chapters = custom_data.get("chapters", [])
        logger.info(f"Found {len(chapters)} chapters in custom_output")

        for idx, ch in enumerate(chapters):
            inference = ch.get("inference_result", {})

            # Extract chapter timing
            chapter_start = inference.get("chapter_start", 0)
            chapter_end = inference.get("chapter_end", 0)

            chapter_data = {
                "id": f"chapter-{idx}",
                "timestamp": chapter_start,
                "start_seconds": chapter_start,
                "end_seconds": chapter_end,
                "duration_seconds": chapter_end - chapter_start,
                "summary": inference.get("chapter_summary", "").strip(),
                "risk_score": inference.get("chapter_risk_score"),
                "confidence": inference.get("chapter_confidence"),
                "type": "chapter",
            }

            # Extract event information
            event = inference.get("event", {})
            if event:
                chapter_data["event"] = {
                    "id": event.get("event_id"),
                    "timestamp": event.get("event_timestamp"),
                    "start_millis": event.get("event_start_millis"),
                    "end_millis": event.get("event_end_millis"),
                    "description": event.get("event_description", "").strip(),
                    "type": event.get("event_type"),
                    "confidence": event.get("event_confidence"),
                }
                logger.debug(f"Chapter {idx} event: {event.get('event_type')}")

            # Extract person information
            person = inference.get("person", {})
            if person:
                chapter_data["person"] = {
                    "id": person.get("person_id"),
                    "first_seen": person.get("first_seen"),
                    "last_seen": person.get("last_seen"),
                    "description": person.get("person_description", "").strip(),
                    "confidence": person.get("person_confidence"),
                }
                logger.debug(f"Chapter {idx} person detected")

            # Extract object information
            obj = inference.get("object", {})
            if obj:
                chapter_data["object"] = {
                    "id": obj.get("object_id"),
                    "description": obj.get("object_description", "").strip(),
                    "first_seen": obj.get("first_seen"),
                    "last_seen": obj.get("last_seen"),
                    "x": obj.get("x"),
                    "y": obj.get("y"),
                    "width": obj.get("width"),
                    "height": obj.get("height"),
                    "is_abandoned": obj.get("is_abandoned"),
                    "suspicious": obj.get("suspicious"),
                    "risk_relevance": obj.get("risk_relevance", "").strip(),
                    "confidence": obj.get("object_confidence"),
                }
                logger.debug(
                    f"Chapter {idx} object: suspicious={obj.get('suspicious')}"
                )

            result["chapters"].append(chapter_data)

        # Also create events list from chapters for timeline view
        for ch_data in result["chapters"]:
            result["events"].append(
                {
                    "id": ch_data["id"],
                    "timestamp": ch_data["start_seconds"],
                    "start_millis": ch_data["start_seconds"] * 1000,
                    "end_millis": ch_data["end_seconds"] * 1000,
                    "duration_seconds": ch_data["duration_seconds"],
                    "description": ch_data["summary"],
                    "type": ch_data["type"],
                    "confidence": ch_data.get("confidence"),
                    "risk_score": ch_data.get("risk_score"),
                }
            )

        logger.info(f"Extracted {len(result['chapters'])} chapters with inference data")

    # Sort events by timestamp
    result["events"] = sorted(result["events"], key=lambda e: e["timestamp"])

    logger.info("Merge complete")
    return result


def lambda_handler(event, context):
    """
    Lambda handler to fetch and merge BDA standard and custom outputs.
    """
    logger.info("Lambda handler invoked")

    # CORS headers
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Content-Type": "application/json",
    }

    # Check bucket is configured
    if not RESULTS_BUCKET:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps(
                {"error": "RESULTS_BUCKET environment variable not configured"}
            ),
        }

    # Handle OPTIONS request for CORS
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    # Get jobId from query parameters
    params = event.get("queryStringParameters") or {}
    job_id = params.get("jobId") or params.get("sessionId")

    if not job_id:
        logger.error("Missing jobId query parameter")
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": "Missing jobId query parameter"}),
        }

    # Step 1: Find both result.json files
    logger.info(f"Fetching results for job_id: {job_id}")
    standard_key, custom_key = find_result_json_keys(RESULTS_BUCKET, job_id)

    if not standard_key and not custom_key:
        logger.error(f"No result.json files found for job_id: {job_id}")
        return {
            "statusCode": 404,
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "error": "Results not found for job",
                    "jobId": job_id,
                    "message": "Results are not ready yet. Please try again in a few moments.",
                }
            ),
        }

    # Step 2: Load JSON files
    standard_data = None
    custom_data = None

    try:
        if standard_key:
            standard_data = load_json_from_s3(RESULTS_BUCKET, standard_key)
            logger.info("Loaded standard_output successfully")
        else:
            logger.warning("standard_output not found")

        if custom_key:
            custom_data = load_json_from_s3(RESULTS_BUCKET, custom_key)
            logger.info("Loaded custom_output successfully")
        else:
            logger.warning("custom_output not found")

    except Exception as e:
        logger.error(f"Failed to load result files: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps(
                {"error": "Failed to load result files", "message": str(e)}
            ),
        }

    # Step 3: Merge the outputs
    try:
        merged_result = merge_bda_outputs(standard_data, custom_data)
        logger.info(f"Successfully merged results for job_id: {job_id}")

        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps(merged_result),
        }

    except Exception as e:
        logger.error(f"Failed to merge results: {str(e)}")
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps(
                {"error": "Failed to process results", "message": str(e)}
            ),
        }
