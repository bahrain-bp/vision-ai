# Types Directory

## File Organization

### `auth.ts` - Authentication
- ErrorWithMessage
- AuthResult
- ErrorMap

### `session.ts` - Session Management
- SessionData
- SetupData
- SessionPageProps

### `identity.ts` - Identity Verification
- IdentityData
- InvestigationData
- WitnessData
- VerificationData
- IdentityVerificationProps
- WitnessInfoProps
- DocumentUploadProps
- DocumentVerificationProps

### `transcription.ts` - Transcription
- TranscriptLine
- TranslationLine

### `translation.ts` - Translation
- TranslationSettings
- TranslationSettingsProps

### `components.ts` - Component Props
- LoginComponentProps
- SignupComponentProps
- ConfirmSignupComponentProps
- AuthenticatedComponentProps
- AuthenticationProps
- ForgetPasswordProps
- HomePageProps
- ProcessingViewProps
- RealTimeViewProps
- SessionInfoProps
- SessionSummaryModalProps
- AIAssistantProps

### `common.ts` - Shared Types
- User
- SessionState

## Usage
```typescript
import { User, SessionData, IdentityData } from '@/types';
```

## Adding New Types

1. Find the correct file by domain
2. Add your interface/type
3. Done! Auto-exported via index.ts