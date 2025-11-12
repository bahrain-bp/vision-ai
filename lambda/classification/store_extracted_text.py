import json

def handler(event, context):
    try:

        return {
            'statusCode': 200
        }
    except:
        return {
            'statusCode': 400
        }