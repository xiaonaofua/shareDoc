function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

export const BUCKET = "sharedoc-files";
export const RETENTION_DAYS = num(process.env.RETENTION_DAYS, 30);
export const REMIND_DAYS_BEFORE = num(process.env.REMIND_DAYS_BEFORE, 3);
export const MAX_FILE_BYTES = num(process.env.MAX_FILE_MB, 20) * 1024 * 1024;
export const ENABLE_OFFICE_PREVIEW = process.env.ENABLE_OFFICE_PREVIEW !== "false";

export const ALLOWED_TYPES: Record<string, string> = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function extOf(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  const ext = m?.[1]?.toLowerCase();
  return ext && ext in ALLOWED_TYPES ? ext : null;
}

/** ADMIN_ACCOUNTS="alice:alice@x.com,bob:bob@y.com" → Map(登录ID → 邮箱) */
export function adminAccounts(): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of (process.env.ADMIN_ACCOUNTS ?? "").split(",")) {
    const [id, email] = pair.split(":").map((s) => s?.trim());
    if (id && email) map.set(id.toLowerCase(), email.toLowerCase());
  }
  return map;
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return [...adminAccounts().values()].includes(email.toLowerCase());
}

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "").replace(/\/$/, "");
}
