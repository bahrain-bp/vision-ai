import axios from "axios";
import {
  UploadUrlRequest,
  UploadUrlResponse,
  VerificationRequest,
  VerificationResponse,
  PersonType,
  FileValidation,
  ProgressCallback,
  DEFAULT_CONFIG,
} from "../../types/identityVerification";

const API_BASE_URL = process.env.REACT_APP_API_ENDPOINT;

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

const REQUEST_CONFIG: any = {
  timeout: DEFAULT_CONFIG.uploadTimeout,
  timeoutErrorMessage: "Request timeout occurred",
};

const getFileMimeType = (file: File): string => {
  return file.type || "application/octet-stream";
};

const handleApiError = (error: unknown, context: string): never => {
  if (error && typeof error === "object" && "response" in error) {
    const axiosError = error as any;
    const status = axiosError.response?.status;
    const errorMessage = axiosError.response?.data?.error || axiosError.message;
    const errorDetails = axiosError.response?.data?.details;

    console.error(`API Error in ${context}:`, {
      errorMessage,
      errorDetails,
      status,
      url: axiosError.config?.url,
    });

    if (status === 401)
      throw new IdentityVerificationError(
        "Authentication failed",
        "AUTH_ERROR",
        errorDetails,
        error
      );
    if (status === 403)
      throw new IdentityVerificationError(
        "Access forbidden",
        "FORBIDDEN",
        errorDetails,
        error
      );
    if (status === 429)
      throw new IdentityVerificationError(
        "Too many requests",
        "RATE_LIMITED",
        errorDetails,
        error
      );
    if (status && status >= 500)
      throw new IdentityVerificationError(
        "Server error occurred",
        "SERVER_ERROR",
        errorDetails,
        error
      );

    throw new IdentityVerificationError(
      errorMessage || "An unexpected error occurred",
      "API_ERROR",
      errorDetails,
      error
    );
  }

  if (error instanceof IdentityVerificationError) throw error;

  console.error(`Unexpected error in ${context}:`, error);
  throw new IdentityVerificationError(
    "An unexpected error occurred. Please try again.",
    "UNKNOWN_ERROR",
    undefined,
    error
  );
};

const validateProgressCallback = (callback?: ProgressCallback): void => {
  if (callback && typeof callback !== "function") {
    console.warn("Invalid progress callback provided");
  }
};

export const validateFile = (
  file: File,
  maxSizeMB: number = DEFAULT_CONFIG.maxFileSizeMB,
  allowedTypes: string[] = DEFAULT_CONFIG.allowedFileTypes
): FileValidation => {
  if (!file) return { valid: false, error: "No file provided" };

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes)
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB. Current size: ${(
        file.size /
        (1024 * 1024)
      ).toFixed(2)}MB`,
    };

  if (!allowedTypes.includes(file.type)) {
    const allowedExtensions = allowedTypes
      .map((t) => {
        if (t === "application/pdf") return "PDF";
        if (t.includes("image/")) return t.split("/")[1].toUpperCase();
        return t;
      })
      .join(", ");
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedExtensions}`,
    };
  }

  if (file.size === 0) return { valid: false, error: "File is empty" };

  return { valid: true };
};

export const getUploadUrl = async (
  caseId: string,
  sessionId: string,
  file: File,
  uploadType: "document" | PersonType,
  personType?: PersonType
): Promise<UploadUrlResponse> => {
  try {
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
      { ...REQUEST_CONFIG, headers: { "Content-Type": "application/json" } }
    );

    return response.data;
  } catch (error) {
    return handleApiError(error, "getUploadUrl");
  }
};

