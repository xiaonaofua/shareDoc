import { NextResponse } from "next/server";
import { findSharedDoc } from "@/lib/docs";
import {
  clearFailures,
  clientIp,
  isValidPin,
  lockedMinutes,
  makeUnlockCookie,
  recordFailure,
  unlockCookieName,
  verifyPin,
} from "@/lib/security";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found || !found.pinHash) return NextResponse.json({ error: "未找到" }, { status: 404 });

  const ip = clientIp(req.headers);
  const wait = await lockedMinutes(token, ip);
  if (wait > 0) {
    return NextResponse.json({ error: `错误次数过多，请 ${wait} 分钟后再试` }, { status: 429 });
  }

  const { pin } = await req.json().catch(() => ({ pin: null }));
  if (!isValidPin(pin) || !verifyPin(pin, found.pinHash)) {
    await recordFailure(token, ip);
    return NextResponse.json({ error: "密码不正确" }, { status: 401 });
  }

  await clearFailures(token, ip);
  const { value, maxAge } = makeUnlockCookie(token, found.pinHash);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(unlockCookieName(token), value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/`,
    maxAge,
  });
  return res;
}
