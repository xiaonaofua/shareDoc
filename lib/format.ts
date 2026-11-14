export type DocumentRow = {
  id: string;
  owner_id: string;
  owner_email: string;
  token: string;
  title: string;
  file_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
