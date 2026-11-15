import { NextResponse } from "next/server";
import {
  clearFailures,
  clientIp,
  isValidPin,
  lockedMinutes,
  makeUnlockCookie,
  recordFailure,
  unlockCookieName,
  verifyPin,
} from "./security";

/** 文档和空间共用的“输入 4 位密码”处理（含错误次数限制） */
export async function handleUnlock(req: Request, key: string, pinHash: string | null) {
  if (!pinHash) return NextResponse.json({ error: "notFound" }, { status: 404 });

  const ip = clientIp(req.headers);
  const wait = await lockedMinutes(key, ip);
  if (wait > 0) {
    return NextResponse.json({ error: "tooManyAttempts", vars: { n: wait } }, { status: 429 });
  }

  const { pin } = await req.json().catch(() => ({ pin: null }));
  if (!isValidPin(pin) || !verifyPin(pin, pinHash)) {
    await recordFailure(key, ip);
    return NextResponse.json({ error: "wrongPin" }, { status: 401 });
  }

  await clearFailures(key, ip);
  const { value, maxAge } = makeUnlockCookie(key, pinHash);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(unlockCookieName(key), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
