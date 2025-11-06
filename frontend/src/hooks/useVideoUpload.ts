// Custom hook for managing video upload process
/**
 * Handles file selection and validation
   Handles generation of presigned URLs (simulated for now)
   Uploads videos to S3  (simulated for now)
   Manages upload progress and errors
   Provides the uploaded video's URL for playback
 */
// note: mock logic will be replaced later during backend integration 
import { useState } from "react";
//import { useVideoAnalysis } from "../context/VideoAnalysisContext";


export const useVideoUpload = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (file: File) => {
    try {
      setError(null);
      setUploadProgress(0);

      // simulate upload progress
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // simulate delay
        setUploadProgress(progress);
      }

      // Simulate successful upload
      const mockS3Key = `mock-s3-key-${file.name}`;
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file)); // create a local URL for the video
      return mockS3Key;
    } catch (err) {
      setError("Failed to upload video");
      throw err;
    }
  };

  const clearVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl); // revoke the local URL
    }
    setVideoFile(null);
    setVideoUrl(null);
    setUploadProgress(0);
    setError(null);
  };

  return {
    uploadVideo,
    clearVideo,
    videoFile,
    videoUrl,
    uploadProgress,
    error,
  };
};