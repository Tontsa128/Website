export type MediaAsset = {
  id: string;
  site_id: string;
  storage_path: string;
  filename: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  folder_id: string | null;
  tags: string[];
  created_at?: string;
  signedUrl?: string | null;
  usageCount?: number;
};

export type MediaFolder = {
  id: string;
  site_id: string;
  parent_id: string | null;
  name: string;
  created_at?: string;
};

export type SupportedSourceMime = "image/jpeg" | "image/png" | "image/webp";

export type MediaApiResponse = {
  media?: MediaAsset;
  signedUrl?: string | null;
  error?: string;
};
