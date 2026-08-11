/**
 * TOTP (RFC 6238) 实现，无任何外部依赖。
 * 包含: SHA-1、HMAC-SHA1、Base32 解码、TOTP 生成。
 */

// ---------- SHA-1 ----------
function sha1(message) {
  // message: string (UTF-8) 或 Uint8Array
  const bytes = typeof message === 'string' ? utf8Encode(message) : message;

  // 预处理: 补位到 512 位(64字节)的倍数，最后 8 字节存消息长度(bit)
  const ml = bytes.length * 8;
  const withOne = new Uint8Array(bytes.length + 1);
  withOne.set(bytes);
  withOne[bytes.length] = 0x80;

  const paddedLen = Math.ceil((withOne.length + 8) / 64) * 64;
  const data = new Uint8Array(paddedLen);
  data.set(withOne);
  const dv = new DataView(data.buffer);
  // 大端写入消息长度(bit)
  dv.setUint32(paddedLen - 8, Math.floor(ml / 0x100000000), false);
  dv.setUint32(paddedLen - 4, ml >>> 0, false);

  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;

  const w = new Uint32Array(80);
  for (let off = 0; off < data.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(off + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i < 20)      { f = (b & c) | (~b & d);           k = 0x5A827999; }
      else if (i < 40) { f = b ^ c ^ d;                    k = 0x6ED9EBA1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d);  k = 0x8F1BBCDC; }
      else             { f = b ^ c ^ d;                    k = 0xCA62C1D6; }
      const tmp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = tmp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, h0, false);
  odv.setUint32(4, h1, false);
  odv.setUint32(8, h2, false);
  odv.setUint32(12, h3, false);
  odv.setUint32(16, h4, false);
  return out;
}

// ---------- HMAC-SHA1 ----------
function hmacSha1(key, message) {
  // key: Uint8Array, message: Uint8Array
  const blockSize = 64;
  if (key.length > blockSize) {
    key = sha1(key);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(key);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const inner = new Uint8Array(blockSize + message.length);
  inner.set(ipad);
  inner.set(message, blockSize);
  const innerHash = sha1(inner);

  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(opad);
  outer.set(innerHash, blockSize);
  return sha1(outer);
}

// ---------- Base32 解码 ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(str) {
  const s = str.toUpperCase().replace(/[^A-Z2-7]/g, ''); // 去掉空格、连字符、padding
  const bytes = [];
  let buffer = 0, bitsLeft = 0;
  for (const ch of s) {
    buffer = (buffer << 5) | B32.indexOf(ch);
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >>> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// ---------- 工具 ----------
function utf8Encode(str) {
  return new TextEncoder().encode(str);
}

function rotl(x, n) {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

// ---------- TOTP 生成 ----------
/**
 * 生成 TOTP 验证码
 * @param {string} secret    Base32 编码的密钥 (如 "JBSWY3DPEHPK3PXP")
 * @param {object} [options]
 * @param {number} [options.time]  Unix 时间戳(秒)，默认 Date.now()/1000。支持传入任意时间生成对应验证码
 * @param {number} [options.period]  时间步长秒数，默认 30 (RFC 6238)
 * @param {number} [options.digits]  验证码位数，默认 6
 * @param {number} [options.algorithm] 0=SHA1, 1=SHA256, 2=SHA512 (注: 本实现仅完整支持 SHA1)
 * @returns {string} 验证码
 */
function generateTOTP(secret, options = {}) {
  const { time = Math.floor(Date.now() / 1000), period = 30, digits = 6 } = options;
  const counter = Math.floor(time / period);

  const key = base32Decode(secret);
  const msg = new Uint8Array(8);
  const dv = new DataView(msg.buffer);
  // 8 字节大端整数 counter
  dv.setUint32(0, Math.floor(counter / 0x100000000), false);
  dv.setUint32(4, counter >>> 0, false);

  const hash = hmacSha1(key, msg);

  const offset = hash[hash.length - 1] & 0x0f;
  const binCode =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const mod = Math.pow(10, digits);
  return (binCode % mod).toString().padStart(digits, '0');
}

// ---------- 导出 (Node.js / 浏览器) ----------
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateTOTP, sha1, hmacSha1, base32Decode };
}

// ---------- 自测 ----------
function selfTest() {
  // RFC 6238 附录 B 测试向量: secret = "12345678901234567890" 即 Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const vectors = [
    [59, '94287082', 8],
    [1111111109, '07081804', 8],
    [1111111111, '14050471', 8],
    [1234567890, '89005924', 8],
    [2000000000, '69279037', 8],
    [20000000000, '65353130', 8],
  ];
  let ok = true;
  for (const [t, expect, digits] of vectors) {
    const got = generateTOTP(secret, { time: t, digits });
    const pass = got === expect;
    ok = ok && pass;
    console.log(`time=${t}  digits=${digits}  got=${got}  expect=${expect}  ${pass ? 'PASS' : 'FAIL'}`);
  }
  // 6 位常用格式自检: 只打印, 不比对
  console.log('当前6位验证码:', generateTOTP(secret, { digits: 6 }));
  return ok;
}

if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
