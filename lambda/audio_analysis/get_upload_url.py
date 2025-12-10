import json
import boto3
import os
from datetime import datetime
import logging
import uuid
import mimetypes
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
BUCKET_NAME = os.environ["BUCKET_NAME"]

# Configuration constants
ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".wma"]
ALLOWED_MIME_TYPES = [
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
    "audio/x-ms-wma",
]
MAX_FILE_SIZE_MB = 500  # 500 MB limit
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def validate_file_type(file_name, file_extension):
    """
    Validate that the file is a supported audio format
    """
    # Check extension
    if file_extension.lower() not in ALLOWED_AUDIO_EXTENSIONS:
        logger.warning(f"Invalid file extension: {file_extension}")
        return (
            False,
            f"Unsupported file type. Allowed types: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}",
        )

    # Check MIME type
    content_type = mimetypes.types_map.get(file_extension.lower(), "")
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        logger.warning(f"Invalid MIME type: {content_type}")
        return False, "Invalid audio file format"

    return True, content_type or "audio/mpeg"


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
    Generate presigned URL for audio upload with validation
    Input: {
        "fileName": "audio.mp3",
        "fileType": "audio/mpeg",
        "fileSize": 12345678  # bytes (optional but recommended)
    }
    Output: { "uploadUrl": "...", "s3Key": "..." }
    """
    try:
        logger.info("=== Starting audio upload URL generation ===")

        body = json.loads(event.get("body", "{}"))
        file_name = body.get("fileName")
        file_type = body.get("fileType")
        file_size = body.get("fileSize", 0)

        logger.info(
            f"Parameters - fileName: {file_name}, fileType: {file_type}, fileSize: {file_size} bytes"
        )

        # Validate inputs
        if not file_name:
            return error_response(400, "fileName is required")

        # Validate file size if provided
        if file_size:
            size_valid, size_error = validate_file_size(file_size)
            if not size_valid:
                return error_response(400, size_error)
        else:
            logger.warning("File size not provided - skipping size validation")

        # Extract and validate file extension
        _, file_extension = os.path.splitext(file_name)

        if not file_extension:
            return error_response(400, "File must have a valid extension")

        # Validate file type
        type_valid, content_type_or_error = validate_file_type(
            file_name, file_extension
        )
        if not type_valid:
            return error_response(400, content_type_or_error)

        content_type = file_type or content_type_or_error
        logger.info(f"Validated MIME type: {content_type}")

        # Generate safe file name with timestamp and unique ID
        unique_id = uuid.uuid4().hex[:12]
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        # Sanitize filename to prevent path traversal
        safe_base_name = re.sub(r"[^a-zA-Z0-9_-]", "_", os.path.splitext(file_name)[0])[
            :50
        ]
        safe_file_name = (
            f"{timestamp}_{unique_id}_{safe_base_name}{file_extension.lower()}"
        )

        key = f"audio/uploads/{safe_file_name}"

        logger.info(f"Generated S3 key: {key}")

        # Generate presigned URL with content type and optional size constraint
        presigned_params = {
            "Bucket": BUCKET_NAME,
            "Key": key,
            "ContentType": content_type,
        }

        # Add content length constraint if file size provided
        if file_size:
            presigned_params["ContentLength"] = file_size

        presigned_url = s3.generate_presigned_url(
            "put_object", Params=presigned_params, ExpiresIn=600  # 10 minutes
        )

        logger.info("Successfully generated presigned URL")

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
                    "s3Key": key,
                    "bucket": BUCKET_NAME,
                    "expiresIn": 600,
                    "maxSizeMB": MAX_FILE_SIZE_MB,
                    "allowedTypes": ALLOWED_AUDIO_EXTENSIONS,
                    "message": "Presigned URL generated successfully",
                }
            ),
        }

    except Exception as e:
        logger.error(f"Error generating upload URL: {str(e)}", exc_info=True)
        return error_response(500, "Failed to generate audio upload URL")


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
