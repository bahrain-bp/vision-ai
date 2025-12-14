import React from "react";
import { ImageIcon, Loader2 } from "lucide-react";

interface ImageComparisonGridProps {
  uploadedPhotoPreview: string | null;
  comparisonPhotoPreview: string | null;
  photoSource: string;
  loadingReferencePhoto: boolean;
  onImageError: () => void;
  t: (key: string) => string;
}

const ImageComparisonGrid: React.FC<ImageComparisonGridProps> = ({
  uploadedPhotoPreview,
  comparisonPhotoPreview,
  photoSource,
  loadingReferencePhoto,
  onImageError,
  t,
}) => {
  return (
    <div className="image-comparison-grid">
      <div className="comparison-image-card">
        <div className="image-label">{t("identity.UploadedPicture")}</div>
        {uploadedPhotoPreview ? (
          <img
            src={uploadedPhotoPreview}
            alt="Uploaded person for verification"
            className="comparison-image"
          />
        ) : (
          <div className="image-placeholder">
            <ImageIcon size={48} />
            <span>{t("identity.noPreview")}</span>
          </div>
        )}
      </div>

      <div className="comparison-image-card">
        <div className="image-label">
          {t("identity.comparisonSource")}({photoSource})
        </div>
        {photoSource === "global-assets" ? (
          loadingReferencePhoto ? (
            <div className="image-placeholder">
              <Loader2 size={48} className="animate-spin" />
              <span>{t("identity.referenceLoading")}</span>
            </div>
          ) : comparisonPhotoPreview ? (
            <img
              src={comparisonPhotoPreview}
              alt="Reference from database"
              className="comparison-image"
              onError={onImageError}
            />
          ) : (
            <div className="image-placeholder">
              <ImageIcon size={48} />
              <span>{t("identity.databaseReference")}</span>
            </div>
          )
        ) : comparisonPhotoPreview ? (
          <img
            src={comparisonPhotoPreview}
            alt="Comparison source from document"
            className="comparison-image"
          />
        ) : (
          <div className="image-placeholder">
            <ImageIcon size={48} />
            <span>{t("identity.documentLoading")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageComparisonGrid;
