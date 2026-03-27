import { fetchWithAuth } from "./api-client";
import type { AvatarAsset } from "./asset-types";

export interface AvatarAppearancePayload {
  hair?: string;
  outfit?: string;
  style?: string;
}

export interface AvatarVoiceProfilePayload {
  voiceId?: string;
  provider?: string;
  language?: string;
}

export interface AvatarPersonaPayload {
  tone?: string;
  targetAudience?: string;
  ctaStyle?: string;
}

export interface CreateAvatarPayload {
  name: string;
  description?: string;
  type: "ugc_creator" | "brand_rep" | "voice_only";
  gender?: string;
  ageRange?: string;
  locale?: string;
  appearance?: AvatarAppearancePayload;
  voiceProfile?: AvatarVoiceProfilePayload;
  persona?: AvatarPersonaPayload;
  assets?: AvatarAsset[];
  thumbnailStorageKey?: string;
  isDefault?: boolean;
}

export type UpdateAvatarPayload = Partial<CreateAvatarPayload>;

function avatarsUrl(businessId: string, avatarId?: string): string {
  const base = `/v1/businesses/${encodeURIComponent(businessId)}/avatars`;
  return avatarId ? `${base}/${encodeURIComponent(avatarId)}` : base;
}

export async function createAvatar(
  businessId: string,
  data: CreateAvatarPayload,
): Promise<{ id: string }> {
  const res = await fetchWithAuth(avatarsUrl(businessId), {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create avatar: ${text}`);
  }

  return res.json() as Promise<{ id: string }>;
}

export async function updateAvatar(
  businessId: string,
  avatarId: string,
  data: UpdateAvatarPayload,
): Promise<void> {
  const res = await fetchWithAuth(avatarsUrl(businessId, avatarId), {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update avatar: ${text}`);
  }
}

export async function deleteAvatar(
  businessId: string,
  avatarId: string,
): Promise<void> {
  const res = await fetchWithAuth(avatarsUrl(businessId, avatarId), {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Failed to delete avatar: ${text}`);
  }
}
