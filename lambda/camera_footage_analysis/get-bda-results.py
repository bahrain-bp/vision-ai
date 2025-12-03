import os
import json
import boto3
import logging
from typing import Dict, List, Any, Optional

# Initialize logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
translate = boto3.client("translate")


def translate_text(text: str, target_language: str = "ar") -> str:
    """
    Translate text to the target language using Amazon Translate.
    """
    # Handle None or empty strings
    if not text or not isinstance(text, str) or not text.strip():
        return text if text else ""
    try:
        response = translate.translate_text(
            Text=text,
            SourceLanguageCode="en",  # English is the source language
            TargetLanguageCode=target_language,  # Arabic is the target language
        )
        return response["TranslatedText"]
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return text  # Fallback to the original text if translation fails


# Configuration
RESULTS_BUCKET = os.environ.get("RESULTS_BUCKET")

if not RESULTS_BUCKET:
    logger.error("RESULTS_BUCKET environment variable not set")


def extract_video_folder_from_s3key(s3_key: str) -> str:
    """
    Extract video folder name from the uploaded video S3 key.

    Example:
        s3_key: "camera-footage/videos/footage_20251125-104623_925b19fa818e.mp4"
        returns: "footage_20251125-104623_925b19fa818e"
    """
    filename = os.path.basename(s3_key)  # "footage_20251125-104623_925b19fa818e.mp4"
    video_folder = os.path.splitext(filename)[0]  # Remove .mp4 extension
    logger.info(f"Extracted video folder: {video_folder} from s3_key: {s3_key}")
    return video_folder


def find_all_segment_results(bucket: str, video_folder: str) -> List[Dict[str, Any]]:
    """
    Find ALL segment result.json files for a video by searching its output folder.

    S3 Structure:
    camera-footage/output/{video_folder}/
        segment-1/{job_id}/0/standard_output/0/result.json
        segment-1/{job_id}/0/custom_output/0/result.json
        segment-2/{job_id}/0/standard_output/0/result.json
        segment-2/{job_id}/0/custom_output/0/result.json
        ...

    Args:
        bucket: S3 bucket name
        video_folder: Video folder name (e.g., "footage_20251125-104623_925b19fa818e")

    Returns:
        List of dicts with segment info: [
            {
                "segmentIndex": 1,
                "standardKey": "camera-footage/output/.../standard_output/0/result.json",
                "customKey": "camera-footage/output/.../custom_output/0/result.json"
            },
            ...
        ]
    """
    logger.info(f"Searching for segment results in video folder: {video_folder}")

    # Search within this specific video's output folder
    prefix = f"camera-footage/output/{video_folder}/"
    logger.info(f"Searching S3 with prefix: {prefix}")

    segment_results = {}  # {segment_index: {'standard': key, 'custom': key}}

    paginator = s3.get_paginator("list_objects_v2")

    try:
        # Use explicit pagination config
        page_iterator = paginator.paginate(
            Bucket=bucket,
            Prefix=prefix,
            PaginationConfig={
                "PageSize": 100
            },  # Smaller page size to ensure we get everything
        )

        total_objects_found = 0
        result_json_count = 0
        segments_found_list = []

        for page_num, page in enumerate(page_iterator):
            if "Contents" not in page:
                logger.warning(f"Page {page_num} has no Contents")
                continue

            page_objects = page.get("Contents", [])
            total_objects_found += len(page_objects)
            logger.info(
                f"Page {page_num}: Processing {len(page_objects)} objects (total so far: {total_objects_found})"
            )

            for obj in page_objects:
                key = obj["Key"]

                # Check if this key contains result.json
                if key.endswith("result.json"):
                    result_json_count += 1

                    # Extract segment index from path: .../segment-X/...
                    try:
                        if "/segment-" in key:
                            # Handle double slash
                            segment_part = key.split("/segment-")[1]
                            segment_part = segment_part.lstrip("/")
                            segment_idx = int(segment_part.split("/")[0])

                            if segment_idx not in segment_results:
                                segment_results[segment_idx] = {}
                                if segment_idx not in segments_found_list:
                                    segments_found_list.append(segment_idx)

                            # Determine if this is standard or custom output
                            if "/standard_output/" in key:
                                segment_results[segment_idx]["standard"] = key
                                logger.info(
                                    f"✓ Segment {segment_idx} STANDARD: ...{key[-60:]}"
                                )
                            elif "/custom_output/" in key:
                                segment_results[segment_idx]["custom"] = key
                                logger.info(
                                    f"✓ Segment {segment_idx} CUSTOM: ...{key[-60:]}"
                                )
                        else:
                            logger.warning(f"No '/segment-' in key: {key}")

                    except (IndexError, ValueError) as e:
                        logger.warning(f"Parse error for key: {key}, error: {e}")
                        continue

    except Exception as e:
        logger.error(f"Error searching for segment results: {str(e)}", exc_info=True)
        raise

    # Log summary
    logger.info(f"=== SEARCH SUMMARY ===")
    logger.info(f"Total objects scanned: {total_objects_found}")
    logger.info(f"Total result.json files found: {result_json_count}")
    logger.info(f"Unique segments found: {sorted(segments_found_list)}")

    for seg_idx in sorted(segment_results.keys()):
        has_standard = "standard" in segment_results[seg_idx]
        has_custom = "custom" in segment_results[seg_idx]
        logger.info(
            f"  Segment {seg_idx}: standard={has_standard}, custom={has_custom}"
        )

    # Convert to list of dicts, sorted by segment index
    results = []
    for idx in sorted(segment_results.keys()):
        standard = segment_results[idx].get("standard")
        custom = segment_results[idx].get("custom")

        if standard or custom:  # At least one output exists
            results.append(
                {"segmentIndex": idx, "standardKey": standard, "customKey": custom}
            )

    logger.info(f"Returning {len(results)} segment(s) with results")

    return results


