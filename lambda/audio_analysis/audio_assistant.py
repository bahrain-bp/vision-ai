import json
import boto3
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

def handler(event, context):
    try:
        body = json.loads(event.get('body', '{}'))
        transcription = body.get('transcription')
        
        if not transcription:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({'error': 'transcription is required'})
            }
        
        system_prompt = """أنت محلل صوتي ذكي متخصص في تحليل التسجيلات الصوتية.
قم بتحليل النص وإنشاء ملخص شامل يتضمن:
1. الموضوع الرئيسي
2. النقاط الرئيسية
3. أي معلومات مهمة أو تفاصيل بارزة

قدم الملخص باللغة العربية بشكل واضح ومنظم."""

        user_prompt = f"""قم بتحليل وتلخيص النص التالي:

{transcription}

أعطني الملخص فقط:"""

        request_body = {
            "system": [{"text": system_prompt}],
            "messages": [
                {"role": "user", "content": [{"text": user_prompt}]}
            ],
            "inferenceConfig": {"maxTokens": 1024, "temperature": 0.3, "topP": 0.9}
        }
        
        response = bedrock.invoke_model(
            modelId='amazon.nova-lite-v1:0',
            body=json.dumps(request_body)
        )
        
        response_body = json.loads(response['body'].read())
        summary = response_body['output']['message']['content'][0]['text']
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'summary': summary}, ensure_ascii=False)
        }
    
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({'error': str(e)})
        }
