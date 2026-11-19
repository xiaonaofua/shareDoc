import { cookies } from "next/headers";
import { needsPin, type DocumentRow } from "./format";
import { checkUnlockCookie, unlockCookieName } from "./security";

/**
 * 访问者能否查看某个文件 —— 只看这个文件自己的“需要密码”设置。
 * 无论是通过文件链接还是文件夹链接打开，规则都一样；输过一次密码两边都有效。
 *  ok = 可以查看；pin = 需要输入密码；nopin = 所有者还没设置密码
 */
export async function docAccess(doc: DocumentRow, pinHash: string | null): Promise<"ok" | "pin" | "nopin"> {
  if (!needsPin(doc)) return "ok";
  if (!pinHash) return "nopin";
  const store = await cookies();
  return checkUnlockCookie(store.get(unlockCookieName(doc.token))?.value, doc.token, pinHash) ? "ok" : "pin";
}
