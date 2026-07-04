"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type {
  ApitoGalleryUploaderLabels,
  ApitoImageUploadLabels,
  ApitoMediaConfig,
  ApitoMediaDeleter,
} from "../ui/types";

const DEFAULT_IMAGE_LABELS: ApitoImageUploadLabels = {
  onlyImages: "You can only upload image files!",
  fileTooLarge: "Image must be smaller than",
  uploadFailed: "Upload failed",
  imageUploaded: "Image uploaded successfully",
  uploadFailedFallback: "Upload to server failed. Using local preview only.",
  clickToUpload: "Click to upload",
  camera: "Camera",
  gallery: "Gallery",
  uploading: "Uploading...",
  change: "Change",
  cropImage: "Crop Image",
  upload: "Upload",
  cancel: "Cancel",
  select: "Select",
  capture: "Capture",
  cameraAccess: "Cannot access camera",
};

const DEFAULT_GALLERY_LABELS: ApitoGalleryUploaderLabels = {
  title: "Gallery",
  addImage: "Add file",
  preview: "Preview",
  maxImagesReached: "Maximum files allowed",
  imageDeleted: "File removed successfully",
  deleteFailed: "Failed to remove file",
  invalidFileType: "File type not allowed",
  uploadFailed: "Upload failed",
};

const noopDelete: ApitoMediaDeleter = async () => ({});

const ApitoMediaContext = createContext<ApitoMediaConfig | null>(null);

export type ApitoMediaProviderProps = {
  children: ReactNode;
  value: ApitoMediaConfig;
};

export function ApitoMediaProvider({ children, value }: ApitoMediaProviderProps) {
  return (
    <ApitoMediaContext.Provider value={value}>{children}</ApitoMediaContext.Provider>
  );
}

function useApitoMediaConfig(): ApitoMediaConfig {
  const config = useContext(ApitoMediaContext);
  if (!config?.uploadMedia) {
    throw new Error(
      "Apito media upload is not configured. Pass `media` to ApitoProvider or wrap with ApitoMediaProvider.",
    );
  }
  return config;
}

export function useApitoMediaUpload() {
  const config = useApitoMediaConfig();
  return useMemo(
    () => ({
      uploadMedia: config.uploadMedia,
      deleteMedia: config.deleteMedia ?? noopDelete,
      resolveFileId: config.resolveFileId,
    }),
    [config.deleteMedia, config.resolveFileId, config.uploadMedia],
  );
}

export function useApitoImageUploadLabels(): ApitoImageUploadLabels {
  const config = useContext(ApitoMediaContext);
  return useMemo(
    () => ({ ...DEFAULT_IMAGE_LABELS, ...config?.imageUploadLabels }),
    [config?.imageUploadLabels],
  );
}

export function useApitoGalleryUploaderLabels(): ApitoGalleryUploaderLabels {
  const config = useContext(ApitoMediaContext);
  return useMemo(
    () => ({ ...DEFAULT_GALLERY_LABELS, ...config?.galleryUploaderLabels }),
    [config?.galleryUploaderLabels],
  );
}
