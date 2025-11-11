import requests
import json

# API endpoint
API_ENDPOINT = "https://mt75f6p0rh.execute-api.us-east-1.amazonaws.com/prod/rewrite"

test_document = """
Investigation Report - Case #12345

Incident Date: November 5, 2024
Location: Downtown Office Building

Summary:
Security breach detected at 2:30 PM. Multiple witnesses interviewed. 
Suspect seen entering through side door. Video footage reviewed.
Evidence collected and stored.

Witness Statements:
- John Doe: Saw suspicious person
- Jane Smith: Heard unusual noises

Conclusion:
Further investigation needed.
"""

payload = {
    "document_text": test_document
}

try:
    response = requests.post(API_ENDPOINT, json=payload, headers={'Content-Type': 'application/json'})
    
    print(f"Status Code: {response.status_code}")
    print(f"\nResponse:")
    print(json.dumps(response.json(), indent=2))
    
except Exception as e:
    print(f"Error: {str(e)}")
