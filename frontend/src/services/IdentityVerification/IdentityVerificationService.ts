import axios, { AxiosError, AxiosRequestConfig } from "axios";
import {
  UploadUrlRequest,
  UploadUrlResponse,
  VerificationRequest,
  VerificationResponse,
  ApiError,
  PersonType,
  FileValidation,
  ProgressCallback,
  DEFAULT_CONFIG,
} from "../../types/identityVerification";

// API Configuration with defaults
const API_BASE_URL =
  process.env.REACT_APP_API_ENDPOINT ||
  "https://yphcka81y6.execute-api.us-east-1.amazonaws.com/prod";

export class IdentityVerificationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "IdentityVerificationError";
  }
}

// Request configuration with timeout
const REQUEST_CONFIG: AxiosRequestConfig = {
  timeout: DEFAULT_CONFIG.uploadTimeout,
  timeoutErrorMessage: "Request timeout occurred",
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get MIME type from file with fallback
 */
const getFileMimeType = (file: File): string => {
  return file.type || "application/octet-stream";
};

const handleApiError = (error: unknown, context: string): never => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    const status = axiosError.response?.status;
    const errorMessage = axiosError.response?.data?.error || axiosError.message;
    const errorDetails = axiosError.response?.data?.details;

    const logContext = {
      context,
      message: errorMessage,
      details: errorDetails,
      status,
      url: axiosError.config?.url,
    };

    console.error(`API Error in ${context}:`, logContext);

    // Handle specific HTTP status codes
    if (status === 401) {
      throw new IdentityVerificationError(
        "Authentication failed",
        "AUTH_ERROR",
        errorDetails,
        error
      );
    } else if (status === 403) {
      throw new IdentityVerificationError(
        "Access forbidden",
        "FORBIDDEN",
        errorDetails,
        error
      );
    } else if (status === 429) {
      throw new IdentityVerificationError(
        "Too many requests",
        "RATE_LIMITED",
        errorDetails,
        error
      );
    } else if (status && status >= 500) {
      throw new IdentityVerificationError(
        "Server error occurred",
        "SERVER_ERROR",
        errorDetails,
        error
      );
    }

    throw new IdentityVerificationError(
      errorMessage || "An unexpected error occurred",
      "API_ERROR",
      errorDetails,
      error
    );
  }

  if (error instanceof IdentityVerificationError) {
    throw error;
  }

  console.error(`Unexpected error in ${context}:`, error);
  throw new IdentityVerificationError(
    "An unexpected error occurred. Please try again.",
    "UNKNOWN_ERROR",
    undefined,
    error
  );
};

/**
 * Validate upload progress callback
 */
const validateProgressCallback = (callback?: ProgressCallback): void => {
  if (callback && typeof callback !== "function") {
    console.warn("Invalid progress callback provided");
  }
};

// ==========================================
// API METHODS
// ==========================================

/**
 * Generate presigned URL for document or photo upload
 */
export const getUploadUrl = async (
  caseId: string,
  sessionId: string,
  file: File,
  uploadType: "document" | PersonType,
  personType?: PersonType
): Promise<UploadUrlResponse> => {
  try {
    console.log("Requesting upload URL:", {
      caseId,
      sessionId,
      fileName: file.name,
      fileSize: file.size,
      uploadType,
      personType,
    });

    const requestBody: UploadUrlRequest = {
      caseId,
      sessionId,
      fileType: getFileMimeType(file),
      fileName: file.name,
      uploadType,
      ...(personType && { personType }),
    };

    const response = await axios.post<UploadUrlResponse>(
      `${API_BASE_URL}/identity/upload-url`,
      requestBody,
      {
        ...REQUEST_CONFIG,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Upload URL generated successfully:", {
      s3Key: response.data.s3Key,
      expiresIn: response.data.expiresIn,
      uploadType: response.data.uploadType,
    });

    return response.data;
  } catch (error) {
    return handleApiError(error, "getUploadUrl");
  }
};

/**
 * Upload file to S3 using presigned URL
 */
