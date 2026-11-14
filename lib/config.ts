function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

export const BUCKET = "sharedoc-files";
export const RETENTION_DAYS = num(process.env.RETENTION_DAYS, 30);
export const MAX_FILE_BYTES = num(process.env.MAX_FILE_MB, 20) * 1024 * 1024;
export const ENABLE_OFFICE_PREVIEW = process.env.ENABLE_OFFICE_PREVIEW !== "false";

export { FILE_TYPES, extOf, kindOf } from "./filetypes";
