"use client";

import { useState } from "react";
import type { ProductAsset, ProductAssetType } from "@/lib/asset-types";
import { useStorageImageUrl } from "@/lib/useStorageImageUrl";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface BrandAssetThumbnailProps {
  businessId: string;
  asset: ProductAsset;
  onDelete?: (asset: ProductAsset) => void;
  onEditType?: (asset: ProductAsset, newType: ProductAssetType) => void;
}

const ASSET_TYPES: ProductAssetType[] = ["image", "logo", "video"];

export function BrandAssetThumbnail({
  businessId,
  asset,
  onDelete,
  onEditType,
}: BrandAssetThumbnailProps) {
  const imageUrl = useStorageImageUrl(businessId, asset.storageKey);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group/card relative rounded-lg border border-border bg-card overflow-hidden">
      {/* Image preview area */}
      <div className="flex aspect-video items-center justify-center bg-muted/50">
        {imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={asset.filename}
            className="h-full w-full object-cover"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setDimensions({ width: naturalWidth, height: naturalHeight });
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <svg
            className="h-8 w-8 text-muted-foreground/40"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
            />
          </svg>
        )}
      </div>

      {/* Dimensions label */}
      <div className="px-2 py-1.5 text-center">
        <span className="text-xs text-muted-foreground">
          {dimensions
            ? `${dimensions.width} × ${dimensions.height}`
            : "Loading…"}
        </span>
      </div>

      {/* Actions menu — visible on hover */}
      {(onDelete || onEditType) && (
        <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/card:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground"
                aria-label="Asset actions"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEditType &&
                ASSET_TYPES.filter((t) => t !== asset.type).map((type) => (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => onEditType(asset, type)}
                  >
                    Set as {type}
                  </DropdownMenuItem>
                ))}
              {onEditType && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(asset)}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