export const uploadFileToS3 = async (
  presignedUrl: string,
  file: File,
  onProgress?: ProgressCallback
): Promise<void> => {
  try {
    validateProgressCallback(onProgress);

    console.log("Uploading file to S3:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });

    await axios.put(presignedUrl, file, {
      ...REQUEST_CONFIG,
      headers: {
        "Content-Type": getFileMimeType(file),
        "Content-Length": file.size.toString(),
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });

    console.log("File uploaded successfully to S3");
  } catch (error) {
    console.error("S3 upload failed:", error);

    if (axios.isAxiosError(error) && error.code === "ECONNABORTED") {
      throw new IdentityVerificationError(
        "Upload timeout. Please try again.",
        "UPLOAD_TIMEOUT",
        undefined,
        error
      );
    }

    throw new IdentityVerificationError(
      "Failed to upload file. Please try again.",
      "UPLOAD_FAILED",
      undefined,
      error
    );
  }
};

/**
 * Complete document upload workflow with validation
 */
export const uploadDocument = async (
  caseId: string,
  sessionId: string,
  file: File,
  onProgress?: ProgressCallback
): Promise<string> => {
  try {
    validateProgressCallback(onProgress);

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new IdentityVerificationError(
        validation.error!,
        "FILE_VALIDATION_FAILED"
      );
    }

    // Step 1: Get presigned URL
    const uploadUrlResponse = await getUploadUrl(
      caseId,
      sessionId,
      file,
      "document"
    );

    // Step 2: Upload file to S3
    await uploadFileToS3(uploadUrlResponse.uploadUrl, file, onProgress);

    // Step 3: Return S3 key for verification
    return uploadUrlResponse.s3Key;
  } catch (error) {
    console.error("Document upload workflow failed:", error);
    throw error;
  }
};

/**
 * Complete person photo upload workflow
 */
export const uploadPersonPhoto = async (
  caseId: string,
  sessionId: string,
  file: File,
  personType: PersonType,
  onProgress?: ProgressCallback
): Promise<string> => {
  try {
    validateProgressCallback(onProgress);

    // Validate file before upload
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new IdentityVerificationError(
        validation.error!,
        "FILE_VALIDATION_FAILED"
      );
    }

    // Step 1: Get presigned URL
    const uploadUrlResponse = await getUploadUrl(
      caseId,
      sessionId,
      file,
      personType,
      personType
    );

    // Step 2: Upload file to S3
    await uploadFileToS3(uploadUrlResponse.uploadUrl, file, onProgress);

    // Step 3: Return S3 key for verification
    return uploadUrlResponse.s3Key;
  } catch (error) {
    console.error("Person photo upload workflow failed:", error);
    throw error;
  }
};

/**
 * Trigger identity verification workflow
 */
export const verifyIdentity = async (
  request: VerificationRequest
): Promise<VerificationResponse> => {
  try {
    console.log("Triggering identity verification:", {
      caseId: request.caseId,
      sessionId: request.sessionId,
      personType: request.personType,
      personName: request.personName || "Will be extracted",
      attemptNumber: request.attemptNumber || 1,
      manualOverride: request.manualOverride || false,
    });

    const response = await axios.post<VerificationResponse>(
      `${API_BASE_URL}/identity/verify`,
      request,
      {
        ...REQUEST_CONFIG,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Identity verification completed:", {
      success: response.data.success,
      match: response.data.match,
      similarity: response.data.similarity,
      status: response.data.status,
      extractedName: response.data.extractedName,
      cprNumber: response.data.cprNumber,
      nationality: response.data.nationality,
      attemptNumber: response.data.attemptNumber,
      manualOverride: response.data.manualOverride,
    });

    return response.data;
  } catch (error) {
    return handleApiError(error, "verifyIdentity");
  }
};

/**
 * Complete identity verification workflow
 */
