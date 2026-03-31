import { fetchWithAuth } from "./api-client";
import type {
  AvatarAsset,
  AvatarAssetRole,
  AvatarAssetType,
  ProductAsset,
  ProductAssetRole,
  ProductAssetType,
} from "./asset-types";

export interface CreateUploadUrlPayload {
  filename: string;
  contentType: string;
  entityType: "product" | "avatar";
  assetType: "image" | "video" | "audio" | "logo";
  role?: "profile" | "reference" | "demo" | "voice_sample" | "brand";
}

export interface RawUploadAssetDescriptor {
  storageKey: string;
  type: "image" | "video" | "audio" | "logo";
  filename: string;
  role?: "profile" | "reference" | "demo" | "voice_sample" | "brand";
}

export function toProductAsset(asset: RawUploadAssetDescriptor): ProductAsset {
  return {
    storageKey: asset.storageKey,
    type: asset.type as ProductAssetType,
    filename: asset.filename,
    role: asset.role as ProductAssetRole | undefined,
  };
}

export function toAvatarAsset(asset: RawUploadAssetDescriptor): AvatarAsset {
  return {
    storageKey: asset.storageKey,
    type: asset.type as AvatarAssetType,
    filename: asset.filename,
    role: asset.role as AvatarAssetRole | undefined,
  };
}

export async function createUploadUrl(
  businessId: string,
  entityId: string,
  payload: CreateUploadUrlPayload,
): Promise<{
  uploadUrl: string;
  method: "PUT";
  objectPath: string;
  asset: RawUploadAssetDescriptor;
}> {
  const res = await fetchWithAuth(
    `/v1/businesses/${encodeURIComponent(businessId)}/assets/${encodeURIComponent(entityId)}/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create upload URL: ${text}`);
  }

  return res.json() as Promise<{
    uploadUrl: string;
    method: "PUT";
    objectPath: string;
    asset: RawUploadAssetDescriptor;
  }>;
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload file: ${text}`);
  }
}

export async function getAssetDownloadUrl(
  businessId: string,
  storageKey: string,
): Promise<string | null> {
  try {
    const res = await fetchWithAuth(
      `/v1/businesses/${encodeURIComponent(businessId)}/assets/download-url?storageKey=${encodeURIComponent(storageKey)}`,
    );

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { downloadUrl: string | null };
    return data.downloadUrl;
  } catch {
    return null;
  }
}
