/** 把 Windows 上常见编码的文本（UTF-8 / UTF-16 / Shift_JIS / GBK）解码成字符串 */
export function decodeText(buf: Uint8Array): string {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);

  const utf8 = tryDecode("utf-8", buf);
  if (utf8 !== null) return utf8;

  // Shift_JIS 和 GBK 的字节范围大量重叠，两种都解码，看哪个更像正常文字
  const sjis = tryDecode("shift_jis", buf);
  const gbk = new TextDecoder("gb18030").decode(buf);
  if (sjis === null) return gbk;
  return score(sjis, true) >= score(gbk, false) ? sjis : gbk;
}

function tryDecode(enc: string, buf: Uint8Array): string | null {
  try {
    // stream: true —— 截断处的半个字符不算错误
    return new TextDecoder(enc, { fatal: true }).decode(buf, { stream: true });
  } catch {
    return null;
  }
}

function score(text: string, japanese: boolean): number {
  let s = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x3040 && c <= 0x30ff) s += japanese ? 2 : -2; // 平假名 / 片假名
    else if (c >= 0x4e00 && c <= 0x9fff) s += 1; // 汉字
    else if ((c >= 0x3000 && c <= 0x303f) || (c >= 0xff01 && c <= 0xff5e)) s += 2; // 全角标点、括号
    else if (c >= 0xff61 && c <= 0xff9f) s -= 3; // 半角片假名：GBK 被误当成 Shift_JIS 时大量出现
    else if (c === 0xfffd) s -= 5; // 无法解码的字符
  }
  return s;
}
