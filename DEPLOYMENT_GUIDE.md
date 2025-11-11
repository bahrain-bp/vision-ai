# Document Rewriting System - Deployment Guide

## System Overview
Intelligent document rewriting system using AWS Bedrock Nova Lite that enhances investigation reports by improving clarity, structure, and professional presentation.

## Architecture Components
- **API Gateway**: RESTful endpoint `/rewrite` for document processing
- **Lambda Function**: Processes rewriting requests using AWS Bedrock
- **AWS Bedrock**: Nova Lite model (amazon.nova-lite-v1:0) for content enhancement
- **S3 Storage**: Private bucket in us-east-1 for storing rewritten documents

## Prerequisites
- AWS Account with credentials configured
- AWS CDK installed
- Python 3.12+
- Bedrock model access enabled (Nova Lite)

## Deployment Steps

### 1. Activate Virtual Environment
```bash
.venv\Scripts\activate.bat
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Bootstrap CDK (First Time Only)
```bash
cdk bootstrap aws://052904446370/us-east-1
```

### 4. Synthesize CloudFormation Template
```bash
cdk synth
```

### 5. Deploy All Stacks
```bash
cdk deploy --all
```

Or deploy only the rewrite stack:
```bash
cdk deploy vision-ai-rewrite-stack vision-ai-api-deployment-stack
```

### 6. Note the Outputs
After deployment, save these outputs:
- `APIEndpoint`: Your API Gateway URL
- `RewriteBucketName`: S3 bucket name
- `RewriteLambdaArn`: Lambda function ARN

## API Usage

### Endpoint
```
POST https://{api-id}.execute-api.us-east-1.amazonaws.com/prod/rewrite
```

### Request Format
```json
{
  "document_text": "Your investigation report text here..."
}
```

### Response Format
```json
{
  "rewritten_text": "Enhanced version of the report...",
  "s3_location": "s3://bucket-name/rewritten/20241106_120000_report.txt"
}
```

### Example with cURL
```bash
curl -X POST https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/rewrite \
  -H "Content-Type: application/json" \
  -d "{\"document_text\": \"Investigation report text here\"}"
```

## Testing

### 1. Update Test Script
Edit `test_rewrite.py` and replace `YOUR_API_ID` with your actual API Gateway ID from deployment outputs.

### 2. Install Test Dependencies
```bash
pip install requests
```

### 3. Run Test
```bash
python test_rewrite.py
```

## Project Structure
```
vision-ai/
├── lambda/
│   └── rewrite_document/
│       ├── rewrite_handler.py      # Lambda function code
│       └── requirements.txt         # Lambda dependencies
├── vision_ai/
│   └── rewrite_stack.py            # CDK stack definition
├── app.py                          # CDK app entry point
├── test_rewrite.py                 # API test script
└── DEPLOYMENT_GUIDE.md             # This file
```

## Troubleshooting

### Bedrock Access Denied
Enable Bedrock model access in AWS Console:
1. Go to AWS Bedrock Console
2. Navigate to Model Access
3. Enable "Amazon Nova Lite"

### Lambda Timeout
If processing large documents, increase timeout in `rewrite_stack.py`:
```python
timeout=Duration.seconds(300)  # Adjust as needed
```

### S3 Permission Issues
Verify Lambda has proper IAM permissions to write to S3 bucket.

## Clean Up
To remove all resources:
```bash
cdk destroy --all
```

## Cost Considerations
- API Gateway: Pay per request
- Lambda: Pay per invocation and duration
- Bedrock: Pay per token processed
- S3: Pay for storage and requests

## Security Notes
- S3 bucket is private with encryption enabled
- API Gateway has CORS enabled
- Lambda has minimal IAM permissions
- No authentication required (add Cognito if needed)
