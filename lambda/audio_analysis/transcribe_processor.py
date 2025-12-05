import json
import boto3
import os
import time
import uuid
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
transcribe = boto3.client('transcribe')
translate = boto3.client('translate')

BUCKET_NAME = os.environ['BUCKET_NAME']

def handler(event, context):
    """
    Process transcription (invoked by Step Function)
    Input: { "s3Key": "...", "resultKey": "..." }
    """
    try:
        s3_key = event['s3Key']
        result_key = event['resultKey']
        
        logger.info(f"Processing transcription for {s3_key}")
        
        # Start transcription job
        job_name = f"transcribe-{uuid.uuid4()}"
        s3_uri = f"s3://{BUCKET_NAME}/{s3_key}"
        
        transcribe.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={'MediaFileUri': s3_uri},
            MediaFormat=get_media_format(s3_key),
            IdentifyLanguage=True
        )
        
        # Wait for completion
        while True:
            status = transcribe.get_transcription_job(TranscriptionJobName=job_name)
            job_status = status['TranscriptionJob']['TranscriptionJobStatus']
            
            if job_status == 'COMPLETED':
                break
            elif job_status == 'FAILED':
                raise Exception('Transcription failed')
            
            time.sleep(5)
        
        # Get transcript
        transcript_uri = status['TranscriptionJob']['Transcript']['TranscriptFileUri']
        import urllib.request
        with urllib.request.urlopen(transcript_uri) as response:
            transcript_data = json.loads(response.read())
        
        original_text = transcript_data['results']['transcripts'][0]['transcript']
        detected_language = status['TranscriptionJob'].get('LanguageCode', 'en')
        
        # Translate to Arabic
        if detected_language != 'ar':
            translation = translate.translate_text(
                Text=original_text,
                SourceLanguageCode=detected_language,
                TargetLanguageCode='ar'
            )
            arabic_text = translation['TranslatedText']
        else:
            arabic_text = original_text
        
        # Save result to S3
        result = {
            'status': 'COMPLETED',
            'transcription': arabic_text,
            'originalLanguage': detected_language
        }
        
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=result_key,
            Body=json.dumps(result, ensure_ascii=False),
            ContentType='application/json'
        )
        
        # Cleanup
        transcribe.delete_transcription_job(TranscriptionJobName=job_name)
        
        logger.info(f"Completed transcription for {s3_key}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        
        # Save error to S3
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=result_key,
            Body=json.dumps({'status': 'FAILED', 'error': str(e)}),
            ContentType='application/json'
        )
        
        raise

def get_media_format(s3_key):
    extension = s3_key.lower().split('.')[-1]
    format_map = {
        'mp3': 'mp3', 'mp4': 'mp4', 'wav': 'wav',
        'flac': 'flac', 'ogg': 'ogg', 'm4a': 'mp4'
    }
    return format_map.get(extension, 'mp3')
