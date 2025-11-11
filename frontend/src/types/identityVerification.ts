// ==========================================
// PERSON TYPES
// ==========================================

export type PersonType = "witness" | "accused" | "victim";
export type DocumentType = "cpr" | "passport";
export type VerificationStatus = "VERIFIED" | "NOT_VERIFIED";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// ==========================================
// DATA STRUCTURES
// ==========================================

export interface IdentityData {
  referencePhoto: File | null;
  cpr: File | null;
  passport: File | null;
  isVerified: boolean;
}

export interface InvestigationData {
  witness: string;
  idNumber: string;
  identityData: IdentityData;
  investigator: string;
  duration: string;
  status: string;
  caseId: string;
  sessionId: string;
}

// ==========================================
// API REQUEST/RESPONSE TYPES
// ==========================================

export interface UploadUrlRequest {
  caseId: string;
  sessionId: string;
  fileType: string;
  fileName: string;
  uploadType: "document" | PersonType;
  personType?: PersonType;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  bucket: string;
  uploadType: string;
  personType?: string;
  expiresIn: number;
}

export interface VerificationRequest {
  caseId: string;
  sessionId: string;
  documentKey: string;
  personPhotoKey: string;
  personType: PersonType;
  personName?: string;
}

export interface VerificationResponse {
  success: boolean;
  cprNumber: string;
  personType: string;
  personName: string;
  extractedName: string;
  providedName: string;
  nationality: string;
  photoSource: string;
  match: boolean;
  similarity: number;
  confidence: ConfidenceLevel;
  status: VerificationStatus;
  sessionMetadataKey: string;
  verificationSummaryKey: string;
  verificationResultKey: string;
}

export interface ApiError {
  error: string;
  details?: string;
  code?: string;
}

// ==========================================
// COMPONENT PROPS
// ==========================================

export interface IdentityVerificationProps {
  onBackToDashboard?: () => void;
  onStartInvestigation: (data: InvestigationData) => void;
}

export interface DocumentVerificationProps {
  identityData: IdentityData;
  onIdentityDataChange: (
    field: keyof IdentityData,
    value: File | boolean | null
  ) => void;
  onStartInvestigation: () => void;
  caseId: string;
  sessionId: string;
  personType: PersonType;
}

// ==========================================
// STATE TYPES
// ==========================================

export interface UploadProgress {
  document: number;
  photo: number;
}

export interface FileValidation {
  valid: boolean;
  error?: string;
}

export interface VerificationState {
  isUploading: boolean;
  isVerifying: boolean;
  uploadProgress: UploadProgress;
  error: string | null;
  verificationResult: VerificationResponse | null;
}

// ==========================================
// UTILITY TYPES
// ==========================================

export type ProgressCallback = (progress: number) => void;

export interface ServiceConfig {
  apiBaseUrl: string;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  uploadTimeout: number;
  maxRetries?: number;
  retryDelay?: number;
}

// ==========================================
// CONSTANTS
// ==========================================

export const DEFAULT_CONFIG: ServiceConfig = {
  apiBaseUrl: process.env.REACT_APP_API_ENDPOINT || "",
  maxFileSizeMB: 10,
  allowedFileTypes: ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
  uploadTimeout: 300000, // 5 minutes
  maxRetries: 3,
  retryDelay: 1000,
};
