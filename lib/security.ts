import crypto from "node:crypto";
import { adminDb } from "./supabase";

/* ---------- 4 位数字密码的哈希 ---------- */

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(pin, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const a = crypto.scryptSync(pin, salt, 32);
  const b = Buffer.from(hash, "base64url");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const isValidPin = (pin: unknown): pin is string =>
  typeof pin === "string" && /^\d{4}$/.test(pin);

/* ---------- 文档链接令牌 ---------- */

/** 16 个字符、96 bit 随机数，无法猜出 */
export const newToken = () => crypto.randomBytes(12).toString("base64url");

/* ---------- “已输入正确密码”的 Cookie ---------- */

const UNLOCK_TTL_SEC = 60 * 60; // 1 小时内不用重复输入
export const unlockCookieName = (token: string) => `unlock_${token}`;

function sign(data: string) {
  const secret = process.env.UNLOCK_SECRET;
  if (!secret || secret.length < 32) throw new Error("UNLOCK_SECRET 未设置或太短");
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/** 把密码哈希也签进去：管理员一改密码，旧 Cookie 立即失效 */
export function makeUnlockCookie(token: string, pinHash: string) {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_TTL_SEC;
  return { value: `${exp}.${sign(`${token}|${exp}|${pinHash}`)}`, maxAge: UNLOCK_TTL_SEC };
}

export function checkUnlockCookie(value: string | undefined, token: string, pinHash: string | null) {
  if (!value || !pinHash) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now() / 1000 || !sig) return false;
  const expected = sign(`${token}|${exp}|${pinHash}`);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

/* ---------- 防暴力破解：4 位密码只有 1 万种组合，必须限制次数 ---------- */

const LIMITS = [
  { scope: "ip", max: 5, windowMin: 15 }, // 同一 IP 对同一文档：15 分钟内最多错 5 次
  { scope: "doc", max: 30, windowMin: 60 }, // 同一文档合计：1 小时内最多错 30 次
] as const;

type Attempt = { key: string; fails: number; window_start: string };

function keysFor(token: string, ip: string) {
  return LIMITS.map((l) => ({ ...l, key: l.scope === "ip" ? `ip:${ip}:${token}` : `doc:${token}` }));
}

/** 返回还需等待的分钟数；0 表示可以尝试 */
export async function lockedMinutes(token: string, ip: string): Promise<number> {
  const db = adminDb();
  const keys = keysFor(token, ip);
  const { data } = await db.from("sharedoc_pin_attempts").select("*").in("key", keys.map((k) => k.key));
  let wait = 0;
  for (const k of keys) {
    const row = (data as Attempt[] | null)?.find((r) => r.key === k.key);
    if (!row) continue;
    const end = new Date(row.window_start).getTime() + k.windowMin * 60_000;
    if (row.fails >= k.max && end > Date.now()) wait = Math.max(wait, Math.ceil((end - Date.now()) / 60_000));
  }
  return wait;
}

export async function recordFailure(token: string, ip: string) {
  const db = adminDb();
  for (const k of keysFor(token, ip)) {
    const { data: row } = await db.from("sharedoc_pin_attempts").select("*").eq("key", k.key).maybeSingle<Attempt>();
    const expired = !row || new Date(row.window_start).getTime() + k.windowMin * 60_000 < Date.now();
    await db.from("sharedoc_pin_attempts").upsert({
      key: k.key,
      fails: expired ? 1 : row!.fails + 1,
      window_start: expired ? new Date().toISOString() : row!.window_start,
    });
  }
}

export async function clearFailures(token: string, ip: string) {
  await adminDb().from("sharedoc_pin_attempts").delete().eq("key", `ip:${ip}:${token}`);
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