def load_json_from_s3(bucket: str, key: str) -> Dict[str, Any]:
    """Load and parse JSON from S3."""
    logger.info(f"Loading JSON from s3://{bucket}/{key}")
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        body = resp["Body"].read()
        data = json.loads(body.decode("utf-8"))
        logger.info(f"Successfully loaded JSON ({len(body)} bytes)")
        return data
    except Exception as e:
        logger.error(f"Failed to load JSON from S3: {str(e)}")
        raise


def merge_bda_outputs(
    standard_data: Optional[Dict], custom_data: Optional[Dict], segment_idx: int = 1
) -> Dict[str, Any]:
    """
    Merge standard_output and custom_output into a unified structure.
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
        summary_text = standard_data.get("video", {}).get("summary", "").strip()
        if summary_text:
            result["summary"] = {
                "en": summary_text,
                "ar": translate_text(summary_text, "ar"),
            }

        logger.info(f"Extracted video summary: {result['summary']}...")

        # Extract chapters from STANDARD OUTPUT (timestamps) and CUSTOM OUTPUT (summaries)
        chapters = standard_data.get("chapters", [])
        custom_chapters = custom_data.get("chapters", []) if custom_data else []
        logger.info(f"Found {len(chapters)} chapters in standard_output")

        for idx, ch in enumerate(chapters):
            # Use absolute timestamps from standard output
            start_millis = ch.get("start_timestamp_millis", 0)
            end_millis = ch.get("end_timestamp_millis", 0)

            chapter_start = start_millis / 1000.0
            chapter_end = end_millis / 1000.0

            # Get summary from custom output if available, otherwise from standard
            custom_ch = custom_chapters[idx] if idx < len(custom_chapters) else {}
            custom_summary = custom_ch.get("inference_result", {}).get(
                "chapter_summary", ""
            )
            chapter_summary = (
                custom_summary if custom_summary else ch.get("summary", "").strip()
            )

            chapter_data = {
                "id": f"chapter-{idx}",
                "segmentIndex": segment_idx,
                "displayIndex": 0,
                "timestamp": chapter_start,
                "start_seconds": chapter_start,
                "end_seconds": chapter_end,
                "duration_seconds": chapter_end - chapter_start,
                "summary": chapter_summary,
                "confidence": ch.get("confidence", 0),
                "type": "chapter",
                "translations": {
                    "en": chapter_summary,
                    "ar": translate_text(chapter_summary, "ar"),
                },
            }

            result["chapters"].append(chapter_data)

    # --- Extract from CUSTOM OUTPUT (for enrichment) ---
    if custom_data:
        logger.info("Processing custom_output data for enrichment")

        custom_chapters = custom_data.get("chapters", [])

        # Map custom data to standard chapters by index
        for idx, custom_ch in enumerate(custom_chapters):
            if idx < len(result["chapters"]):
                inference = custom_ch.get("inference_result", {})

                # Add risk and confidence from custom output
                result["chapters"][idx]["risk_score"] = inference.get(
                    "chapter_risk_score"
                )
                result["chapters"][idx]["confidence"] = inference.get(
                    "chapter_confidence"
                )

                # Add event information
                event = inference.get("event", {})
                if event:
                    result["chapters"][idx]["event"] = {
                        "id": event.get("event_id"),
                        "description": event.get("event_description", "").strip(),
                        "type": event.get("event_type"),
                        "confidence": event.get("event_confidence"),
                        "translations": {
                            "en": {
                                "description": event.get(
                                    "event_description", ""
                                ).strip(),
                                "type": event.get("event_type"),
                                "confidence": f"Confidence: {event.get('event_confidence')}%",
                            },
                            "ar": {
                                "description": translate_text(
                                    event.get("event_description", "").strip() or "",
                                    "ar",
                                ),
                                "type": translate_text(
                                    event.get("event_type") or "", "ar"
                                ),
                                "confidence": f"الثقة: {event.get('event_confidence')}%",
                            },
                        },
                    }

                # Add person information
                person = inference.get("person", {})
                if person:
                    result["chapters"][idx]["person"] = {
                        "id": person.get("person_id"),
                        "description": person.get("person_description", "").strip(),
                        "confidence": person.get("person_confidence"),
                        "translations": {
                            "en": {
                                "description": person.get(
                                    "person_description", ""
                                ).strip(),
                                "confidence": f"Confidence: {person.get('person_confidence')}%",
                            },
                            "ar": {
                                "description": translate_text(
                                    person.get("person_description", "").strip() or "",
                                    "ar",
                                ),
                                "confidence": f"الثقة: {person.get('person_confidence')}%",
                            },
                        },
                    }

                # Add object information
                obj = inference.get("object", {})
                if obj:
                    result["chapters"][idx]["object"] = {
                        "id": obj.get("object_id"),
                        "description": obj.get("object_description", "").strip(),
                        "is_abandoned": obj.get("is_abandoned"),
                        "suspicious": obj.get("suspicious"),
                        "confidence": obj.get("object_confidence"),
                        "translations": {
                            "en": {
                                "description": obj.get(
                                    "object_description", ""
                                ).strip(),
                                "confidence": f"Confidence: {obj.get('object_confidence')}%",
                            },
                            "ar": {
                                "description": translate_text(
                                    obj.get("object_description", "").strip() or "",
                                    "ar",
                                ),
                                "confidence": f"الثقة: {obj.get('object_confidence')}%",
                            },
                        },
                    }

    # Create events list from chapters
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

    logger.info("Merge complete")
    return result


def merge_all_segments(segment_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Load and merge ALL segment results into unified structure.
    Treat each segment as a separate "chapter" for UI display.
    """
    all_chapters = []
    all_events = []
    metadata = {}
    summary_parts = []
    global_chapter_counter = 1

    for segment_info in segment_results:
        seg_idx = segment_info["segmentIndex"]
        standard_key = segment_info.get("standardKey")
        custom_key = segment_info.get("customKey")

        logger.info(f"Processing segment {seg_idx}")

        standard_data = None
        custom_data = None

        # Load standard output
        if standard_key:
            try:
                standard_data = load_json_from_s3(RESULTS_BUCKET, standard_key)
            except Exception as e:
                logger.error(
                    f"Failed to load standard output for segment {seg_idx}: {e}"
                )

        # Load custom output
        if custom_key:
            try:
                custom_data = load_json_from_s3(RESULTS_BUCKET, custom_key)
            except Exception as e:
                logger.error(f"Failed to load custom output for segment {seg_idx}: {e}")

        # Merge segment
        if standard_data or custom_data:
            segment_result = merge_bda_outputs(
                standard_data, custom_data, segment_idx=seg_idx
            )

            # Accumulate chapters and events
            for chapter in segment_result.get("chapters", []):
                chapter["id"] = f"chapter-{global_chapter_counter}"
                chapter["displayIndex"] = global_chapter_counter
                all_chapters.append(chapter)
                global_chapter_counter += 1

            all_events.extend(segment_result.get("events", []))

            # Collect summary parts
            if segment_result.get("summary"):
                summary_text = segment_result["summary"]
                if isinstance(summary_text, dict):
                    summary_text = summary_text.get("en", "")
                if len(segment_results) > 1:
                    summary_parts.append(f"Segment {seg_idx}: {summary_text}")
                else:
                    summary_parts.append(summary_text)

            # Use metadata from first segment
            if not metadata and segment_result.get("metadata"):
                metadata = segment_result["metadata"]

    # Sort by timestamp
    all_chapters = sorted(all_chapters, key=lambda c: c["start_seconds"])
    all_events = sorted(all_events, key=lambda e: e["timestamp"])

    # Combine summaries
    combined_summary = (
        "\n\n".join(summary_parts) if summary_parts else "Video analysis complete"
    )

    translated_summary = {
        "en": combined_summary,
        "ar": translate_text(combined_summary, "ar"),
    }

    logger.info(
        f"Aggregated {len(all_chapters)} chapters from {len(segment_results)} segment(s)"
    )

    return {
        "summary": translated_summary,
        "chapters": all_chapters,
        "events": all_events,
        "metadata": metadata,
        "totalSegments": len(segment_results),
    }


