import { cookies } from "next/headers";
import { findSpace, spaceKey } from "./docs";
import { checkUnlockCookie, unlockCookieName } from "./security";

/**
 * 判断当前访问者能否进入空间。
 * status: ok = 可以进入；pin = 需要输入密码；nopin = 所有者还没设置密码；null = 空间不存在
 */
export async function spaceAccess(token: string) {
  const found = await findSpace(token);
  if (!found) return null;
  if (found.space.require_pin === false) return { ...found, status: "ok" as const };
  if (!found.pinHash) return { ...found, status: "nopin" as const };
  const key = spaceKey(token);
  const store = await cookies();
  const ok = checkUnlockCookie(store.get(unlockCookieName(key))?.value, key, found.pinHash);
  return { ...found, status: ok ? ("ok" as const) : ("pin" as const) };
}