export const completeIdentityVerification = async (
  caseId: string,
  sessionId: string,
  documentFile: File,
  personPhotoFile: File,
  personType: PersonType,
  personName?: string,
  onDocumentProgress?: ProgressCallback,
  onPhotoProgress?: ProgressCallback,
  attemptNumber: number = 1
): Promise<VerificationResponse> => {
  try {
    console.log("Starting complete identity verification workflow", {
      caseId,
      sessionId,
      personType,
      documentFile: documentFile.name,
      personPhotoFile: personPhotoFile.name,
      attemptNumber,
    });

    validateProgressCallback(onDocumentProgress);
    validateProgressCallback(onPhotoProgress);

    // Step 1: Upload document
    console.log("Step 1: Uploading document...");
    const documentKey = await uploadDocument(
      caseId,
      sessionId,
      documentFile,
      onDocumentProgress
    );
    console.log("Document uploaded:", documentKey);

    // Step 2: Upload person photo
    console.log("Step 2: Uploading person photo...");
    const personPhotoKey = await uploadPersonPhoto(
      caseId,
      sessionId,
      personPhotoFile,
      personType,
      onPhotoProgress
    );
    console.log("Person photo uploaded:", personPhotoKey);

    // Step 3: Trigger verification
    console.log("Step 3: Triggering verification...");
    const verificationResult = await verifyIdentity({
      caseId,
      sessionId,
      documentKey,
      personPhotoKey,
      personType,
      attemptNumber,
      ...(personName && { personName }),
    });

    console.log("Verification complete:", {
      status: verificationResult.status,
      match: verificationResult.match,
      similarity: verificationResult.similarity,
      attemptNumber: verificationResult.attemptNumber,
    });

    return verificationResult;
  } catch (error) {
    console.error("Complete identity verification workflow failed:", error);
    throw error;
  }
};

/**
 * Delete previous verification files when retrying
 */
export const deletePreviousVerificationFiles = async (
  caseId: string,
  sessionId: string,
  personType: PersonType,
  attemptNumber: number
): Promise<void> => {
  try {
    console.log(
      `Deleting previous verification files for attempt ${attemptNumber}`
    );

    const deleteRequest = {
      caseId,
      sessionId,
      personType,
      attemptNumber,
    };

    await axios.delete(`${API_BASE_URL}/identity/cleanup`, {
      data: deleteRequest,
      ...REQUEST_CONFIG,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Previous verification files deleted successfully");
  } catch (error) {
    console.error("Error deleting previous verification files:", error);
    // Don't throw error - allow retry to continue even if cleanup fails
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Validate file before upload
 */
export const validateFile = (
  file: File,
  maxSizeMB: number = DEFAULT_CONFIG.maxFileSizeMB,
  allowedTypes: string[] = DEFAULT_CONFIG.allowedFileTypes
): FileValidation => {
  // Check if file exists
  if (!file) {
    return {
      valid: false,
      error: "No file provided",
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB. Current size: ${(
        file.size /
        (1024 * 1024)
      ).toFixed(2)}MB`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes
      .map((type) => {
        if (type === "application/pdf") return "PDF";
        if (type.includes("image/")) return type.split("/")[1].toUpperCase();
        return type;
      })
      .join(", ");

    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedExtensions}`,
    };
  }

  // Check for empty file
  if (file.size === 0) {
    return {
      valid: false,
      error: "File is empty",
    };
  }

  return { valid: true };
};

/**
 * Generate unique session ID with timestamp
 */
export const generateSessionId = (): string => {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `session-${timestamp}-${random}`;
};

/**
 * Generate unique case ID with year prefix
 */
export const generateCaseId = (): string => {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `CASE-${year}${month}-${random}`;
};

// ==========================================
// SERVICE EXPORT
// ==========================================

const IdentityVerificationService = {
  getUploadUrl,
  uploadFileToS3,
  uploadDocument,
  uploadPersonPhoto,
  verifyIdentity,
  completeIdentityVerification,
  validateFile,
  generateSessionId,
  generateCaseId,
  deletePreviousVerificationFiles,
};

export default IdentityVerificationService;