def lambda_handler(event, context):
    """
    Lambda handler to fetch and merge BDA results.

    requires:
    - s3Key: The original video S3 key (to derive video folder name)
    - expectedSegments: Number of segments expected (for multi-segment videos)
    """
    logger.info("=== get-bda-results Lambda invoked ===")

    # CORS headers
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
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

    # Get parameters from query string OR body (support both GET and POST)
    params = event.get("queryStringParameters") or {}
    s3_key = params.get("s3Key")
    expected_segments = int(params.get("expectedSegments", 1))

    # check body for POST requests
    if not s3_key and event.get("body"):
        try:
            body = json.loads(event.get("body", "{}"))
            s3_key = body.get("s3Key")
            expected_segments = int(body.get("expectedSegments", 1))
        except json.JSONDecodeError:
            pass

    if not s3_key:
        logger.error("Missing s3Key query parameter")
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "error": "Missing s3Key query parameter. Example: ?s3Key=camera-footage/videos/footage_20251125-104623_925b19fa818e.mp4"
                }
            ),
        }

    logger.info(f"s3Key: {s3_key}, expectedSegments: {expected_segments}")

    # Extract video folder name from s3Key
    try:
        video_folder = extract_video_folder_from_s3key(s3_key)
    except Exception as e:
        logger.error(f"Failed to extract video folder from s3Key: {e}")
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Invalid s3Key format: {str(e)}"}),
        }

    # Find all segment results for this video
    logger.info(f"Fetching results for video folder: {video_folder}")

    try:
        segment_results = find_all_segment_results(RESULTS_BUCKET, video_folder)
    except Exception as e:
        logger.error(f"Error finding segment results: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Failed to search for results: {str(e)}"}),
        }

    segments_found = len(segment_results)

    # Check if no segments found yet
    if not segment_results:
        logger.warning(f"No results found yet for video folder: {video_folder}")
        return {
            "statusCode": 202,  # 202 = Still processing
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "status": "processing",
                    "message": "Analysis still in progress. No segments completed yet.",
                    "segmentsCompleted": 0,
                    "segmentsExpected": expected_segments,
                }
            ),
        }

    # Check if all segments are complete
    if segments_found < expected_segments:
        logger.info(
            f"Only {segments_found}/{expected_segments} segments complete. Waiting for more..."
        )
        return {
            "statusCode": 202,  # 202 = Still processing
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "status": "processing",
                    "message": f"Analysis in progress. {segments_found}/{expected_segments} segments completed.",
                    "segmentsCompleted": segments_found,
                    "segmentsExpected": expected_segments,
                }
            ),
        }

    # All segments complete - merge and return
    logger.info(f"All {segments_found} segments complete. Merging results...")

    # Merge all segments
    try:
        merged_result = merge_all_segments(segment_results)
        logger.info(
            f"Successfully merged {len(segment_results)} segment(s) for video: {video_folder}"
        )

        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps(
                {
                    "status": "complete",
                    "results": merged_result,
                    "segmentsCompleted": segments_found,
                    "segmentsExpected": expected_segments,
                }
            ),
        }

    except Exception as e:
        logger.error(f"Failed to merge segment results: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps(
                {"error": "Failed to process results", "message": str(e)}
            ),
        }
