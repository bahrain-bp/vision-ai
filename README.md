# Vision‑AI — Project README

## Project summary

- Name: Vision‑AI  
- Type: Cloud-backed web application (React frontend + AWS infrastructure via CDK in Python) demonstrating multimedia analysis, transcription, translation and case management workflows.  
- Repo layout: CDK app entry: `app.py`. Infrastructure stacks: `vision_ai`. Frontend source: `src`.

## Prerequisites

- Node.js (recommended LTS >= 18) and npm installed.
- Python 3.8+.
- AWS CLI installed and configured (`aws configure`).
- AWS CDK v2 installed globally:
  - npm: `npm install -g aws-cdk@2`
- Recommended: use a Node version manager (nvm) and a Python virtualenv.

## Quick setup — Backend (CDK / Python)

1. Create virtual environment (repo root):
   - Windows (cmd): `python -m venv .venv`
   - macOS / Linux: `python3 -m venv .venv`
2. Activate venv:
   - Windows (cmd): `.venv\Scripts\activate.bat`
   - Windows (PowerShell): `.venv\Scripts\Activate.ps1`
   - macOS / Linux: `source .venv/bin/activate`
3. Install Python dependencies:
   - `pip install -r requirements.txt`
4. Bootstrap CDK (one-time per account/region):
   - `cdk bootstrap aws://ACCOUNT_ID/REGION`
5. Synthesize / Deploy stacks:
   - Synthesize: `cdk synth`
   - Deploy: `cdk deploy` (or `cdk deploy --all` to deploy every stack)

Notes: Stack definitions are in the `vision_ai` folder and entry is `app.py`.

## Quick setup — Frontend (development & deploy)

1. Install dependencies and run dev server:
   - `cd frontend && npm install`
   - `cd frontend && npm start`
   - Open http://localhost:3000 to view the app in development.
2. Build production artifacts:
   - `cd frontend && npm run build`
3. Deploy frontend via CDK:
   - `cd frontend && npm run deploy:frontend`
   - (This npm script should build and run `cdk deploy` for the frontend stack.)

## Available npm scripts (see `frontend/package.json`)

- `start` — start dev server.
- `build` — create production build.
- `test` — run frontend tests.
- `deploy:frontend` — build + CDK deploy for frontend stack.

Important note about analysis
- There is no `npm run analysis` defined by default. Use `npm start` for development or `npm run build` for production. If you want a custom analysis script for grading (e.g., static analysis or a demo runner), tell me the exact command(s) and I can add it.

## Running tests

- Python unit tests (example): `python -m unittest discover`
- Frontend tests: `cd frontend && npm test`

## Configuration

- Frontend AWS/config endpoints: edit `aws-config.ts` to point to correct API endpoints/region/identity settings.
- Environment variables: export or set any AWS keys or runtime env vars required before starting/deploying.

## Grading checklist (quick actions for instructor)

Local evaluation:
1. Create/activate venv, `pip install -r requirements.txt`.
2. `cdk synth` (verify stacks) and optionally `cdk deploy` to deploy resources.
3. `cd frontend && npm install && npm start` then open http://localhost:3000.

Deployed evaluation:
1. `cdk deploy --all` to deploy infra and services.
2. `cd frontend && npm run deploy:frontend` to build & publish frontend.
3. Verify core flows: upload/video transcription, classification, case creation, and any sample datasets in lambda or tests.

## Troubleshooting & tips

- AWS permissions: ensure the AWS credentials used can create CloudFormation, S3, Lambda, IAM, API Gateway, and other resources.
- CORS / endpoints: if frontend cannot reach API, check CORS settings and endpoints in `aws-config.ts`.
- Version mismatches: if `npm install`/`build` fails, use nvm to match the Node version used in development.
- Long deployments: CDK deploy can take several minutes — watch the CloudFormation console for errors.

## Files of interest

- CDK entry: `app.py`
- Infrastructure stacks: `vision_ai`
- Frontend source: `src`
- Frontend package metadata: `frontend/package.json`

## Contributing & administrative actions

- Add an `analysis` npm script (optional): edit `frontend/package.json` and add an entry under `scripts`, for example:
  {
    "scripts": {
      // ...existing scripts...
      "analysis": "npm run lint && npm test"
    }
  }
  Adjust the command to the exact behavior required for grading or CI.

- Commit this README to the repository:
  - Stage and commit:
    git add README.md
    git commit -m "docs: update project README"
    git push

- Contact / follow-up: For additional automated changes (e.g., add the `analysis` script via a pull request), provide the exact command(s) desired and the target file; maintainers can apply and review the change via normal Git workflow.
