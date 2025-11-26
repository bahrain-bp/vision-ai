import boto3
import json
import os

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]

def handler(event, context):
    try:
        params = event.get("queryStringParameters") or {}
        case_id = params.get("caseId")
        if not case_id:
            return error(400, "caseId is required")

        prefix = f"DetectContradiction/cases/{case_id}/interviews/"
        keys = list_all_keys(BUCKET, prefix)
        witnesses = [k.split("/")[-1].replace(".txt", "") for k in keys if k.endswith(".txt")]

        return ok({"witnesses": sorted(witnesses)})
    except Exception as e:
        print("ERROR:", repr(e))
        return error(500, "An internal error occurred.")

def list_all_keys(bucket, prefix):
    paginator = s3.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys

def ok(body):
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        },
        "body": json.dumps(body)
    }

def error(code, msg):
    return {
        "statusCode": code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
        },
        "body": json.dumps({"error": msg})
    }
