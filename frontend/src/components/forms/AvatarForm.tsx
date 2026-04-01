"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { AvatarAsset } from "@/lib/asset-types";
import {
  useStorageImageUrl,
  clearStorageUrlCache,
} from "@/lib/useStorageImageUrl";

// Allowed MIME types for avatar images (no GIF, no video, no audio)
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/bmp",
  "image/tiff",
]);

const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.avif,.bmp,.tiff";

interface AvatarFormProps {
  businessId: string;
  avatar?: AvatarData;
  onSuccess?: (avatarId: string) => void;
  onCancel?: () => void;
}

interface PendingFile {
  file: File;
  url: string;
  status: "pending" | "uploading" | "done" | "error";
}

function AvatarImagePreview({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted text-muted-foreground ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-full ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

function AssetThumbnail({
  src,
  filename,
  role,
}: {
  src: string | null;
  filename: string;
  role?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (src && !imgError) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={filename}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {filename}
          </p>
          <p className="text-xs text-muted-foreground">
            image{role ? ` \u2022 ${role}` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="truncate text-sm font-medium text-foreground">{filename}</p>
      <p className="text-xs text-muted-foreground">
        image{role ? ` \u2022 ${role}` : ""}
      </p>
    </div>
  );
}

function StorageAssetPreview({
  asset,
  businessId,
}: {
  asset: AvatarAsset;
  businessId: string;
}) {
  const url = useStorageImageUrl(
    businessId,
    asset.type === "image" ? asset.storageKey : undefined,
  );

  return (
    <AssetThumbnail src={url} filename={asset.filename} role={asset.role} />
  );
}

/** Hook that resolves the download URL for the first image asset */
function useFirstImagePreviewUrl(
  businessId: string | undefined,
  assets: AvatarAsset[],
): string | null {
  const firstImageStorageKey = useMemo(
    () => assets.find((a) => a.type === "image")?.storageKey,
    [assets],
  );

  return useStorageImageUrl(businessId, firstImageStorageKey);
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
  const [isDefault, setIsDefault] = useState(Boolean(avatar?.isDefault));
  const [assets, setAssets] = useState<AvatarAsset[]>(avatar?.assets ?? []);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const storedPreviewUrl = useFirstImagePreviewUrl(businessId, assets);

  // Determine the main preview: prefer local preview, then stored
  const mainPreviewUrl = useMemo(() => {
    const imagePreview = pendingFiles.find((p) =>
      p.file.type.startsWith("image/"),
    );
    if (imagePreview) return imagePreview.url;
    return storedPreviewUrl;
  }, [pendingFiles, storedPreviewUrl]);

  function handleFileSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    if (isSubmitting) return;

    const files = Array.from(fileList);
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        rejectedFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    }

    if (rejectedFiles.length > 0) {
      setError(
        `Unsupported file type${rejectedFiles.length > 1 ? "s" : ""}: ${rejectedFiles.join(", ")}. Only JPEG, PNG, WebP, AVIF, BMP, and TIFF images are allowed.`,
      );
      return;
    }

    if (validFiles.length === 0) return;

    setError(null);

    const newPending: PendingFile[] = validFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
      status: "pending" as const,
    }));

    setPendingFiles((prev) => [...prev, ...newPending]);

    // If editing an existing avatar, upload immediately
    if (isEdit && avatar?.id) {
      void uploadFiles(avatar.id, newPending);
    }
  }

  async function uploadFiles(
    avatarId: string,
    files: PendingFile[],
    existingAssets: AvatarAsset[] = assets,
  ) {
    setPendingFiles((prev) =>
      prev.map((p) =>
        files.some((f) => f.url === p.url) && p.status === "pending"
          ? { ...p, status: "uploading" }
          : p,
      ),
    );

    try {
      const uploaded: AvatarAsset[] = [];

      for (const pf of files) {
        const file = pf.file;
        const upload = await createUploadUrl(businessId, avatarId, {
          filename: file.name,
          contentType: file.type,
          entityType: "avatar",
          assetType: "image",
          role: "profile",
        });

        await uploadFileToSignedUrl(upload.uploadUrl, file);
        uploaded.push(toAvatarAsset(upload.asset));

        setPendingFiles((prev) =>
          prev.map((p) => (p.url === pf.url ? { ...p, status: "done" } : p)),
        );
      }

      const nextAssets = [...existingAssets, ...uploaded];
      setAssets(nextAssets);
      clearStorageUrlCache();
      await updateAvatar(businessId, avatarId, { assets: nextAssets });
    } catch (err) {
      console.error("Avatar asset upload error:", err);
      setPendingFiles((prev) =>
        prev.map((p) =>
          files.some((f) => f.url === p.url) && p.status === "uploading"
            ? { ...p, status: "error" }
            : p,
        ),
      );
      setError(err instanceof Error ? err.message : "Failed to upload asset.");
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
      isDefault,
    };

    try {
      let avatarId: string;

      if (isEdit && avatar) {
        avatarId = avatar.id;
        await updateAvatar(businessId, avatar.id, payload);
      } else {
        const result = await createAvatar(businessId, payload);
        avatarId = result.id;
      }

      // Upload any pending files (for new avatars or files selected during edit)
      const filesToUpload = pendingFiles.filter(
        (p) => p.status === "pending" || p.status === "error",
      );

      if (filesToUpload.length > 0) {
        await uploadFiles(avatarId, filesToUpload, assets);
      }

      onSuccess?.(avatarId);
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

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = pendingFiles.map((p) => p.url);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveUploads = pendingFiles.some(
    (p) => p.status === "uploading" || p.status === "pending",
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Main avatar preview + image upload section */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        {/* Default avatar image preview */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <AvatarImagePreview
            src={mainPreviewUrl}
            alt={name || "Avatar preview"}
            className="h-24 w-24 flex-shrink-0"
          />
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p className="text-sm font-medium text-foreground">Avatar image</p>
            <p className="text-center text-xs text-muted-foreground sm:text-left">
              {"Upload a photo to use as the avatar\u2019s primary identity."}
              <br />
              JPEG, PNG, WebP, AVIF, BMP, and TIFF are supported.
            </p>
          </div>
        </div>

        {/* Upload button - always enabled */}
        <div className="flex items-center justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <span>{hasActiveUploads ? "Uploading\u2026" : "Upload image"}</span>
            <input
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              multiple
              disabled={isSubmitting}
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </label>
        </div>

        {/* Local previews (newly selected files) */}
        {pendingFiles.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingFiles.map((pf) => (
              <div key={pf.url} className="relative">
                <AssetThumbnail
                  src={pf.url}
                  filename={pf.file.name}
                  role="profile"
                />
                {pf.status === "uploading" && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/60">
                    <span className="text-xs text-muted-foreground">
                      Uploading\u2026
                    </span>
                  </div>
                )}
                {pf.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-md bg-destructive/10">
                    <span className="text-xs text-destructive">Failed</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Existing stored assets with image previews */}
        {assets.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {assets.map((asset, index) => (
              <StorageAssetPreview
                key={`${asset.storageKey}-${index}`}
                asset={asset}
                businessId={businessId}
              />
            ))}
          </div>
        )}

        {assets.length === 0 && pendingFiles.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No avatar images uploaded yet.
          </p>
        )}
      </div>

      {/* Avatar details */}
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
              ? "Saving\u2026"
              : "Creating\u2026"
            : isEdit
              ? "Save changes"
              : "Create avatar"}
        </Button>
      </div>
    </form>
  );
}
