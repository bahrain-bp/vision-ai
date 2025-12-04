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
        logger.info(f"≡ƒöì Finding latest folder in: s3://{bucket}/{prefix}")
        
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix,
            Delimiter='/'
        )
        
        if 'CommonPrefixes' not in response:
            logger.warning(f"Γ¥î No folders found in s3://{bucket}/{prefix}")
            return None
        
        folders = [p['Prefix'] for p in response['CommonPrefixes']]
        logger.info(f"≡ƒôé Found {len(folders)} folders")
        
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
                logger.info(f"  ≡ƒôü {folder} - Last modified: {last_modified}")
        
        if not folder_times:
            logger.warning("No folders with contents found")
            return None
        
        # Sort by last modified time, most recent first
        folder_times.sort(key=lambda x: x[1], reverse=True)
        latest_folder = folder_times[0][0]
        
        logger.info(f"Γ£à Latest folder: {latest_folder}")
        return latest_folder
        
    except Exception as e:
        logger.error(f"Γ¥î Failed to find latest folder: {e}", exc_info=True)
        return None


def find_text_file_in_folder(bucket: str, folder_prefix: str) -> Optional[str]:
    """Find the first .txt file in an S3 folder."""
    try:
        # Ensure folder prefix ends with /
        if not folder_prefix.endswith('/'):
            folder_prefix += '/'
        
        logger.info(f"≡ƒöì Searching for .txt files in: s3://{bucket}/{folder_prefix}")
        
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=folder_prefix,
            MaxKeys=100
        )
        
        if 'Contents' not in response:
            logger.warning(f"Γ¥î No files found in s3://{bucket}/{folder_prefix}")
            logger.warning(f"≡ƒô¥ Response: {response}")
            return None
        
        # Log all found objects for debugging
        logger.info(f"≡ƒôé Found {len(response['Contents'])} objects:")
        for obj in response['Contents']:
            logger.info(f"  - {obj['Key']}")
        
        # Find first .txt file
        for obj in response['Contents']:
            key = obj['Key']
            if key.endswith('.txt') and not key.endswith('/'):
                logger.info(f"Γ£à Found text file: {key}")
                return key
        
        logger.warning(f"ΓÜá∩╕Å No .txt files found in s3://{bucket}/{folder_prefix}")
        return None
    except Exception as e:
        logger.error(f"Γ¥î Failed to list files in s3://{bucket}/{folder_prefix} - {e}")
        logger.error(f"Error details: {str(e)}", exc_info=True)
        return None


def read_text_from_s3(bucket: str, key: str) -> str:
    """Read text file from S3 bucket."""
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read().decode("utf-8")
    except Exception as e:
        logger.error(f"Γ¥î Failed to read s3://{bucket}/{key} - {e}")
        raise


