import json
import logging
import os
import boto3
import re
import uuid
from math import ceil

logger = logging.getLogger()
logger.setLevel(logging.INFO)


BEDROCK_PROJECT_ARN = os.environ.get("BEDROCK_PROJECT_ARN")
BEDROCK_PROFILE_ARN = os.environ.get("BEDROCK_PROFILE_ARN")
MIN_SEGMENT_DURATION = 300


# sessionID validation helper function
def is_valid_session_id(session_id):
    """
    Valid sessionId example: session-20251119134654-450ca997
    Format: session-YYYYMMDDHHMMSS-XXXXXXXX
    """
    pattern = r"^session-\d{14}-[a-fA-F0-9]{8}$"
    return bool(re.match(pattern, session_id))


def handler(event, context):
    """
    Trigger Bedrock Data Automation job for video analysis.

    Expected POST body:
    {
        "sessionId": " session-20251119134654-450ca997",
        "s3Key": "camera-footage/videos/footage_20231115-123456_abcdef123456.mp4",
        "segmentLengthSeconds": 300, # default 300 seconds
        "videoDurationSeconds": 123.45
    }
    """
    try:
        logger.info("=== Starting segmented video analysis job ===")

        # Log environment variables (for debugging)
        logger.info(f"Environment - BEDROCK_PROJECT_ARN: {BEDROCK_PROJECT_ARN}")
        logger.info(f"Environment - BEDROCK_PROFILE_ARN: {BEDROCK_PROFILE_ARN}")
        logger.info(f"Environment - BUCKET_NAME: {os.environ.get('BUCKET_NAME')}")

        # parse request body
        body = json.loads(event.get("body", "{}"))
        session_id = body.get("sessionId")
        s3_key = body.get("s3Key")
        video_duration_sec = body.get("videoDurationSeconds")
        segment_length_secs = int(body.get("segmentLengthSeconds", 300))
        input_bucket = os.environ.get("BUCKET_NAME")  # Use env var if not in body
        max_segments = int(os.environ.get("MAX_SEGMENTS", 20))

        # validate segment length meets AWS minimum
        if segment_length_secs < MIN_SEGMENT_DURATION:
            logger.warning(
                f"Segment length {segment_length_secs}s is below AWS minimum {MIN_SEGMENT_DURATION}s. "
                f"Using {MIN_SEGMENT_DURATION}s."
            )
            segment_length_secs = MIN_SEGMENT_DURATION

        logger.info(
            f"Parameters - sessionId: {session_id}, s3Key: {s3_key}, input bucket {input_bucket}, "
            f"segmentLengthSeconds: {segment_length_secs}, videoDurationSeconds: {video_duration_sec}"
        )

        # validate field inputs
        if not session_id or not s3_key:
            return error_response(400, "sessionId and S3 key are required")

        if not input_bucket:
            return error_response(500, "BUCKET_NAME not configured")

        # Validate Bedrock ARNs are set
        if not BEDROCK_PROJECT_ARN or not BEDROCK_PROFILE_ARN:
            logger.error("Missing Bedrock ARN configuration")
            return error_response(500, "Bedrock configuration missing")

        # validate sessionId format
        if not is_valid_session_id(session_id):
            return error_response(
                400,
                f"Invalid sessionId format {session_id} (expected  session-YYYYMMDDHHMMSS-XXXXXXXX)",
            )

        # compute segments with smart segmentation logic
        if video_duration_sec is None:
            logger.warning(
                "videoDurationSeconds not provided — limiting to max segments"
            )
            num_segments = max_segments
        else:
            try:
                video_duration_sec = float(video_duration_sec)
            except Exception:
                return error_response(400, "videoDurationSeconds must be a number")

            # Check if video should be segmented
            if video_duration_sec < MIN_SEGMENT_DURATION:
                logger.info(
                    f"Video ({video_duration_sec}s) is shorter than minimum segment duration ({MIN_SEGMENT_DURATION}s). "
                    "Processing entire video."
                )
                # Process entire video as one segment
                segments = [
                    {"startMillis": 0, "endMillis": int(video_duration_sec * 1000)}
                ]
                num_segments = 1
            elif video_duration_sec < (MIN_SEGMENT_DURATION * 2):
                logger.info(
                    f"Video ({video_duration_sec}s) is too short to meaningfully segment "
                    f"(under {MIN_SEGMENT_DURATION * 2}s). Processing as single segment."
                )
                segments = [
                    {"startMillis": 0, "endMillis": int(video_duration_sec * 1000)}
                ]
                num_segments = 1
            else:
                logger.info(
                    f"Video ({video_duration_sec}s) will be segmented into {segment_length_secs}s segments"
                )
                num_segments = int(ceil(video_duration_sec / segment_length_secs))
                if num_segments > max_segments:
                    logger.warning(f"Limiting to {max_segments} segments")
                    num_segments = max_segments

                # Build segments list with merging for short final segments
                segments = []
                for i in range(num_segments):
                    start_s = i * segment_length_secs
                    end_s = min((i + 1) * segment_length_secs, video_duration_sec)

                    if end_s <= start_s:
                        break

                    # Check if remaining time after this segment is less than minimum
                    remaining_after = video_duration_sec - end_s
                    if 0 < remaining_after < MIN_SEGMENT_DURATION:
                        # Merge remaining time into this segment
                        logger.info(
                            f"Merging final {remaining_after}s into segment {i+1} "
                            f"(below {MIN_SEGMENT_DURATION}s minimum)"
                        )
                        end_s = video_duration_sec

                    segments.append(
                        {
                            "startMillis": int(start_s * 1000),
                            "endMillis": int(end_s * 1000),
                        }
                    )

                    # If we extended to the end, stop creating more segments
                    if end_s >= video_duration_sec:
                        break

        if not segments:
            return error_response(
                400, "No valid segments were computed for the provided parameters"
            )

        # Log each segment details
        logger.info(f"=== Generated {len(segments)} segments ===")
        for idx, seg in enumerate(segments, start=1):
            duration_s = (seg["endMillis"] - seg["startMillis"]) / 1000
            logger.info(
                f"  Segment {idx}: {seg['startMillis']}ms - {seg['endMillis']}ms "
                f"(duration: {duration_s}s)"
            )

        # generate Bedrock Data Automation job
        # input_s3_uri = f"s3://{input_bucket}/{s3_key}"
        # output_s3_uri = f"s3://{input_bucket}/camera-footage/output/"

        logger.info(f"Project ARN: {BEDROCK_PROJECT_ARN}")
        logger.info(f"Profile ARN: {BEDROCK_PROFILE_ARN}")

        client = boto3.client(
            "bedrock-data-automation-runtime", region_name="us-east-1"
        )

        invocation_results = []
        video_folder = os.path.splitext(os.path.basename(s3_key))[0]

        logger.info(f"Video folder name: {video_folder}")
        logger.info(f"Input S3 key: {s3_key}")
        logger.info(f"Output base path: camera-footage/output/{video_folder}/")

        # iterate and invoke BDA for each segment
        for idx, seg in enumerate(segments, start=1):
            logger.info(f"\n{'='*60}")
            logger.info(f"PROCESSING SEGMENT {idx}/{len(segments)}")
            logger.info(f"{'='*60}")

            client_token = f"{session_id}-{uuid.uuid4().hex[:8]}-seg{idx}"
            input_s3_uri = f"s3://{input_bucket}/{s3_key}"
            output_s3_uri = f"s3://{input_bucket}/camera-footage/output/{video_folder}/segment-{idx}/"

            logger.info(f"Segment {idx} configuration:")
            logger.info(f"  Time range: {seg['startMillis']}ms - {seg['endMillis']}ms")
            logger.info(f"  Duration: {(seg['endMillis'] - seg['startMillis'])/1000}s")
            logger.info(f"  Input S3 URI: {input_s3_uri}")
            logger.info(f"  Output S3 URI: {output_s3_uri}")
            logger.info(f"  Client token: {client_token}")

            try:
                logger.info(f"Invoking Bedrock Data Automation for segment {idx}...")

                # Build input configuration
                input_config = {"s3Uri": input_s3_uri}

                # add timestampSegment if processing multiple segments
                # For single segment, process entire video without timestamp restriction
                if len(segments) > 1:
                    logger.info(f"Using timestamp segmentation (multi-segment mode)")
                    input_config["assetProcessingConfiguration"] = {
                        "video": {
                            "segmentConfiguration": {
                                "timestampSegment": {
                                    "startTimeMillis": seg["startMillis"],
                                    "endTimeMillis": seg["endMillis"],
                                }
                            }
                        }
                    }
                else:
                    logger.info(f"Processing entire video (single segment mode)")

                # Invoke Bedrock
                response = client.invoke_data_automation_async(
                    clientToken=client_token,
                    inputConfiguration=input_config,
                    outputConfiguration={"s3Uri": output_s3_uri},
                    dataAutomationConfiguration={
                        "dataAutomationProjectArn": BEDROCK_PROJECT_ARN,
                        "stage": "LIVE",
                    },
                    dataAutomationProfileArn=BEDROCK_PROFILE_ARN,
                )

                invocation_arn = response["invocationArn"]
                job_id = invocation_arn.split("/")[-1] if invocation_arn else None

                logger.info(f" Segment {idx} job started successfully!")
                logger.info(f"  Job ID: {job_id}")
                logger.info(f"  Invocation ARN: {invocation_arn}")
                logger.info(f"  Expected output location: {output_s3_uri}")

                invocation_results.append(
                    {
                        "segmentIndex": idx,
                        "startMillis": seg["startMillis"],
                        "endMillis": seg["endMillis"],
                        "invocationArn": invocation_arn,
                        "jobId": job_id,
                        "outputS3Uri": output_s3_uri,
                    }
                )

            except Exception as e:
                logger.error(f" Failed to start BDA for segment {idx}")
                logger.error(f"  Error type: {type(e).__name__}")
                logger.error(f"  Error message: {str(e)}")
                logger.error(f"  Segment config: {seg}")
                logger.error(f"  Full traceback:", exc_info=True)

                invocation_results.append(
                    {
                        "segmentIndex": idx,
                        "startMillis": seg["startMillis"],
                        "endMillis": seg["endMillis"],
                        "error": str(e),
                    }
                )

        logger.info(f"\n{'='*60}")
        logger.info(f"SEGMENTATION COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"Session ID: {session_id}")
        logger.info(f"Total segments requested: {len(segments)}")
        logger.info(
            f"Successfully started: {len([r for r in invocation_results if 'jobId' in r])}"
        )
        logger.info(f"Failed: {len([r for r in invocation_results if 'error' in r])}")

        logger.info(f"\nExpected output locations in S3:")
        for inv in invocation_results:
            if "jobId" in inv:
                logger.info(f"  Segment {inv['segmentIndex']}: {inv['outputS3Uri']}")
                logger.info(f"    → Job ID: {inv['jobId']}")

        # Count only successful invocations
        successful_invocations = [r for r in invocation_results if "jobId" in r]

        # return all job ids / ARNs
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,PUT",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Content-Type": "application/json",
            },
            "body": json.dumps(
                {
                    "success": True,
                    "sessionId": session_id,
                    "segmentsStarted": len(successful_invocations),
                    "expected_segments": len(successful_invocations),
                    "invocations": invocation_results,
                    "message": "Segmented BDA jobs triggered",
                }
            ),
        }

    except Exception as e:
        logger.error(f" CRITICAL ERROR in handler")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error(f"Full traceback:", exc_info=True)
        return error_response(500, "Failed to trigger segmented analysis job")


def error_response(status_code, message):
    """Helper function to create error responses"""
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        "body": json.dumps({"error": message}),
    }
