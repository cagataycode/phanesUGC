"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AvatarData } from "@/lib/firebase/hooks";
import {
  createAvatar,
  updateAvatar,
  type CreateAvatarPayload,
} from "@/lib/avatars-api";
import {
  createUploadUrl,
  toAvatarAsset,
  uploadFileToSignedUrl,
} from "@/lib/assets-api";

interface AvatarFormProps {
  businessId: string;
  avatar?: AvatarData;
  onSuccess?: (avatarId: string) => void;
  onCancel?: () => void;
}

export function AvatarForm({
  businessId,
  avatar,
  onSuccess,
  onCancel,
}: AvatarFormProps) {
  const isEdit = Boolean(avatar);
  const [name, setName] = useState(avatar?.name ?? "");
  const [type, setType] = useState<"ugc_creator" | "brand_rep" | "voice_only">(
    avatar?.type ?? "ugc_creator",
  );
  const [locale, setLocale] = useState(avatar?.locale ?? "en");
  const [thumbnailStorageKey, setThumbnailStorageKey] = useState(
    avatar?.thumbnailStorageKey ?? "",
  );
  const [isDefault, setIsDefault] = useState(Boolean(avatar?.isDefault));
  const [assets, setAssets] = useState(avatar?.assets ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssetUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !avatar?.id) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploaded = [] as NonNullable<CreateAvatarPayload["assets"]>;

      for (const file of Array.from(fileList)) {
        const assetType = file.type.startsWith("audio/")
          ? "audio"
          : file.type.startsWith("video/")
            ? "video"
            : "image";
        const role = assetType === "audio" ? "voice_sample" : "profile";

        const upload = await createUploadUrl(businessId, avatar.id, {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          entityType: "avatar",
          assetType,
          role,
        });

        await uploadFileToSignedUrl(upload.uploadUrl, file);
        uploaded.push(toAvatarAsset(upload.asset));
      }

      const nextAssets = [...assets, ...uploaded];
      setAssets(nextAssets);
      await updateAvatar(businessId, avatar.id, { assets: nextAssets });
    } catch (err) {
      console.error("Avatar asset upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload asset.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Avatar name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: CreateAvatarPayload = {
      name: name.trim(),
      type,
      locale: locale.trim() || undefined,
      assets,
      thumbnailStorageKey: thumbnailStorageKey.trim() || undefined,
      isDefault,
    };

    try {
      if (isEdit && avatar) {
        await updateAvatar(businessId, avatar.id, payload);
        onSuccess?.(avatar.id);
      } else {
        const result = await createAvatar(businessId, payload);
        onSuccess?.(result.id);
      }
    } catch (err) {
      console.error("AvatarForm submit error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred. Check console for details.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="avatar-name">Avatar name *</Label>
          <Input
            id="avatar-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lifestyle Creator Anna"
            required
          />
        </div>

        <div className="sm:col-span-2 rounded-lg border border-border bg-background/70 px-4 py-4">
          <p className="text-sm font-medium text-foreground">
            Image-first avatar setup
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use uploaded avatar photos as the primary identity source. Keep only
            a minimal name, type, and locale here.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avatar-type">Avatar type</Label>
          <Select
            value={type}
            onValueChange={(value) => setType(value as typeof type)}
          >
            <SelectTrigger id="avatar-type" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ugc_creator">UGC creator</SelectItem>
              <SelectItem value="brand_rep">Brand representative</SelectItem>
              <SelectItem value="voice_only">Voice only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avatar-locale">Locale</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="avatar-locale" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="avatar-thumbnail">Thumbnail storage key</Label>
        <Input
          id="avatar-thumbnail"
          value={thumbnailStorageKey}
          onChange={(e) => setThumbnailStorageKey(e.target.value)}
          placeholder="businesses/{bizId}/avatars/{avatarId}/profile/avatar.jpg"
        />
      </div>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Avatar assets</p>
            <p className="text-xs text-muted-foreground">
              Upload avatar photos as the primary source of identity. Multiple
              photos are supported.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <span>{isUploading ? "Uploading…" : "Upload asset"}</span>
            <input
              type="file"
              className="hidden"
              multiple
              disabled={!avatar?.id || isUploading || isSubmitting}
              onChange={(e) => void handleAssetUpload(e.target.files)}
            />
          </label>
        </div>
        {!avatar?.id ? (
          <p className="text-xs text-muted-foreground">
            Create the avatar first to enable uploads.
          </p>
        ) : null}
        {assets.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {assets.map((asset, index) => (
              <div
                key={`${asset.storageKey}-${index}`}
                className="rounded-md border border-border bg-background px-3 py-2"
              >
                <p className="truncate text-sm font-medium text-foreground">
                  {asset.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {asset.type}
                  {asset.role ? ` • ${asset.role}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No avatar images uploaded yet.
          </p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="h-4 w-4"
        />
        Set as default avatar
      </label>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create avatar"}
        </Button>
      </div>
    </form>
  );
}