def build_rewrite_prompts(original_text: str) -> Tuple[str, str]:
    system = (
        "╪ú┘å╪¬ ┘à╪¡╪▒┘æ┘É╪▒ ╪¬┘é╪º╪▒┘è╪▒ ╪¼┘å╪º╪ª┘è╪⌐ ┘è╪╣┘à┘ä ┘ä╪╡╪º┘ä╪¡ ╪º┘ä┘å┘è╪º╪¿╪⌐ ╪º┘ä╪╣╪º┘à╪⌐ ┘ü┘è ┘à┘à┘ä┘â╪⌐ ╪º┘ä╪¿╪¡╪▒┘è┘å.\n"
        "┘à╪╡╪»╪▒ ╪º┘ä╪¿┘è╪º┘å╪º╪¬ ┘ç┘ê ┘à┘ä┘ü ╪¿┘ä╪º╪║ ╪┤╪▒╪╖┘è/┘é╪╢┘è╪⌐ ┘å┘è╪º╪¿╪⌐ ┘è╪¡╪¬┘ê┘è ╪╣┘ä┘ë ╪¼╪»╪º┘ê┘ä ┘à╪╖╪¿┘ê╪╣╪⌐ "
        "┘ê┘à╪¼┘à┘ê╪╣╪⌐ ┘à╪¡╪º╪╢╪▒ ╪¿╪╣┘å┘ê╪º┘å (┘ü╪¬╪¡ ╪º┘ä┘à╪¡╪╢╪▒ ╪¿╪º┘ä╪¬╪º╪▒┘è╪« ┘ê╪º┘ä┘ê┘é╪¬ ╪º┘ä┘à╪░┘â┘ê╪▒┘è┘å ╪ú╪╣┘ä╪º┘ç...).\n\n"
        "┘à┘ç┘à╪¬┘â:\n"
        "- ╪Ñ┘å╪¬╪º╪¼ ╪¬┘é╪▒┘è╪▒ ┘ê╪º╪¡╪» ┘à┘å╪╕┘à ┘ê┘ê╪º╪╢╪¡ ┘ü┘é╪╖╪î ╪¿╪º┘ä┘ä╪║╪⌐ ╪º┘ä╪╣╪▒╪¿┘è╪⌐ ╪º┘ä╪▒╪│┘à┘è╪⌐╪î ╪¿╪»┘ê┘å ╪ú┘è ╪▓╪«╪▒┘ü╪⌐.\n"
        "- ┘ä╪º ╪¬╪╢┘ü ╪ú┘è ┘à╪╣┘ä┘ê┘à╪⌐ ╪¼╪»┘è╪»╪⌐ ╪║┘è╪▒ ┘à┘ê╪¼┘ê╪»╪⌐ ┘ü┘è ╪º┘ä┘å╪╡ ╪º┘ä╪ú╪╡┘ä┘è.\n"
        "- ┘ä╪º ╪¬╪¡╪░┘ü ╪ú┘è ┘à╪╣┘ä┘ê┘à╪⌐ ╪¼┘ê┘ç╪▒┘è╪⌐ ┘à╪¬╪╣┘ä┘é╪⌐ ╪¿╪º┘ä┘é╪╢┘è╪⌐ (╪ú╪│┘à╪º╪í╪î ╪ú╪▒┘é╪º┘à ╪┤╪«╪╡┘è╪⌐╪î ╪¬┘ê╪º╪▒┘è╪«╪î ╪ú┘ê┘é╪º╪¬╪î ╪ú┘à╪º┘â┘å╪î ╪ú┘é┘ê╪º┘ä╪î ┘é╪▒╪º╪▒╪º╪¬╪î ╪ú╪▒┘é╪º┘à ╪¿┘ä╪º╪║╪º╪¬╪î ╪¡╪º┘ä╪⌐ ╪º┘ä┘à╪¬┘ç┘à╪î ╪¡╪º┘ä╪⌐ ╪º┘ä╪╡┘ä╪¡╪î ┘ê╪¼┘ê╪» ╪¬╪╡┘ê┘è╪▒╪î ╪Ñ┘ä╪«).\n"
        "- ┘è╪¼┘ê╪▓ ┘ä┘â ╪¡╪░┘ü ╪º┘ä╪│╪╖┘ê╪▒ ╪º┘ä┘à┘â╪▒╪▒╪⌐ (┘à╪½┘ä ╪¬┘â╪▒╪º╪▒ ╪▒╪ú╪│ ╪º┘ä╪╡┘ü╪¡╪⌐╪î ╪¼┘à┘ä╪⌐ \"┘é╪╢┘è╪⌐ ┘å┘è╪º╪¿╪⌐ / ╪¼┘å╪º╪ª┘è / ╪¼┘å╪º╪ª┘è ╪╣╪º┘à ╪▒┘é┘à ╪º┘ä╪¿┘ä╪º╪║\"╪î ╪ú┘ê ╪¬┘â╪▒╪º╪▒ ┘å┘ü╪│ ╪º┘ä┘ü┘é╪▒╪⌐ ┘å╪╡╪º┘ï).\n"
        "- ╪Ñ╪░╪º ┘â╪º┘å╪¬ ┘å┘ü╪│ ╪º┘ä┘à╪╣┘ä┘ê┘à╪⌐ ┘à┘â╪▒╪▒╪⌐ ┘ü┘è ╪ú┘â╪½╪▒ ┘à┘å ┘à┘â╪º┘å (┘à╪½┘ä╪º┘ï ╪▒┘é┘à ╪º┘ä╪¿┘ä╪º╪║ ╪ú┘ê ╪¿┘è╪º┘å╪º╪¬ ╪º┘ä╪ú╪╖╪▒╪º┘ü)╪î ╪º╪░┘â╪▒┘ç╪º ┘à╪▒╪⌐ ┘ê╪º╪¡╪»╪⌐ ┘ü┘è ╪º┘ä┘é╪│┘à ╪º┘ä┘à┘å╪º╪│╪¿.\n"
        "- ╪Ñ╪░╪º ┘â╪º┘å╪¬ ┘ç┘å╪º┘â ╪¼┘à┘ä ┘à┘é╪╖┘ê╪╣╪⌐ ╪ú┘ê ╪║┘è╪▒ ┘à┘ü┘ç┘ê┘à╪⌐ ╪¿╪│╪¿╪¿ OCR ┘ê┘ä╪º ┘è┘à┘â┘å ┘ü┘ç┘à ┘à╪╣┘å╪º┘ç╪º╪î ┘è╪¼┘ê╪▓ ╪¡╪░┘ü┘ç╪º ╪»┘ê┘å ╪¬╪«┘à┘è┘å.\n"
        "- ╪Ñ╪░╪º ┘â╪º┘å ╪º┘ä┘à╪│╪¬┘å╪» ┘è╪¡╪¬┘ê┘è ╪╣┘ä┘ë ╪ú┘â╪½╪▒ ┘à┘å ┘à┘ä┘ü ╪ú┘ê ╪Ñ╪¼╪▒╪º╪í ╪║┘è╪▒ ┘à╪▒╪¬╪¿╪╖ ╪¿╪º┘ä┘é╪╢┘è╪⌐ ╪º┘ä╪▒╪ª┘è╪│┘è╪⌐╪î ╪╢╪╣ ┘ç╪░┘ç ╪º┘ä╪ú╪¼╪▓╪º╪í ┘ü┘è ┘é╪│┘à (┘à┘ä╪º╪¡┘é ╪Ñ╪╢╪º┘ü┘è╪⌐) ┘ü┘é╪╖ ┘ê┘ä╪º ╪¬╪»┘à╪¼┘ç╪º ┘ü┘è ╪╡┘ä╪¿ ╪º┘ä╪¬┘é╪▒┘è╪▒.\n"
        "- ┘ä╪º ╪¬╪╣┘è╪» ┘â╪¬╪º╪¿╪⌐ ╪º┘ä╪¬┘é╪▒┘è╪▒ ╪ú┘â╪½╪▒ ┘à┘å ┘à╪▒╪⌐.\n"
        "- ┘ä╪º ╪¬╪╣┘è╪» ╪╡┘è╪º╪║╪⌐ ┘å┘ü╪│ ╪º┘ä┘à╪¡╪¬┘ê┘ë ╪¿╪╡┘è╪║╪¬┘è┘å ┘à╪«╪¬┘ä┘ü╪¬┘è┘å.\n\n"
        "┘é┘ê╪º╪╣╪» ╪º┘ä╪¼╪»╪º┘ê┘ä ┘ê╪º┘ä╪¬┘å╪│┘è┘é:\n"
        "- ┘à╪│┘à┘ê╪¡ ┘ü┘é╪╖ ╪¿╪¼╪»┘ê┘ä Markdown ┘ê╪º╪¡╪» ┘ä┘é╪│┘à (╪º┘ä╪ú╪╖╪▒╪º┘ü) ┘è╪¬╪╢┘à┘å ╪º┘ä╪╡┘ü╪⌐ ┘ê╪º┘ä╪º╪│┘à ┘ê╪º┘ä╪▒┘é┘à ╪º┘ä╪┤╪«╪╡┘è ┘ê╪¿╪º┘é┘è ╪º┘ä╪¿┘è╪º┘å╪º╪¬.\n"
        "- ╪¼┘à┘è╪╣ ╪º┘ä╪ú┘é╪│╪º┘à ╪º┘ä╪ú╪«╪▒┘ë (╪º┘ä┘à╪╢╪¿┘ê╪╖╪º╪¬╪î ╪º┘ä╪ú╪╢╪▒╪º╪▒╪î ╪º┘ä╪¬┘ê╪º╪▒┘è╪«╪î ╪º┘ä╪ú╪│╪ª┘ä╪⌐╪î ╪º┘ä┘à╪¡╪º╪╢╪▒╪î ╪º┘ä┘é╪▒╪º╪▒╪º╪¬) ╪¬┘Å┘â╪¬╪¿ ┘â┘å╪╡ ╪ú┘ê ┘å┘é╪º╪╖╪î ┘ê┘ä┘è╪│╪¬ ╪¼╪»╪º┘ê┘ä.\n"
        "- ┘ä╪º ╪¬┘å╪│╪« ╪¬╪╡┘à┘è┘à ╪º┘ä╪¼╪»╪º┘ê┘ä ╪º┘ä╪ú╪╡┘ä┘è╪⌐ ┘â┘à╪º ┘ç┘ê╪¢ ╪º╪│╪¬╪«╪▒╪¼ ╪º┘ä╪¿┘è╪º┘å╪º╪¬ ┘ê╪º┘à╪▓╪¼┘ç╪º ┘ü┘è ╪º┘ä┘å╪╡ ╪ú┘ê ╪º┘ä┘å┘é╪º╪╖ ╪º┘ä┘à┘å╪º╪│╪¿╪⌐.\n"
        "- ┘ä╪º ╪¬┘å╪│╪« ╪¼╪»╪º┘ê┘ä ╪Ñ╪»╪«╪º┘ä ╪º┘ä┘å╪╕╪º┘à ┘à╪½┘ä: (╪ú╪╖╪▒╪º┘ü ╪º┘ä╪¿┘ä╪º╪║) ╪ú┘ê (╪º┘ä╪ú╪┤┘è╪º╪í ╪º┘ä╪╣┘è┘å┘è╪⌐) ╪ú┘ê (╪º┘ä╪ú╪│╪ª┘ä╪⌐) ╪¿┘å┘ü╪│ ╪┤┘â┘ä┘ç╪º.\n"
        "- ╪º┘ä╪ú┘é┘ê╪º┘ä (╪ú┘é┘ê╪º┘ä ╪º┘ä┘à╪¿┘ä╪║╪î ╪º┘ä┘à╪»╪╣┘ë ╪╣┘ä┘è┘ç╪î ╪º┘ä╪┤┘ç┘ê╪») ╪¬┘Å┘â╪¬╪¿ ┘ü┘è ┘ü┘é╪▒╪º╪¬ ┘å╪╡┘è╪⌐╪î ┘ä┘è╪│╪¬ ┘ü┘è ╪¼╪»┘ê┘ä.\n"
        "- ┘à╪¡╪º╪╢╪▒ ╪º┘ä╪┤╪▒╪╖╪⌐ ┘â┘ä┘ç╪º (┘ü╪¬╪¡ ╪º┘ä┘à╪¡╪╢╪▒╪î ╪º┘å╪¬┘é╪º┘ä ╪º┘ä┘à┘ê┘é╪╣╪î ╪º╪│╪¬╪╣┘ä╪º┘à╪º╪¬╪î ╪¿╪¡╪½ ┘ê╪¬╪¡╪▒┘è...) ╪¬┘Å┘â╪¬╪¿ ┘â┘å╪╡ ╪ú┘ê ┘å┘é╪º╪╖ ┘ü┘é╪╖ ╪¿┘ä╪º ╪ú┘è ╪¼╪»┘ê┘ä.\n"
        "- ╪º┘ä┘à╪╣┘ä┘ê┘à╪º╪¬ ╪º┘ä╪Ñ╪»╪º╪▒┘è╪⌐ ╪º┘ä╪╣╪º┘à╪⌐ (┘à┘à┘ä┘â╪⌐ ╪º┘ä╪¿╪¡╪▒┘è┘å╪î ╪º┘ä┘å┘è╪º╪¿╪⌐ ╪º┘ä╪╣╪º┘à╪⌐╪î ┘å┘è╪º╪¿╪⌐ ╪º┘ä╪╣╪º╪╡┘à╪⌐...) ╪¬┘Å╪░┘â╪▒ ┘à╪▒╪⌐ ┘ê╪º╪¡╪»╪⌐ ┘ü┘è ╪¿┘è╪º┘å╪º╪¬ ╪º┘ä┘é╪╢┘è╪⌐ ┘ü┘é╪╖.\n"
        "- ╪º╪│╪¬╪«╪»┘à ╪╣┘å╪º┘ê┘è┘å ╪º┘ä┘à╪│╪¬┘ê┘ë ╪º┘ä╪½╪º┘å┘è Markdown ╪¿┘ç╪░╪º ╪º┘ä╪┤┘â┘ä ┘ü┘é╪╖: '## ╪º┘ä╪╣┘å┘ê╪º┘å'.\n"
        "- ┘ä╪º ╪¬╪│╪¬╪«╪»┘à ╪╣┘å╪º┘ê┘è┘å ╪¿┘à╪│╪¬┘ê┘è╪º╪¬ ╪ú╪«╪▒┘ë ┘à╪½┘ä '###' ╪ú┘ê '####'.\n"
        "- ┘ä╪º ╪¬┘â╪¬╪¿ ╪╣┘å╪º┘ê┘è┘å ╪¬╪¿╪»╪ú ╪¿┘å┘à╪╖ ╪║╪▒┘è╪¿ ┘à╪½┘ä '#### ╪º┘ä-'.\n\n"
        "╪╢┘ê╪º╪¿╪╖ ╪¡╪│╪º╪│╪⌐:\n"
        "- ┘à┘à┘å┘ê╪╣ ╪º╪«╪¬╪▒╪º╪╣ ╪ú╪│┘à╪º╪í ╪ú╪┤╪«╪º╪╡ ╪ú┘ê ╪¼┘ç╪º╪¬ ╪ú┘ê ╪ú╪▒┘é╪º┘à ╪┤╪«╪╡┘è╪⌐ ╪ú┘ê ╪ú╪▒┘é╪º┘à ╪¿┘ä╪º╪║╪º╪¬ ╪ú┘ê ┘à╪¿╪º┘ä╪║ ┘à╪º┘ä┘è╪⌐ ╪║┘è╪▒ ┘à┘ê╪¼┘ê╪»╪⌐.\n"
        "- ┘à┘à┘å┘ê╪╣ ╪¬╪║┘è┘è╪▒ ╪¡╪º┘ä╪⌐ ╪º┘ä┘à╪¬┘ç┘à (┘à┘ê┘é┘ê┘ü/┘à╪╖┘ä┘ê╪¿/┘à╪«┘ä┘ë ╪│╪¿┘è┘ä) ╪Ñ┘ä╪º ┘â┘à╪º ┘ê╪▒╪» ┘ü┘è ╪º┘ä┘å╪╡.\n"
        "- ┘à┘à┘å┘ê╪╣ ╪º╪«╪¬╪▒╪º╪╣ ┘é╪▒╪º╪▒ ┘å┘è╪º╪¿╪⌐ ╪ú┘ê ╪¡┘â┘à ┘à╪¡┘â┘à╪⌐ ╪║┘è╪▒ ┘à╪░┘â┘ê╪▒.\n"
        "- ╪Ñ╪░╪º ┘ä┘à ╪¬╪¼╪» ┘à╪╣┘ä┘ê┘à╪⌐ ┘à╪╖┘ä┘ê╪¿╪⌐ ┘ü┘è ╪º┘ä┘ç┘è┘â┘ä╪î ╪º┘â╪¬╪¿ ╪¿╪»┘ä╪º┘ï ┘à┘å┘ç╪º: '╪║┘è╪▒ ┘à╪░┘â┘ê╪▒ ┘ü┘è ╪º┘ä┘à╪│╪¬┘å╪»'.\n"
        "- ╪Ñ╪░╪º ┘â╪º┘å ┘ç┘å╪º┘â ╪ú┘â╪½╪▒ ┘à┘å ╪¿┘ä╪º╪║ ╪ú┘ê ╪ú┘â╪½╪▒ ┘à┘å ╪▒┘é┘à ┘é╪╢┘è╪⌐ ┘à╪░┘â┘ê╪▒╪î ╪»┘ê┘æ┘É┘å┘ç╪º ┘â┘ä┘ç╪º ┘ü┘è ┘é╪│┘à ╪¿┘è╪º┘å╪º╪¬ ╪º┘ä┘é╪╢┘è╪⌐ ╪ú┘ê ╪º┘ä╪¬┘ê╪º╪▒┘è╪« ╪º┘ä┘à┘ç┘à╪⌐ ┘à╪╣ ╪¬┘ê╪╢┘è╪¡ ╪╣┘ä╪º┘é╪¬┘ç╪º ┘é╪»╪▒ ╪º┘ä╪Ñ┘à┘â╪º┘å ┘à┘å ╪º┘ä┘å╪╡ ┘å┘ü╪│┘ç ┘ü┘é╪╖.\n"
    )

    user = (
        "╪Ñ┘ä┘è┘â ╪º┘ä┘å╪╡ ╪º┘ä╪ú╪╡┘ä┘è ╪º┘ä┘â╪º┘à┘ä ┘ä┘à┘ä┘ü ╪¿┘ä╪º╪║/┘é╪╢┘è╪⌐ ┘é╪º╪»┘à ┘à┘å ┘à╪▒┘â╪▓ ╪┤╪▒╪╖╪⌐/┘å┘è╪º╪¿╪⌐:\n\n"
        f"{original_text}\n\n"
        "╪º┘ä┘à╪╖┘ä┘ê╪¿: ╪Ñ╪╣╪º╪»╪⌐ ╪¬┘å╪╕┘è┘à ┘ê┘â╪¬╪º╪¿╪⌐ ╪¬┘é╪▒┘è╪▒ ┘ê╪º╪¡╪» ┘ü┘é╪╖ ╪¿╪╡┘è╪║╪⌐ ┘ê╪º╪╢╪¡╪⌐ ┘ê┘à┘å╪│┘é╪⌐╪î "
        "┘ê┘ü┘é ╪º┘ä┘ç┘è┘â┘ä ╪º┘ä╪¬╪º┘ä┘è ╪¿╪º┘ä╪╢╪¿╪╖╪î ┘à╪╣ ┘à┘ä╪í ╪ú┘â╪¿╪▒ ┘é╪»╪▒ ┘à┘à┘â┘å ┘à┘å ╪º┘ä╪¡┘é┘ê┘ä ┘à┘å ╪º┘ä┘å╪╡ ╪º┘ä╪ú╪╡┘ä┘è "
        "╪»┘ê┘å ╪º╪«╪¬╪▒╪º╪╣ ╪ú┘è ┘à╪╣┘ä┘ê┘à╪⌐.\n\n"
        "╪º╪│╪¬╪«╪»┘à ┘ç╪░╪º ╪º┘ä┘ç┘è┘â┘ä ┘â┘à╪º ┘ç┘ê (┘ê╪¿┘å┘ü╪│ ╪¬╪▒╪¬┘è╪¿ ╪º┘ä╪╣┘å╪º┘ê┘è┘å):\n\n"
        "## ╪¿┘è╪º┘å╪º╪¬ ╪º┘ä┘é╪╢┘è╪⌐\n\n"
        "- ╪▒┘é┘à ╪º┘ä╪¿┘ä╪º╪║ ╪º┘ä╪▒╪ª┘è╪│┘è / ╪▒┘é┘à ╪º┘ä┘é╪╢┘è╪⌐ (┘à╪½╪º┘ä: 13227/2025):\n"
        "- ┘å┘ê╪╣ ╪º┘ä┘é╪╢┘è╪⌐ / ╪¬╪╡┘å┘è┘ü┘ç╪º (┘à╪½╪º┘ä: ╪│╪▒┘é╪⌐╪î ╪¼┘å╪º╪ª┘è ╪╣╪º┘à╪î ╪¼┘å╪¡╪⌐ ...):\n"
        "- ┘à╪▒┘â╪▓ ╪º┘ä╪┤╪▒╪╖╪⌐ ╪º┘ä┘à╪¡┘è┘ä (┘à╪½╪º┘ä: ┘à╪▒┘â╪▓ ╪┤╪▒╪╖╪⌐ ╪¼┘å┘ê╪¿ ╪º┘ä╪╣╪º╪╡┘à╪⌐):\n"
        "- ╪º┘ä┘å┘è╪º╪¿╪⌐ ╪º┘ä┘à╪«╪¬╪╡╪⌐ (┘à╪½╪º┘ä: ┘å┘è╪º╪¿╪⌐ ╪º┘ä╪╣╪º╪╡┘à╪⌐):\n"
        "- ╪¬╪º╪▒┘è╪« ┘ê┘ê┘é╪¬ ╪¬┘ä┘é┘è ╪º┘ä╪¿┘ä╪º╪║ ╪º┘ä╪ú┘ê┘ä:\n"
        "- ╪ú╪▒┘é╪º┘à ╪º┘ä╪¿┘ä╪º╪║╪º╪¬ ╪ú┘ê ╪º┘ä╪¬╪╣┘à┘è┘à╪º╪¬ ╪º┘ä╪ú╪«╪▒┘ë ╪º┘ä┘à╪▒╪¬╪¿╪╖╪⌐ (╪Ñ┘å ┘ê╪¼╪»╪¬):\n"
        "- ┘ê╪¼┘ê╪» ╪¬╪╡┘ê┘è╪▒ ╪ú┘à┘å┘è (┘å╪╣┘à / ┘ä╪º / ╪║┘è╪▒ ┘à╪░┘â┘ê╪▒):\n"
        "- ╪▒╪║╪¿╪⌐ ╪º┘ä╪ú╪╖╪▒╪º┘ü ┘ü┘è ╪º┘ä╪╡┘ä╪¡ (┘å╪╣┘à / ┘ä╪º / ╪║┘è╪▒ ┘à╪░┘â┘ê╪▒):\n\n"
        "## ╪º┘ä╪ú╪╖╪▒╪º┘ü\n\n"
        "╪º┘â╪¬╪¿ ╪¼╪»┘ê┘ä Markdown ┘ê╪º╪¡╪» ┘ä┘â┘ä ╪º┘ä╪ú╪╖╪▒╪º┘ü ╪º┘ä┘à╪░┘â┘ê╪▒┘è┘å ┘ü┘è ╪º┘ä┘à┘ä┘ü╪î "
        "╪¿╪║╪╢ ╪º┘ä┘å╪╕╪▒ ╪╣┘å ┘à┘â╪º┘å ╪╕┘ç┘ê╪▒┘ç┘à ┘ü┘è ╪º┘ä╪¼╪»╪º┘ê┘ä ╪ú┘ê ╪º┘ä┘à╪¡╪º╪╢╪▒. ┘ç╪░╪º ┘ç┘ê **╪º┘ä╪¼╪»┘ê┘ä ╪º┘ä┘ê╪¡┘è╪» ╪º┘ä┘à╪│┘à┘ê╪¡** ┘ü┘è ╪º┘ä╪¬┘é╪▒┘è╪▒:\n\n"
        "| ╪º┘ä╪╡┘ü╪⌐ | ╪º┘ä╪º╪│┘à ╪º┘ä┘â╪º┘à┘ä | ╪º┘ä╪¼┘å╪│┘è╪⌐ | ╪º┘ä╪▒┘é┘à ╪º┘ä╪┤╪«╪╡┘è | ╪º┘ä┘ç╪º╪¬┘ü | ┘à┘ä╪º╪¡╪╕╪º╪¬ |\n"
        "| --- | --- | --- | --- | --- | --- |\n"
        "| (╪º┘ä┘à╪¿┘ä╪║ / ╪º┘ä┘à╪¬╪╢╪▒╪▒ / ╪º┘ä┘à╪»╪╣┘ë ╪╣┘ä┘è┘ç / ╪┤╪º┘ç╪» / ╪╢╪º╪¿╪╖ / ╪▒╪ª┘è╪│ ╪¼┘à╪╣┘è╪⌐ / ╪Ñ┘ä╪«) | (╪º┘ä╪º╪│┘à ┘â┘à╪º ┘ê╪▒╪») | (╪º┘ä╪¼┘å╪│┘è╪⌐) | (╪º┘ä╪▒┘é┘à ╪º┘ä╪┤╪«╪╡┘è ╪Ñ┘å ┘ê╪¼╪») | (╪▒┘é┘à ╪º┘ä┘ç╪º╪¬┘ü ╪Ñ┘å ┘ê╪¼╪») | (┘à╪½┘ä: ┘à┘ê┘é┘ê┘ü╪î ┘à╪╖┘ä┘ê╪¿╪î ╪¼┘à╪╣┘è╪⌐╪î ╪¼┘ç╪⌐ ╪╣┘à┘ä╪î ╪Ñ┘ä╪«) |\n\n"
        "╪Ñ╪░╪º ┘â╪º┘å╪¬ ╪¿╪╣╪╢ ╪º┘ä╪¡┘é┘ê┘ä ╪║┘è╪▒ ┘à┘ê╪¼┘ê╪»╪⌐ ┘ü┘è ╪º┘ä┘å╪╡╪î ╪º┘â╪¬╪¿: '╪║┘è╪▒ ┘à╪░┘â┘ê╪▒'.\n\n"
        "## ┘à┘ä╪«╪╡ ╪º┘ä╪¡╪º╪»╪½\n\n"
        "- ┘ä╪«╪╡ ╪º┘ä╪¡╪º╪»╪½ ┘ü┘è ┘ü┘é╪▒╪⌐ ╪ú┘ê ┘ü┘é╪▒╪¬┘è┘å: ╪º┘ä╪▓┘à╪º┘å╪î ╪º┘ä┘à┘â╪º┘å╪î ┘à╪º ╪º┘ä╪░┘è ╪¡╪»╪½╪î "
        "┘ê┘à╪º ┘ç┘è ╪º┘ä╪¬┘ç┘à╪⌐ ╪º┘ä╪ú╪│╪º╪│┘è╪⌐ ╪º┘ä┘à┘å╪│┘ê╪¿╪⌐ ╪Ñ┘ä┘ë ╪º┘ä┘à╪»╪╣┘ë ╪╣┘ä┘è┘ç.\n\n"
        "## ┘à╪│╪▒╪¡ ╪º┘ä╪¡╪º╪»╪½\n\n"
        "- ╪º╪░┘â╪▒ ╪╣┘å┘ê╪º┘å ┘à┘ê┘é╪╣ ╪º┘ä╪¡╪º╪»╪½ ┘â┘à╪º ┘ê╪▒╪» (┘à┘å╪╖┘é╪⌐╪î ┘à╪¼┘à╪╣╪î ╪┤╪º╪▒╪╣╪î ┘à╪¿┘å┘ë╪î ┘ê╪╡┘ü ╪Ñ╪╢╪º┘ü┘è).\n"
        "- ╪Ñ╪░╪º ╪░┘Å┘â╪▒ ╪ú┘â╪½╪▒ ┘à┘å ┘à┘ê┘é╪╣ (┘à╪½┘ä╪º┘ï: ┘à╪¡┘ä ╪¬╪¼╪º╪▒┘è + ╪╣┘å┘ê╪º┘å ╪│┘â┘å ╪º┘ä┘à╪¬┘ç┘à)╪î ┘ê╪╢┘æ╪¡ ╪░┘ä┘â ┘ü┘è ┘å┘é╪º╪╖.\n\n"
        "## ╪º┘ä┘à╪╢╪¿┘ê╪╖╪º╪¬ ┘ê╪º┘ä╪ú╪┤┘è╪º╪í ╪º┘ä╪╣┘è┘å┘è╪⌐\n\n"
        "- ╪Ñ╪░╪º ┘ê┘Å╪¼╪»╪¬ '╪º┘ä╪ú╪┤┘è╪º╪í ╪º┘ä╪╣┘è┘å┘è╪⌐' ╪ú┘ê ┘à╪¡╪╢╪▒ ┘à╪╢╪¿┘ê╪╖╪º╪¬ ╪ú┘ê ╪ú╪┤┘è╪º╪í ┘à╪¬┘ä┘ü╪⌐/┘à╪│╪▒┘ê┘é╪⌐╪î "
        "╪º┘â╪¬╪¿┘ç╪º ┘ü┘è ╪┤┘â┘ä ┘å┘é╪º╪╖ ┘à╪¬╪¬╪º╪¿╪╣╪⌐╪î ┘ä┘â┘ä ╪╣┘å╪╡╪▒ ╪│╪╖╪▒ ┘ê╪º╪¡╪» ┘à╪½┘ä╪º┘ï:\n"
        "- (╪º┘ä╪»┘ê╪▒: ┘à╪│╪▒┘ê┘é/┘à╪¬┘ä┘ü/┘à╪¡╪¼┘ê╪▓...) ΓÇô (╪º┘ä╪╡┘å┘ü) ΓÇô (╪º┘ä┘ê╪╡┘ü ╪º┘ä╪¬┘ü╪╡┘è┘ä┘è) ΓÇô (╪º┘ä╪¡╪º┘ä╪⌐) ΓÇô (┘à┘ä╪º╪¡╪╕╪º╪¬ ╪Ñ┘å ┘ê╪¼╪»╪¬).\n"
        "- ╪Ñ╪░╪º ┘ä┘à ╪¬┘ê╪¼╪» ┘à╪╢╪¿┘ê╪╖╪º╪¬╪î ╪º┘â╪¬╪¿: ┘ä╪º ╪¬┘ê╪¼╪» ┘à╪╢╪¿┘ê╪╖╪º╪¬ ╪ú┘ê ╪ú╪┤┘è╪º╪í ╪╣┘è┘å┘è╪⌐ ┘à╪░┘â┘ê╪▒╪⌐.\n\n"
        "## ╪º┘ä╪ú╪╢╪▒╪º╪▒ (╪Ñ┘å ┘ê╪¼╪»╪¬)\n\n"
        "- ╪Ñ╪░╪º ┘ê╪▒╪»╪¬ ╪ú╪╢╪▒╪º╪▒ ┘à╪º╪»┘è╪⌐ (┘à╪½┘ä ╪¬┘ä┘ü ┘ü┘è ╪ú┘é┘ü╪º┘ä╪î ╪▓╪¼╪º╪¼╪î ╪ú╪¿┘ê╪º╪¿...)╪î "
        "╪º╪░┘â╪▒┘ç╪º ╪ú┘è╪╢╪º┘ï ┘ü┘è ╪┤┘â┘ä ┘å┘é╪º╪╖╪î ┘â┘ä ┘å┘é╪╖╪⌐ ╪¬┘ê╪╢╪¡: ╪º┘ä┘à┘ê┘é╪╣ ╪º┘ä┘à╪¬╪╢╪▒╪▒ ΓÇô ┘ê╪╡┘ü ╪º┘ä╪╢╪▒╪▒ ΓÇô ╪º┘ä┘é┘è┘à╪⌐ ╪º┘ä╪¬┘é╪»┘è╪▒┘è╪⌐ ╪Ñ┘å ┘ê╪¼╪»╪¬.\n"
        "- ╪Ñ╪░╪º ┘ä┘à ╪¬┘Å╪░┘â╪▒ ╪ú╪╢╪▒╪º╪▒╪î ╪º┘â╪¬╪¿: ┘ä╪º ╪¬┘ê╪¼╪» ╪ú╪╢╪▒╪º╪▒ ┘à╪░┘â┘ê╪▒╪⌐.\n\n"
        "## ╪º┘ä╪ú┘é┘ê╪º┘ä\n\n"
        "╪º┘â╪¬╪¿ ╪ú┘é┘ê╪º┘ä ┘â┘ä ╪╖╪▒┘ü ┘ü┘è ┘ü┘é╪▒╪º╪¬ ┘à┘å┘ü╪╡┘ä╪⌐╪î ┘à╪│╪¬╪«┘ä╪╡╪⌐ ┘à┘å ┘à╪¡╪º╪╢╪▒ ╪º┘ä╪º╪│╪¬╪¼┘ê╪º╪¿:\n\n"
        "**╪ú┘é┘ê╪º┘ä ╪º┘ä┘à╪¿┘ä╪║/╪º┘ä┘à╪¬╪╢╪▒╪▒:**\n"
        "- ┘ä╪«╪╡ ┘à╪º ┘ê╪▒╪» ┘ü┘è ┘à╪¡╪º╪╢╪▒ ╪ú┘é┘ê╪º┘ä┘ç (╪ú╪│╪ª┘ä╪⌐/╪ú╪¼┘ê╪¿╪⌐) ╪¿╪»┘ê┘å ╪¬┘â╪▒╪º╪▒ ╪º┘ä╪ú╪│╪ª┘ä╪⌐ ╪¿╪¡╪▒┘ü┘è╪¬┘ç╪º╪î "
        "┘à╪╣ ╪º┘ä╪¡┘ü╪º╪╕ ╪╣┘ä┘ë ╪º┘ä╪¬┘ü╪º╪╡┘è┘ä ╪º┘ä┘à┘ç┘à╪⌐ (┘â┘è┘ü ╪╣╪▒┘ü ╪¿╪º┘ä┘ê╪º┘é╪╣╪⌐╪î ┘à╪º╪░╪º ╪┤╪º┘ç╪»╪î ┘à╪º╪░╪º ┘è╪╖┘ä╪¿...).\n\n"
        "**╪ú┘é┘ê╪º┘ä ╪º┘ä┘à╪»╪╣┘ë ╪╣┘ä┘è┘ç:**\n"
        "- ┘ä╪«╪╡ ╪Ñ┘é╪▒╪º╪▒┘ç ╪ú┘ê ╪Ñ┘å┘â╪º╪▒┘ç ┘â┘à╪º ┘ê╪▒╪».\n\n"
        "**╪ú┘é┘ê╪º┘ä ╪º┘ä╪┤┘ç┘ê╪» (╪Ñ┘å ┘ê╪¼╪»┘ê╪º):**\n"
        "- ┘ä┘â┘ä ╪┤╪º┘ç╪» ┘ü┘é╪▒╪⌐ ┘é╪╡┘è╪▒╪⌐ ╪¬┘ä╪«╪╡ ┘à╪º ┘é╪º┘ä┘ç.\n\n"
        "## ╪Ñ╪¼╪▒╪º╪í╪º╪¬ ╪º┘ä╪┤╪▒╪╖╪⌐\n\n"
        "- **┘ç╪º┘à:** ┘ä╪º ╪¬╪│╪¬╪«╪»┘à ╪ú┘è ╪¼╪»┘ê┘ä ┘ü┘è ┘ç╪░╪º ╪º┘ä┘é╪│┘à.\n"
        "- ╪º╪│╪¬╪«╪▒╪¼ ┘à┘å ╪¼┘à┘è╪╣ ┘à╪¡╪º╪╢╪▒ \"┘ü╪¬╪¡ ╪º┘ä┘à╪¡╪╢╪▒\" ┘ê┘à╪º ╪¿╪╣╪»┘ç╪º ╪¬╪│┘ä╪│┘ä ╪Ñ╪¼╪▒╪º╪í╪º╪¬ ╪º┘ä╪┤╪▒╪╖╪⌐ "
        "┘à╪▒╪¬╪¿╪⌐ ╪▓┘à┘å┘è╪º┘ï ┘à┘å ╪º┘ä╪ú┘é╪»┘à ╪Ñ┘ä┘ë ╪º┘ä╪ú╪¡╪»╪½ ┘ü┘è ╪┤┘â┘ä ┘å┘é╪º╪╖:\n"
        "- ╪¬┘ä┘é┘è ╪º┘ä╪¿┘ä╪º╪║╪î ╪º┘ä╪º╪¬╪╡╪º┘ä ╪¿╪º┘ä╪╢╪º╪¿╪╖ ╪º┘ä┘à┘å╪º┘ê╪¿╪î ╪º┘ä╪º┘å╪¬┘é╪º┘ä ┘ä┘à╪│╪▒╪¡ ╪º┘ä╪¼╪▒┘è┘à╪⌐╪î ╪º┘ä┘à╪╣╪º┘è┘å╪⌐ ┘ê╪º┘ä╪¬╪╡┘ê┘è╪▒╪î "
        "╪¬┘ü╪▒┘è╪║ ┘â╪º┘à┘è╪▒╪º╪¬ ╪º┘ä┘à╪▒╪º┘é╪¿╪⌐╪î ╪º┘ä╪º╪│╪¬╪╣┘ä╪º┘à╪º╪¬ ╪º┘ä╪ú┘à┘å┘è╪⌐╪î ╪Ñ╪▒╪│╪º┘ä ╪º┘ä╪Ñ╪¡╪╢╪º╪▒┘è╪º╪¬ ╪º┘ä╪Ñ┘ä┘â╪¬╪▒┘ê┘å┘è╪⌐╪î "
        "╪º┘ä┘é╪¿╪╢ ╪╣┘ä┘ë ╪º┘ä┘à╪¬┘ç┘à╪î ╪¬┘ê┘é┘è┘ü┘ç╪î ┘ê╪║┘è╪▒┘ç╪º.\n\n"
        "## ╪º┘ä╪¬┘å╪º╪▓┘ä ╪ú┘ê ╪º┘ä╪╡┘ä╪¡\n\n"
        "- ╪Ñ╪░╪º ┘ê╪▒╪» ┘ü┘è ╪º┘ä┘à╪¡╪º╪╢╪▒ ╪ú┘ê ┘ü┘è ╪º┘ä╪ú╪│╪ª┘ä╪⌐ ╪ú┘å ╪º┘ä╪ú╪╖╪▒╪º┘ü ┘è╪▒╪║╪¿┘ê┘å ┘ü┘è ╪º┘ä╪╡┘ä╪¡ ╪ú┘ê ┘ä╪º ┘è╪▒╪║╪¿┘ê┘å╪î "
        "╪ú┘ê ╪ú┘å ┘ç┘å╪º┘â ╪¬┘å╪º╪▓┘ä ╪╣┘å ╪º┘ä╪¿┘ä╪º╪║╪î ╪º╪░┘â╪▒ ╪¬┘ü╪º╪╡┘è┘ä ╪░┘ä┘â (╪º┘ä╪¬╪º╪▒┘è╪«╪î ┘à┘å ╪¬┘å╪º╪▓┘ä╪î ┘ç┘ä ╪¬┘à ╪»┘ü╪╣ ┘à╪¿╪º┘ä╪║...).\n"
        "- ╪Ñ╪░╪º ┘ä┘à ┘è┘Å╪░┘â╪▒ ╪ú┘è ╪┤┘è╪í ╪╣┘å ╪º┘ä╪╡┘ä╪¡ ╪ú┘ê ╪º┘ä╪¬┘å╪º╪▓┘ä╪î ╪º┘â╪¬╪¿: '╪║┘è╪▒ ┘à╪░┘â┘ê╪▒ ┘ü┘è ╪º┘ä┘à╪│╪¬┘å╪»'.\n\n"
        "## ╪Ñ╪¼╪▒╪º╪í╪º╪¬ ┘ê┘é╪▒╪º╪▒╪º╪¬ ╪º┘ä┘å┘è╪º╪¿╪⌐\n\n"
        "- ┘ä╪«╪╡ ┘â╪º┘ü╪⌐ ┘é╪▒╪º╪▒╪º╪¬ ╪º┘ä┘å┘è╪º╪¿╪⌐ ╪º┘ä╪╣╪º┘à╪⌐ ┘â┘à╪º ┘ê╪▒╪»╪¬ ┘ü┘è ╪º┘ä┘à╪│╪¬┘å╪» ┘ü┘è ╪┤┘â┘ä ┘å┘é╪º╪╖:\n"
        "- ┘à╪½┘ä: ╪╖┘ä╪¿ ╪º┘ä╪Ñ╪░┘å ╪¿╪╢╪¿╪╖ ┘ê╪Ñ╪¡╪╢╪º╪▒ ╪º┘ä┘à╪¬┘ç┘à╪î ╪º┘ä╪¬╪╡╪▒┘ü ┘ü┘è ╪º┘ä┘é╪╢┘è╪⌐╪î ╪º┘ä╪Ñ╪¡╪º┘ä╪⌐ ┘ä┘å┘è╪º╪¿╪⌐ ┘à╪╣┘è┘å╪⌐╪î ╪º┘ä╪¡┘ü╪╕╪î "
        "╪º┘ä╪Ñ╪¡╪º┘ä╪⌐ ┘ä┘ä┘à╪¡┘â┘à╪⌐╪î ╪¬┘â┘ä┘è┘ü ╪¿╪º┘ä╪¡╪╢┘ê╪▒╪î ╪Ñ╪╡╪»╪º╪▒ ┘ä╪º╪ª╪¡╪⌐ ╪º┘ä╪º╪¬┘ç╪º┘à╪î ╪º┘ä╪▒╪¿╪╖ ╪º┘ä╪ó┘ä┘è ┘à╪╣ ╪º┘ä┘à╪¡╪º┘â┘à...\n"
        "- ┘ä┘â┘ä ┘é╪▒╪º╪▒: ╪º╪░┘â╪▒ ╪º┘ä╪¬╪º╪▒┘è╪« (╪Ñ┘å ┘ê╪¼╪»)╪î ┘ê╪º╪│┘à ┘ê┘â┘è┘ä ╪º┘ä┘å┘è╪º╪¿╪⌐ ╪ú┘ê ╪╣╪╢┘ê ╪º┘ä┘å┘è╪º╪¿╪⌐╪î ┘ê┘å╪╡ ╪º┘ä┘é╪▒╪º╪▒ ╪¿╪º╪«╪¬╪╡╪º╪▒.\n\n"
        "## ╪¬╪│┘ä┘è┘à ╪º┘ä┘à╪╢╪¿┘ê╪╖╪º╪¬ (╪Ñ┘å ┘ê╪¼╪»)\n\n"
        "- ╪Ñ╪░╪º ╪¬┘à ╪¬╪│┘ä┘è┘à ╪ú┘è ┘à╪╢╪¿┘ê╪╖╪º╪¬ ╪ú┘ê ┘à╪¿╪º┘ä╪║ ┘ä╪┤╪«╪╡ ╪ú┘ê ╪¼┘ç╪⌐╪î ╪º╪░┘â╪▒ ┘à┘å ╪º╪│╪¬┘ä┘à╪î ┘à╪¬┘ë╪î ┘ê┘à╪º ┘ç┘è ╪º┘ä╪ú╪┤┘è╪º╪í ╪º┘ä┘à╪│┘ä┘æ┘Ä┘à╪⌐ ┘ü┘è ┘å┘é╪º╪╖.\n"
        "- ╪Ñ╪░╪º ┘ä┘à ┘è┘Å╪░┘â╪▒ ╪¬╪│┘ä┘è┘à ┘à╪╢╪¿┘ê╪╖╪º╪¬╪î ╪º┘â╪¬╪¿: '╪║┘è╪▒ ┘à╪░┘â┘ê╪▒ ┘ü┘è ╪º┘ä┘à╪│╪¬┘å╪»'.\n\n"
        "## ╪º┘ä╪¬┘ê╪º╪▒┘è╪« ╪º┘ä┘à┘ç┘à╪⌐ ┘ê╪º┘ä╪«╪╖ ╪º┘ä╪▓┘à┘å┘è\n\n"
        "- ┘ä╪º ╪¬╪│╪¬╪«╪»┘à ╪¼╪»┘ê┘ä ┘ç┘å╪º╪¢ ╪º┘â╪¬┘ü┘É ╪¿┘é╪º╪ª┘à╪⌐ ┘à╪▒╪¬╪¿╪⌐ ╪▓┘à┘å┘è╪º┘ï.\n"
        "- ╪º┘â╪¬╪¿ ┘é╪º╪ª┘à╪⌐ ┘à┘å╪│┘é╪⌐ ╪¿╪º┘ä╪¬┘ê╪º╪▒┘è╪« ┘ê╪º┘ä╪ú╪¡╪»╪º╪½ ┘à╪½┘ä:\n"
        "  - ╪º┘ä╪¬╪º╪▒┘è╪« ┘ê╪º┘ä┘ê┘é╪¬ ΓÇô ╪º┘ä╪¡╪»╪½ ΓÇô ╪º┘ä╪¼┘ç╪⌐/╪º┘ä╪┤╪«╪╡ (┘à╪½╪º┘ä: 2025-07-22 14:02 ΓÇô ╪¬┘ä┘é┘è ╪º┘ä╪¿┘ä╪º╪║ ┘ü┘è ┘à╪▒┘â╪▓ ╪┤╪▒╪╖╪⌐ ╪¼┘å┘ê╪¿ ╪º┘ä╪╣╪º╪╡┘à╪⌐ ΓÇô ┘à╪▒┘â╪▓ ╪º┘ä╪┤╪▒╪╖╪⌐).\n\n"
        "## ╪º┘ä╪¬┘ê┘é┘è╪╣╪º╪¬ ┘ê╪º┘ä┘à╪¡╪▒╪▒┘è┘å\n\n"
        "- ╪º╪░┘â╪▒ ╪ú╪│┘à╪º╪í ┘ê╪▒╪¬╪¿ ┘à╪¡╪▒╪▒┘è ╪º┘ä┘à╪¡╪º╪╢╪▒ (┘à╪│╪º╪╣╪» ┘à┘ä╪º╪▓┘à╪î ╪╣╪▒┘è┘ü╪î ╪▒┘é┘è╪¿ ╪ú┘ê┘ä...)\n"
        "- ╪º╪░┘â╪▒ ╪ú╪│┘à╪º╪í ╪º┘ä╪╢╪¿╪º╪╖ ╪º┘ä┘à╪┤╪▒┘ü┘è┘å (┘à╪½╪º┘ä: ╪º┘ä╪▒╪º╪ª╪»/ ╪╣┘ä┘è ┘ü╪º╪╢┘ä╪î ╪º┘ä┘å┘é┘è╪¿/ ╪¡╪│┘è┘å ╪┤╪º┘â╪▒).\n"
        "- ╪º╪░┘â╪▒ ╪ú╪│┘à╪º╪í ╪ú╪╣╪╢╪º╪í ╪º┘ä┘å┘è╪º╪¿╪⌐ ┘ê╪ú╪«╪╡╪º╪ª┘è ╪º┘ä╪¬╪¡┘é┘è┘é ┘â┘à╪º ┘ê╪▒╪»╪¬.\n"
        "- ┘è┘à┘â┘å┘â ┘â╪¬╪º╪¿╪⌐ ╪░┘ä┘â ┘ü┘è ┘å┘é╪º╪╖ ╪¿╪│┘è╪╖╪⌐.\n\n"
        "## ╪º┘ä╪ú╪│╪ª┘ä╪⌐ ╪º┘ä╪«╪¬╪º┘à┘è╪⌐ (╪Ñ┘å ┘ê┘Å╪¼╪» ╪¼╪»┘ê┘ä ╪ú╪│╪ª┘ä╪⌐)\n\n"
        "- ╪Ñ╪░╪º ┘â╪º┘å ┘ç┘å╪º┘â ╪¼╪»┘ê┘ä ┘ü┘è ╪ó╪«╪▒ ╪º┘ä┘à╪│╪¬┘å╪» ╪¿╪╣┘å┘ê╪º┘å '╪º┘ä╪ú╪│╪ª┘ä╪⌐' (┘à╪½┘ä: ┘ç┘ä ┘è┘ê╪¼╪» ╪¬╪╡┘ê┘è╪▒ ╪ú┘à┘å┘è╪ƒ ┘ç┘ä ┘è╪▒╪║╪¿ ╪ú╪╖╪▒╪º┘ü ╪º┘ä╪¿┘ä╪º╪║ ┘ü┘è ╪º┘ä╪╡┘ä╪¡╪ƒ)╪î\n"
        "  ┘ü╪¡┘ê┘æ┘É┘ä┘ç ╪Ñ┘ä┘ë ┘å┘é╪º╪╖ ┘å╪╡┘è╪⌐ ┘à╪½┘ä:\n"
        "  - ╪º┘ä╪│╪ñ╪º┘ä: (╪º┘ä┘å╪╡ ┘â┘à╪º ┘ê╪▒╪») ΓÇô ╪º┘ä╪Ñ╪¼╪º╪¿╪⌐: (┘â┘à╪º ┘ê╪▒╪»╪¬).\n"
        "- ╪Ñ╪░╪º ┘ä┘à ╪¬┘ê╪¼╪» ╪ú╪│╪ª┘ä╪⌐ ╪«╪¬╪º┘à┘è╪⌐╪î ┘è┘à┘â┘å┘â ╪¡╪░┘ü ┘ç╪░╪º ╪º┘ä┘é╪│┘à ╪ú┘ê ┘â╪¬╪º╪¿╪⌐: ╪║┘è╪▒ ┘à╪░┘â┘ê╪▒.\n\n"
        "## ┘à┘ä╪º╪¡┘é ╪Ñ╪╢╪º┘ü┘è╪⌐ (╪Ñ┘å ┘ê╪¼╪»╪¬)\n\n"
        "- ╪╢╪╣ ┘ç┘å╪º ╪ú┘è ┘à╪¡╪¬┘ê┘ë ┘à┘ç┘à ┘ä┘â┘å┘ç ┘ä┘è╪│ ╪¼╪▓╪í╪º┘ï ┘à╪¿╪º╪┤╪▒╪º┘ï ┘à┘å ╪¬╪│┘ä╪│┘ä ╪º┘ä┘é╪╢┘è╪⌐╪î "
        "┘à╪½┘ä: ╪¿┘ä╪º╪║╪º╪¬ ╪ú╪«╪▒┘ë ┘à╪╣┘ä┘æ┘Ä┘é╪⌐ ╪╣┘ä┘ë ┘å┘ü╪│ ╪º┘ä╪┤╪«╪╡ ╪¿╪»┘ê┘å ╪¬┘ü╪º╪╡┘è┘ä╪î ╪ú┘ê ┘å┘à╪º╪░╪¼ ╪Ñ╪»╪º╪▒┘è╪⌐ ┘à┘â╪▒╪▒╪⌐╪î "
        "╪ú┘ê ╪╡┘ü╪¡╪º╪¬ ┘ä╪º ╪¬╪╢┘è┘ü ╪¼╪»┘è╪»╪º┘ï ┘ä┘ä┘é╪╢┘è╪⌐ ┘ê┘ä┘â┘å ┘é╪» ╪¬┘Å╪░┘â╪▒ ┘â┘à╪▒╪¼╪╣.\n"
        "- ╪Ñ╪░╪º ┘ä┘à ╪¬┘ê╪¼╪» ┘à┘ä╪º╪¡┘é ╪¡┘é┘è┘é┘è╪⌐╪î ┘ä╪º ╪¬┘â╪¬╪¿ ┘ç╪░╪º ╪º┘ä┘é╪│┘à.\n\n"
        "╪¬╪╣┘ä┘è┘à╪º╪¬ ┘å┘ç╪º╪ª┘è╪⌐:\n"
        "- ╪º┘â╪¬╪¿ ╪º┘ä╪¬┘é╪▒┘è╪▒ ┘à╪▒╪⌐ ┘ê╪º╪¡╪»╪⌐ ┘ü┘é╪╖╪î ╪¿╪º╪¬╪¿╪º╪╣ ╪º┘ä┘ç┘è┘â┘ä ╪º┘ä╪│╪º╪¿┘é ╪¿╪º┘ä┘â╪º┘à┘ä ┘ê╪¿╪¬╪│┘ä╪│┘ä ╪º┘ä╪╣┘å╪º┘ê┘è┘å.\n"
        "- ┘ä╪º ╪¬┘å╪│╪« ╪º┘ä╪¼┘à┘ä ╪º┘ä┘à┘â╪▒╪▒╪⌐ ╪ú┘ê ╪▒╪ñ┘ê╪│ ╪º┘ä╪╡┘ü╪¡╪º╪¬ ╪Ñ┘ä╪º ╪╣┘å╪» ╪º┘ä╪¡╪º╪¼╪⌐.\n"
        "- ┘ä╪º ╪¬╪¬╪▒┘â ╪ú┘è ┘é╪│┘à ┘ü╪º╪▒╪║╪º┘ï ╪Ñ╪░╪º ┘â╪º┘å╪¬ ╪º┘ä┘à╪╣┘ä┘ê┘à╪º╪¬ ┘à╪¬╪º╪¡╪⌐ ┘ü┘è ╪º┘ä┘å╪╡.\n"
        "- ╪Ñ╪░╪º ┘ä┘à ╪¬╪¬┘ê┘ü╪▒ ╪º┘ä┘à╪╣┘ä┘ê┘à╪⌐ ┘ä┘é╪│┘à ┘à╪╣┘è┘å╪î ╪º┘â╪¬╪¿ ╪╡╪▒╪º╪¡╪⌐: '╪║┘è╪▒ ┘à╪░┘â┘ê╪▒ ┘ü┘è ╪º┘ä┘à╪│╪¬┘å╪»'.\n"
        "- ╪¬╪░┘â┘æ╪▒: ╪º┘ä╪¼╪»┘ê┘ä ╪º┘ä┘ê╪¡┘è╪» ╪º┘ä┘à╪│┘à┘ê╪¡ ╪¿┘ç ┘ü┘è ╪º┘ä╪Ñ╪«╪▒╪º╪¼ ┘ç┘ê ╪¼╪»┘ê┘ä (╪º┘ä╪ú╪╖╪▒╪º┘ü)╪î "
        "┘ê╪¼┘à┘è╪╣ ╪º┘ä╪ú┘é╪│╪º┘à ╪º┘ä╪ú╪«╪▒┘ë ┘è╪¼╪¿ ╪ú┘å ╪¬┘â┘ê┘å ┘å╪╡╪º┘ï ╪ú┘ê ┘å┘é╪º╪╖╪º┘ï ┘ü┘é╪╖.\n"
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
    logger.info(f"≡ƒöä Retrying chunk {chunk_num} with simplified prompt")
    
    simple_prompt = (
        "┘è╪▒╪¼┘ë ╪¬┘å╪╕┘è┘à ┘ê╪¬╪¡╪│┘è┘å ╪╡┘è╪º╪║╪⌐ ╪º┘ä┘å╪╡ ╪º┘ä╪¬╪º┘ä┘è ╪¿╪º┘ä┘ä╪║╪⌐ ╪º┘ä╪╣╪▒╪¿┘è╪⌐ ╪º┘ä┘ü╪╡╪¡┘ë. "
        "╪º╪¡╪¬┘ü╪╕ ╪¿╪¼┘à┘è╪╣ ╪º┘ä┘à╪╣┘ä┘ê┘à╪º╪¬ ┘ê╪º┘ä╪ú╪│┘à╪º╪í ┘ê╪º┘ä╪¬┘ê╪º╪▒┘è╪« ┘â┘à╪º ┘ç┘è ╪¿╪º┘ä╪╢╪¿╪╖╪î ┘ü┘é╪╖ ╪¡╪│┘æ┘å ╪º┘ä╪╡┘è╪º╪║╪⌐ ┘ê╪º┘ä╪¬┘å╪╕┘è┘à.\n\n"
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
            logger.warning(f"ΓÜá∩╕Å Content still filtered. Returning original text with note.")
            return f"[┘ä╪º ┘è┘à┘â┘å ╪Ñ╪╣╪º╪»╪⌐ ╪º┘ä╪╡┘è╪º╪║╪⌐ ╪¿╪│╪¿╪¿ ┘ü┘ä╪º╪¬╪▒ ╪º┘ä╪ú┘à╪º┘å]\n\n{chunk_text}"
        
        return response_body["output"]["message"]["content"][0]["text"]
        
    except Exception as e:
        logger.error(f"Retry failed for chunk {chunk_num}: {e}")
        # Last resort: return original with note
        return f"[┘ä┘à ╪¬╪¬┘à ╪Ñ╪╣╪º╪»╪⌐ ╪º┘ä╪╡┘è╪º╪║╪⌐ - ╪«╪╖╪ú ┘ü┘è ╪º┘ä┘à╪╣╪º┘ä╪¼╪⌐]\n\n{chunk_text}"


def call_bedrock_for_chunk(chunk_text: str, chunk_num: int, total_chunks: int) -> str:
    """Call Bedrock to rewrite a single chunk."""
    system_prompt, _ = build_rewrite_prompts("")

    user_prompt = (
        f"╪ú╪╣╪» ┘â╪¬╪º╪¿╪⌐ ╪º┘ä╪¼╪▓╪í ╪º┘ä╪¬╪º┘ä┘è ┘à┘å ╪¬┘é╪▒┘è╪▒ ╪º┘ä╪¬╪¡┘é┘è┘é (╪º┘ä╪¼╪▓╪í {chunk_num} ┘à┘å {total_chunks}). "
        "╪¡╪º┘ü╪╕ ╪╣┘ä┘ë ╪¼┘à┘è╪╣ ╪º┘ä╪¡┘é╪º╪ª┘é ┘ê╪º┘ä╪ú╪│┘à╪º╪í ┘ê╪º┘ä╪¬┘ê╪º╪▒┘è╪« ┘â┘à╪º ┘ç┘è.\n\n"
        f"{chunk_text}\n\n"
        "╪º┘â╪¬╪¿ ╪º┘ä┘å╪│╪«╪⌐ ╪º┘ä┘à╪╣╪º╪» ╪╡┘è╪º╪║╪¬┘ç╪º ╪¿╪º┘ä╪╣╪▒╪¿┘è╪⌐ ╪º┘ä┘ü╪╡╪¡┘ë ┘ü┘é╪╖."
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
            logger.warning(f"ΓÜá∩╕Å Content filtered by Bedrock. Trying alternative approach...")
            # Retry with simplified prompt
            return retry_with_simple_prompt(chunk_text, chunk_num, total_chunks)

        return response_body["output"]["message"]["content"][0]["text"]

    except Exception as e:
        error_str = str(e)
        logger.error(f"Chunk {chunk_num} failed: {error_str}")
        
        # Check if it's a content moderation error
        if "ValidationException" in error_str or "throttling" in error_str.lower():
            logger.warning(f"ΓÜá∩╕Å Bedrock error (possibly content moderation). Trying alternative approach...")
            return retry_with_simple_prompt(chunk_text, chunk_num, total_chunks)
        
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
    "┘à╪¿┘ä╪║", "┘à╪»╪╣┘ë ╪╣┘ä┘è┘ç", "┘à╪┤┘â┘ê┘ï┘ë ╪╣┘ä┘è┘ç", "┘à╪┤┘â┘ê ╪╣┘ä┘è┘ç", "╪┤╪º┘ç╪»", "┘à╪┤╪¬╪¿┘ç", "┘à╪░┘â┘ê╪▒",
    "┘à╪¼┘å┘è ╪╣┘ä┘è┘ç", "┘à╪¬┘ç┘à", "┘à╪¡╪º┘à┘è", "┘é╪º╪╢┘è", "┘à╪¡┘é┘é", "┘â╪º╪¬╪¿ ╪╢╪¿╪╖"
]

SECTION_KEYWORDS = [
    "┘à┘é╪»┘à╪⌐", "┘à┘ä╪«╪╡", "┘à┘ä╪«╪╡ ╪º┘ä╪¡╪º╪»╪½", "╪¬┘ü╪º╪╡┘è┘ä ╪º┘ä┘ê╪º┘é╪╣╪⌐", "┘ê┘é╪º╪ª╪╣ ╪º┘ä┘é╪╢┘è╪⌐", "╪ú┘é┘ê╪º┘ä",
    "╪º┘ä╪┤┘ç┘ê╪»", "╪ú┘é┘ê╪º┘ä ╪º┘ä╪┤╪º┘â┘è", "╪ú┘é┘ê╪º┘ä ╪º┘ä┘à╪»╪╣┘ë ╪╣┘ä┘è┘ç", "╪ú┘é┘ê╪º┘ä ╪º┘ä┘à╪¿┘ä╪║", "╪ú┘é┘ê╪º┘ä ╪º┘ä╪┤╪º┘ç╪»",
    "╪º┘ä╪¬╪¡┘é┘è┘é", "╪º┘ä╪¬┘é╪▒┘è╪▒", "╪º┘ä╪«╪º╪¬┘à╪⌐", "╪º┘ä╪╖┘ä╪¿╪º╪¬", "╪º┘ä┘é╪▒╪º╪▒", "╪ú╪╖╪▒╪º┘ü ╪º┘ä╪¿┘ä╪º╪║", "┘à╪│╪▒╪¡ ╪º┘ä╪¡╪º╪»╪½"
]


def extract_entities(text: str) -> Dict[str, Set[str]]:
    """Extract names, roles, case numbers, dates, times, IDs, locations from Arabic text."""
    names: Set[str] = set()

    # Naive Arabic name pattern (2-5 tokens of letters) ΓÇô conservative to reduce false positives
    for m in re.finditer(r"\b[\u0621-\u064A]{2,}(?:\s+[\u0621-\u064A]{2,}){1,4}\b", text):
        nm = m.group(0).strip()
        excluded_terms = (
            r"\b(┘à┘à┘ä┘â╪⌐|┘ê╪▓╪º╪▒╪⌐|╪º┘ä┘å┘è╪º╪¿╪⌐|╪º┘ä╪¿╪¡╪▒┘è┘å|╪┤╪▒╪╖╪⌐|┘é╪▒╪º╪▒|╪¿┘ä╪º╪║|╪º┘ä┘é╪╢┘è╪⌐|╪º┘ä╪¬╪¡┘é┘è┘é|╪º┘ä┘à╪¡┘â┘à╪⌐|"
            r"╪º┘ä╪¼┘å╪º╪ª┘è╪⌐|╪º┘ä╪╣╪º┘à╪⌐|╪º┘ä╪ú┘à┘å|╪º┘ä╪╣╪»┘ä|╪º┘ä┘é╪º┘å┘ê┘å|╪º┘ä╪¡┘â┘ê┘à╪⌐|╪º┘ä╪»╪º╪«┘ä┘è╪⌐|┘å┘è╪º╪¿╪⌐|┘à╪▒┘â╪▓ ╪┤╪▒╪╖╪⌐)\b"
        )
        if len(nm.split()) >= 2 and not re.search(excluded_terms, nm):
            names.add(nm)

    roles: Set[str] = set()
    for kw in ROLE_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", text):
            roles.add(kw)

    # Case number patterns
    case_numbers: Set[str] = set(
        re.findall(r"(?:╪▒┘é┘à\s*(?:╪º┘ä╪¿┘ä╪º╪║|╪º┘ä┘é╪╢┘è╪⌐)\s*[:∩╝Ü]?\s*(\d{2,}))", text)
    )

    # Dates: dd/mm/yyyy or dd-mm-yyyy or yyyy-mm-dd
    dates: Set[str] = set(
        re.findall(r"\b(?:\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}|\d{4}[\-/]\d{1,2}[\-/]\d{1,2})\b", text)
    )

    # Times: HH:MM(:SS)
    times: Set[str] = set(re.findall(r"\b\d{1,2}:\d{2}(?::\d{2})?\b", text))

    # National IDs: 9-12 digits
    national_ids: Set[str] = set(re.findall(r"\b\d{9,12}\b", text))

    # Locations: very crude detection via ╪¿╪╣╪» '┘ü┘è'/'╪¿┘Ç'
    locations: Set[str] = set()
    for m in re.finditer(
        r"\b(?:┘ü┘è|╪¿┘Ç)\s+([\u0621-\u064A]{2,}(?:\s+[\u0621-\u064A]{2,}){0,3})\b", text
    ):
        loc = m.group(1).strip()
        if not re.search(r"\b(╪º┘ä┘à╪░┘â┘ê╪▒|╪º┘ä┘à╪░┘â┘ê╪▒╪⌐|╪º┘ä┘à╪»╪╣┘ë|╪º┘ä╪┤╪º┘â┘è|╪º┘ä┘à╪¬┘ç┘à)\b", loc):
            locations.add(loc)

    sections: Set[str] = set()
    for kw in SECTION_KEYWORDS:
        # Allow heading followed by colon and either space or newline
        pattern = rf"\n\s*{re.escape(kw)}\s*[:∩╝Ü]?(?:\s|\n)"
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
    valid multi-page reports or repeated headers like ╪▒┘é┘à ╪º┘ä╪¿┘ä╪º╪║.
    """
    forbidden_heads = [
        r"^\s*╪¬┘é╪▒┘è╪▒ ╪º┘ä╪¬╪¡┘é┘è┘é ╪º┘ä╪▒╪│┘à┘è\s*$",
        r"^\s*╪¿┘è╪º┘å╪º╪¬ ╪º┘ä╪¬╪¡┘é┘è┘é\s*[:∩╝Ü]?\s*$"
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
        violations.append(f"╪ú╪│┘à╪º╪í ╪¼╪»┘è╪»╪⌐ ╪║┘è╪▒ ┘à┘ê╪¼┘ê╪»╪⌐ ┘ü┘è ╪º┘ä╪ú╪╡┘ä: {', '.join(sorted(extra_names))}")

    # New roles introduced
    extra_roles = new["roles"] - orig["roles"]
    if extra_roles:
        violations.append(f"╪ú╪»┘ê╪º╪▒ ╪¼╪»┘è╪»╪⌐ ╪║┘è╪▒ ┘à┘ê╪¼┘ê╪»╪⌐ ┘ü┘è ╪º┘ä╪ú╪╡┘ä: {', '.join(sorted(extra_roles))}")

    # Case number duplication/new
    if len(new["case_numbers"]) > len(orig["case_numbers"]) or (
        new["case_numbers"] - orig["case_numbers"]
    ):
        violations.append("╪▒┘é┘à ╪¿┘ä╪º╪║/┘é╪╢┘è╪⌐ ╪Ñ╪╢╪º┘ü┘è ╪ú┘ê ┘à╪«╪¬┘ä┘ü ╪¬┘à ╪Ñ╪»╪«╪º┘ä┘ç")

    # Missing critical info: names or case numbers removed
    missing_names = orig["names"] - new["names"]
    if missing_names:
        violations.append(
            f"╪¬┘à ╪¡╪░┘ü ╪¿╪╣╪╢ ╪º┘ä╪ú╪│┘à╪º╪í ┘à┘å ╪º┘ä┘å╪╡: {', '.join(sorted(missing_names))}"
        )

    missing_case_numbers = orig["case_numbers"] - new["case_numbers"]
    if missing_case_numbers:
        violations.append("╪¬┘à ╪¡╪░┘ü ╪▒┘é┘à ╪¿┘ä╪º╪║/┘é╪╢┘è╪⌐ ┘à┘ê╪¼┘ê╪» ┘ü┘è ╪º┘ä┘å╪╡ ╪º┘ä╪ú╪╡┘ä┘è")

    # Sections fabricated
    fabricated_sections = new["sections"] - orig["sections"]
    if fabricated_sections:
        violations.append(
            f"╪ú┘é╪│╪º┘à ┘à┘Å╪╢╪º┘ü╪⌐ ╪║┘è╪▒ ┘à┘ê╪¼┘ê╪»╪⌐ ┘ü┘è ╪º┘ä╪ú╪╡┘ä: {', '.join(sorted(fabricated_sections))}"
        )

    # Detect duplicated paragraphs
    para_counts: Dict[str, int] = {}
    for p in re.split(r"\n{2,}", rewritten):
        p = p.strip()
        if not p:
            continue
        para_counts[p] = para_counts.get(p, 0) + 1

    if any(c > 1 for c in para_counts.values()):
        violations.append("╪¬┘â╪▒╪º╪▒ ┘ü┘é╪▒╪º╪¬")

    # Sanitization steps: remove duplicates, run light boundary protection
    sanitized = remove_duplicated_paragraphs(rewritten)
    sanitized = case_boundary_protection(sanitized)

    # If violations exist, try removing some obviously fabricated lines
    if violations:
        lines = sanitized.splitlines()
        kept: List[str] = []
        for ln in lines:
            if re.search(r"\b(?:╪¬┘é╪▒┘è╪▒ ╪º┘ä╪¬╪¡┘é┘è┘é ╪º┘ä╪▒╪│┘à┘è|╪¿┘è╪º┘å╪º╪¬ ╪º┘ä╪¬╪¡┘é┘è┘é)\b", ln):
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
        
        logger.info(f"≡ƒöä Processing rewrite job {job_id} for session {session_id}")
        logger.info(f"≡ƒôï Event details: text={bool(text)}, s3_key={s3_key}")
        
        # Get input text
        if not text:
            if s3_key:
                # Check if s3_key is a folder or a file
                actual_key = s3_key
                
                # If it looks like a folder, find the text file inside
                if not s3_key.endswith('.txt'):
                    logger.info(f"≡ƒôü s3_key appears to be a folder: '{s3_key}'")
                    
                    # First try to find .txt file in the specified folder
                    found_key = find_text_file_in_folder(BUCKET_NAME, s3_key)
                    
                    # If no .txt file found in specified folder, try the latest folder
                    if not found_key:
                        logger.warning(f"ΓÜá∩╕Å No .txt file in specified folder, searching latest folder...")
                        latest_folder = find_latest_extracted_folder(BUCKET_NAME)
                        
                        if latest_folder:
                            logger.info(f"≡ƒöä Trying latest folder: {latest_folder}")
                            found_key = find_text_file_in_folder(BUCKET_NAME, latest_folder)
                    
                    if not found_key:
                        logger.error(f"Γ¥î No .txt file found in folder: {s3_key} or latest folder")
                        update_job_status(job_id, "FAILED", {
                            "error": f"No .txt file found. Please ensure text has been extracted from the document.",
                            "sessionId": session_id,
                            "searchedPath": s3_key
                        })
                        return
                    
                    actual_key = found_key
                    logger.info(f"Γ£à Using file: {actual_key}")
                
                text = read_text_from_s3(BUCKET_NAME, actual_key)
                logger.info(f"Γ₧í Loaded text from S3: {get_safe_log_info(text, session_id)}")
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
        result_key = save_rewritten_result(job_id, session_id, rewritten_text, len(text))
        
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
        
        logger.info(f"Γ£à Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Γ¥î Error processing job {job_id}: {e}", exc_info=True)
        
        if job_id:
            update_job_status(job_id, "FAILED", {
                "error": str(e),
                "errorType": type(e).__name__
            })
