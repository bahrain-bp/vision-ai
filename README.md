# CIC Innovation Center - VisionAI PoC

### 📁 **Project Structure**

```

CIC-VisionAI-PoC/
│── frontend/                # React app (S3-hosted website)
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── .gitignore
│   ├── README.md
│   ├── build/               # React build output (deployed to S3)
│── lambda/                  # Lambda function code
│   ├── index.js             # Simple "Hello, World!" function
│   ├── package.json
│── bin/
│   ├── my-cdk-app.ts        # CDK entry point
│── lib/
│   ├── my-cdk-app-stack.ts  # CDK stack defining S3, API Gateway, and Lambda
│── cdk.json                 # CDK config
│── package.json             # CDK dependencies
│── tsconfig.json            # TypeScript config
│── .gitignore
│── README.md

```

### **Project Structure Breakdown:**

##### 1. **Frontend (`frontend/`)**

The `frontend/` directory contains the React app that is built and hosted on S3. When you run `npm run build`, it generates a production-ready build inside the `frontend/build/` folder.

- **public/**: Contains static assets that are publicly available, such as HTML files, images, and fonts. The `index.html` file serves as the entry point for your app.
- **src/**: The source code for your React app, including components, utilities, styles, and other JavaScript files.
- **package.json**: Manages dependencies, scripts, and configurations for your React app.
- **.gitignore**: Lists files and directories that should be ignored by Git (e.g., `node_modules/`).
- **README.md**: Contains documentation specific to your React frontend, describing setup, usage, and other relevant details.
- **build/**: The output folder where your production build is stored. These static files are later uploaded to an S3 bucket for hosting.

##### 2. **Lambda Functions (`lambda/`)**

The `lambda/` directory contains the Lambda function code, which is part of your backend. In your case, the `index.js` file contains a simple "Hello, World!" function, but this will likely be expanded to serve as the backend for your React app.

- **index.js**: This is where your Lambda function is defined. It currently includes a simple "Hello, World!" function that can be extended to perform more complex tasks like interacting with a database or handling API requests.
- **package.json**: Manages any Node.js dependencies specific to your Lambda functions.

##### 3. **CDK Infrastructure (`bin/` and `lib/`)**

The `bin/` and `lib/` directories are where your AWS Cloud Development Kit (CDK) application lives.

- **bin/**: The entry point for your CDK app, typically a file like `my-cdk-app.ts`. This file defines which stack/s are to be deployed.
- **lib/**: Contains the CDK stacks, where you define the resources (S3, API Gateway, Lambda) that will be deployed to AWS. In your case, `my-cdk-app-stack.ts` is where the CDK resources such as the S3 bucket, API Gateway, and Lambda function are defined.

##### 4. **CDK Configuration (`cdk.json`, `package.json`, `tsconfig.json`)**

These files handle the configuration and dependencies for your CDK setup.

- **cdk.json**: Contains the configuration for your CDK app, including the environment settings and which file to run as the entry point for the app.
- **package.json**: Defines the dependencies for the CDK project itself, including AWS SDK and other libraries.
- **tsconfig.json**: TypeScript configuration file for the CDK project, allowing you to use TypeScript for defining your AWS resources.

## Prerequisites 

Before getting started, ensure you have the following installed:

AWS CLI: Follow the installation guide here: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html 



## 🚀 Getting Started

Follow these steps to set up and deploy the project:

#### 📥 Clone the Repository

Clone this repository into your local environment. 


#### 📌 Install AWS CDK globally

```
npm install -g aws-cdk
```

#### 📌 Install AWS CDK library

```
npm install aws-cdk-lib
```

#### 🛠 Fix any security vulnerabilities

```
npm audit fix
```

#### 📂 Navigate to the frontend directory

```
cd frontend
```

#### 📌 Install frontend dependencies
```
npm install
```
```
npm install web-vitals
```
```
npm audit fix --force
```
```
npm install react-scripts --save-dev
```
```
npm run build
```

#### 🔙 Return to the root directory

```
cd ..
```

#### 🚀 Deploy the CDK application

```
cdk deploy --all
```

#### ⚠️ Notes for development 

Ensure you are authenticated with AWS before running cdk deploy.

If you encounter permission errors, check your AWS IAM roles or NCSC boundaries/policies.

  **After successful initial deployment:**
  1. Copy your API Endpoint URL from your API stack deployment outputs
  2. Go to ```frontend > src > app.js```
  3. Replace YOUR_API_GATEWAY_URL, line 8 with your own API endpoint
  4. Build the React App:```npm run build```
  6. Sync the Build Files to S3:```aws s3 sync build/ s3://your-bucket-name --delete```
  7. **if needed** Invalidate CloudFront Cache:```aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"```









