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
  /** false = 不需要密码，任何拿到链接的人都能看（列不存在时按 true 处理） */
  require_pin?: boolean;
  /** true = 访问者可以下载（列不存在时按“仅查看”处理） */
  allow_download?: boolean;
  /** 所属空间（可为空） */
  space_id?: string | null;
};

export type SpaceRow = {
  id: string;
  owner_id: string;
  token: string;
  title: string;
  require_pin: boolean;
  allow_download?: boolean;
  created_at: string;
  updated_at: string;
};

export const needsPin = (doc: Pick<DocumentRow, "require_pin">) => doc.require_pin !== false;

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
