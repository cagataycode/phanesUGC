import { fetchWithAuth } from "./api-client";

export interface ProductDefaultsPayload {
  tone?: string;
  targetAudience?: string;
  language?: string;
  cta?: string;
}

export interface BrandAssetPayload {
  storageKey: string;
  type: "image" | "video" | "logo";
  filename: string;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  benefits?: string[];
  urls?: string[];
  brandAssets?: BrandAssetPayload[];
  defaults?: ProductDefaultsPayload;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

function productsUrl(businessId: string, productId?: string): string {
  const base = `/v1/businesses/${encodeURIComponent(businessId)}/products`;
  return productId ? `${base}/${encodeURIComponent(productId)}` : base;
}

/**
 * Create a new product under the given business.
 * Returns the new product's ID.
 */
export async function createProduct(
  businessId: string,
  data: CreateProductPayload,
): Promise<{ id: string }> {
  const res = await fetchWithAuth(productsUrl(businessId), {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create product: ${text}`);
  }

  return res.json() as Promise<{ id: string }>;
}

/**
 * Update an existing product (partial update).
 */
export async function updateProduct(
  businessId: string,
  productId: string,
  data: UpdateProductPayload,
): Promise<void> {
  const res = await fetchWithAuth(productsUrl(businessId, productId), {
    method: "PATCH",
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update product: ${text}`);
  }
}

/**
 * Soft-delete a product.
 */
export async function deleteProduct(
  businessId: string,
  productId: string,
): Promise<void> {
  const res = await fetchWithAuth(productsUrl(businessId, productId), {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Failed to delete product: ${text}`);
  }
}