export const uploadFileToS3 = async (
  presignedUrl: string,
  file: File,
  onProgress?: ProgressCallback
): Promise<void> => {
  try {
    validateProgressCallback(onProgress);

    await axios.put(presignedUrl, file, {
      ...REQUEST_CONFIG,
      headers: {
        "Content-Type": getFileMimeType(file),
      },
      onUploadProgress: (progressEvent: any) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(progress);
        }
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as any).code === "ECONNABORTED"
    ) {
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

export const uploadDocument = async (
  caseId: string,
  sessionId: string,
  file: File,
  onProgress?: ProgressCallback
): Promise<string> => {
  const validation = validateFile(file);
  if (!validation.valid)
    throw new IdentityVerificationError(
      validation.error!,
      "FILE_VALIDATION_FAILED"
    );
  const uploadUrlResponse = await getUploadUrl(
    caseId,
    sessionId,
    file,
    "document"
  );
  await uploadFileToS3(uploadUrlResponse.uploadUrl, file, onProgress);
  return uploadUrlResponse.s3Key;
};

export const uploadPersonPhoto = async (
  caseId: string,
  sessionId: string,
  file: File,
  personType: PersonType,
  onProgress?: ProgressCallback
): Promise<string> => {
  const validation = validateFile(file);
  if (!validation.valid)
    throw new IdentityVerificationError(
      validation.error!,
      "FILE_VALIDATION_FAILED"
    );
  const uploadUrlResponse = await getUploadUrl(
    caseId,
    sessionId,
    file,
    personType,
    personType
  );
  await uploadFileToS3(uploadUrlResponse.uploadUrl, file, onProgress);
  return uploadUrlResponse.s3Key;
};

export const completeIdentityVerification = async (
  caseId: string,
  sessionId: string,
  documentFile: File,
  personPhotoFile: File,
  personType: PersonType,
  documentType: "cpr" | "passport",
  personName?: string,
  onDocumentProgress?: ProgressCallback,
  onPhotoProgress?: ProgressCallback,
  attemptNumber: number = 1
): Promise<VerificationResponse> => {
  validateProgressCallback(onDocumentProgress);
  validateProgressCallback(onPhotoProgress);

  // Step 1: Upload document
  const documentKey = await uploadDocument(
    caseId,
    sessionId,
    documentFile,
    onDocumentProgress
  );

  // Step 2: Upload person photo
  const personPhotoKey = await uploadPersonPhoto(
    caseId,
    sessionId,
    personPhotoFile,
    personType,
    onPhotoProgress
  );

  // Step 3: Check if S3 keys are identical
  if (documentKey === personPhotoKey) {
    throw new IdentityVerificationError(
      "The document and person photo must be different files. Please upload distinct images.",
      "DUPLICATE_FILES"
    );
  }

  // Step 4: Trigger verification

  const verificationResult = await verifyIdentity({
    caseId,
    sessionId,
    documentKey,
    personPhotoKey,
    personType,
    attemptNumber,
    documentType,
    ...(personName && { personName }),
  });

  return verificationResult;
};

export const verifyIdentity = async (
  request: VerificationRequest
): Promise<VerificationResponse> => {
  try {
    const response = await axios.post<VerificationResponse>(
      `${API_BASE_URL}/identity/verify`,
      request,
      { ...REQUEST_CONFIG, headers: { "Content-Type": "application/json" } }
    );
    return response.data;
  } catch (error) {
    return handleApiError(error, "verifyIdentity");
  }
};

export const deletePreviousVerificationFiles = async (
  caseId: string,
  sessionId: string,
  personType: PersonType,
  attemptNumber: number
): Promise<void> => {
  try {
    await axios.delete(`${API_BASE_URL}/identity/cleanup`, {
      data: { caseId, sessionId, personType, attemptNumber },
      ...REQUEST_CONFIG,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.warn("Failed to delete previous verification files:", error);
  }
};

const IdentityVerificationService = {
  getUploadUrl,
  uploadFileToS3,
  uploadDocument,
  uploadPersonPhoto,
  verifyIdentity,
  completeIdentityVerification,
  validateFile,
  deletePreviousVerificationFiles,
};

export default IdentityVerificationService;
