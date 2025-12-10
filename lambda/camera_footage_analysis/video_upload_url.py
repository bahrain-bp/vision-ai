import json
import boto3
import os
from datetime import datetime
import logging
import uuid
import mimetypes
import re

# configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
BUCKET_NAME = os.environ.get("BUCKET_NAME")

# Configuration constants
ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv"]
ALLOWED_MIME_TYPES = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
    "video/x-flv",
    "video/x-ms-wmv",
]
MAX_FILE_SIZE_MB = 2048  # 2 GB limit
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


# sessionID validation helper function
def is_valid_session_id(session_id):
    """
    Valid sessionId example: session-20251119134654-450ca997
    Format: session-YYYYMMDDHHMMSS-XXXXXXXX
    """
    pattern = r"^session-\d{14}-[a-fA-F0-9]{8}$"
    return bool(re.match(pattern, session_id))


def validate_file_type(file_name, file_extension):
    """
    Validate that the file is a supported video format
    """
    # Check extension
    if file_extension.lower() not in ALLOWED_VIDEO_EXTENSIONS:
        logger.warning(f"Invalid file extension: {file_extension}")
        return (
            False,
            f"Unsupported file type. Allowed types: {', '.join(ALLOWED_VIDEO_EXTENSIONS)}",
        )

    # Check MIME type
    content_type = mimetypes.types_map.get(file_extension.lower(), "")
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"Invalid MIME type: {content_type}")
        return False, "Invalid video file format"

    return True, content_type or "video/mp4"


def validate_file_size(file_size):
    """
    Validate that the file size is within acceptable limits
    """
    if file_size <= 0:
        return False, "Invalid file size"

    if file_size > MAX_FILE_SIZE_BYTES:
        size_mb = file_size / (1024 * 1024)
        logger.warning(f"File size exceeds limit: {size_mb:.2f} MB")
        return False, f"File size exceeds maximum limit of {MAX_FILE_SIZE_MB} MB"

    return True, None


def handler(event, context):
    """
    Generate presigned URL for video upload with validation

    POST /footage/upload-url
    Body: {
        "sessionId": "session-20251119134654-450ca997",
        "fileName": "surveillance_video.mp4",
        "fileSize": 12345678  # bytes
    }
    """
    try:
        logger.info("=== Starting video upload URL generation ===")

        # parse request body
        body = json.loads(event.get("body", "{}"))
        session_id = body.get("sessionId")
        file_name = body.get("fileName")
        file_size = body.get("fileSize", 0)  # File size in bytes

        logger.info(
            f"Parameters - sessionId: {session_id}, fileName: {file_name}, fileSize: {file_size} bytes"
        )

        # validate field inputs
        if not session_id or not file_name:
            return error_response(400, "sessionId and fileName are required")

        # validate sessionId format
        if not is_valid_session_id(session_id):
            return error_response(400, f"Invalid sessionId format: {session_id}")

        # validate file size
        if file_size:
            size_valid, size_error = validate_file_size(file_size)
            if not size_valid:
                return error_response(400, size_error)
        else:
            logger.warning("File size not provided - skipping size validation")

        # extract and validate video file extension
        _, file_extension = os.path.splitext(file_name)

        if not file_extension:
            return error_response(400, "File must have a valid extension")

        # Validate file type
        type_valid, content_type_or_error = validate_file_type(
            file_name, file_extension
        )
        if not type_valid:
            return error_response(400, content_type_or_error)

        content_type = content_type_or_error
        logger.info(f"Validated MIME type: {content_type}")

        # Extract only the base filename, removing any directory path
        base_name = os.path.basename(file_name)
        # Remove path separators and dangerous characters
        safe_base_name = re.sub(
            r"[^a-zA-Z0-9_.-]", "_", os.path.splitext(base_name)[0]
        )[:100]

        # Verify no path traversal characters remain
        if ".." in safe_base_name or "/" in safe_base_name or "\\" in safe_base_name:
            logger.error(f"Path traversal attempt detected: {file_name}")
            return error_response(
                400, "Invalid filename: contains restricted characters"
            )

        # generate descriptive file name with timestamp (with unique id to avoid collisions)
        unique_id = uuid.uuid4().hex[:12]
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        safe_file_name = (
            f"footage_{timestamp}_{unique_id}_{safe_base_name}{file_extension.lower()}"
        )

        # S3 key for uploaded video
        s3_key = f"camera-footage/videos/{safe_file_name}"

        logger.info(f"Generated S3 key: {s3_key}")

        # generate presigned URL (valid for 30 minutes) with content length limit
        presigned_params = {
            "Bucket": BUCKET_NAME,
            "Key": s3_key,
            "ContentType": content_type,
        }

        # Add content length constraint if file size provided
        if file_size:
            presigned_params["ContentLength"] = file_size

        presigned_url = s3.generate_presigned_url(
            "put_object", Params=presigned_params, ExpiresIn=1800  # 30 minutes
        )

        logger.info("Successfully generated presigned URL for video upload")

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
                    "uploadUrl": presigned_url,
                    "s3Key": s3_key,
                    "expiresIn": 1800,
                    "maxSizeMB": MAX_FILE_SIZE_MB,
                    "allowedTypes": ALLOWED_VIDEO_EXTENSIONS,
                    "message": "Presigned URL generated successfully",
                }
            ),
        }

    except Exception as e:
        logger.error(f"Error generating video upload URL: {str(e)}", exc_info=True)
        return error_response(500, "Failed to generate video upload URL")


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
