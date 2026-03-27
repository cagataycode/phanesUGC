export type ProductAssetType = "image" | "video" | "logo";

export type ProductAssetRole = "brand";

export interface ProductAsset {
  storageKey: string;
  type: ProductAssetType;
  filename: string;
  role?: ProductAssetRole;
}

export type AvatarAssetType = "image" | "video" | "audio";

export type AvatarAssetRole = "profile" | "reference" | "demo" | "voice_sample";

export interface AvatarAsset {
  storageKey: string;
  type: AvatarAssetType;
  filename: string;
  role?: AvatarAssetRole;
}
