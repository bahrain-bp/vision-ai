import boto3

client = boto3.client('apigateway', region_name='us-east-1')
response = client.get_rest_apis()

print("All APIs in your account:\n")
for api in response['items']:
    api_id = api['id']
    api_name = api['name']
    print(f"Name: {api_name}")
    print(f"ID: {api_id}")
    print(f"Endpoint: https://{api_id}.execute-api.us-east-1.amazonaws.com/prod/rewrite")
    print("-" * 60)

if not response['items']:
    print("No APIs found. Deploy the stack first.")
