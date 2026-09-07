// 二维码登录网易云音乐，将 cookie 保存到 user/ncm-cookie.txt
// 用法: npm run ncm:login
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NCM_BASE = process.env.NCM_BASE || 'http://localhost:3000';
const COOKIE_PATH = path.join(__dirname, '..', 'user', 'ncm-cookie.txt');
const QR_IMG_PATH = path.join(__dirname, '..', 'assets', 'ncm-login-qr.png');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ncmGet(endpoint) {
  const res = await fetch(`${NCM_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  // 1. 获取二维码 key
  const keyData = await ncmGet(`/login/qr/key?timestamp=${Date.now()}`);
  const unikey = keyData?.data?.unikey;
  if (!unikey) throw new Error('获取二维码 key 失败：' + JSON.stringify(keyData));

  // 2. 生成二维码
  const qrData = await ncmGet(`/login/qr/create?key=${unikey}&qrimg=true`);
  const qrimg = qrData?.data?.qrimg;
  const qrurl = qrData?.data?.qrurl;
  if (!qrimg) throw new Error('生成二维码失败：' + JSON.stringify(qrData));

  fs.writeFileSync(QR_IMG_PATH, Buffer.from(qrimg, 'base64'));
  console.log('\n  请用「手机网易云音乐 App」扫码登录：');
  console.log(`    → 打开图片: ${QR_IMG_PATH}`);
  if (qrurl) console.log(`    → 或浏览器访问: ${qrurl}`);
  console.log('   （App 内：我的 → 扫一扫）\n');

  // 3. 轮询扫码状态
  for (let i = 0; i < 120; i++) {
    await sleep(3000);
    const check = await ncmGet(`/login/qr/check?key=${unikey}&timestamp=${Date.now()}`);
    const code = check?.code;

    if (code === 803) {
      const cookie = check?.cookie || '';
      if (!cookie) {
        console.error('登录成功但未返回 cookie，请重试或改用「手动填 cookie」方式。');
        process.exit(1);
      }
      fs.writeFileSync(COOKIE_PATH, cookie, 'utf-8');
      console.log('✅ 登录成功，cookie 已保存到 user/ncm-cookie.txt');
      try { fs.unlinkSync(QR_IMG_PATH); } catch {}
      console.log('   重启后端（npm run dev）后即可播放付费歌曲。');
      process.exit(0);
    }

    if (code === 800) { console.log('❌ 二维码已过期，请重新运行 npm run ncm:login'); process.exit(1); }
    if (code === 801) { if (i % 5 === 0) console.log('   等待扫码...'); }
    else if (code === 802) console.log('   已扫码，请在手机上点击「确认登录」...');
    else console.log(`   状态码: ${code}`);
  }

  console.log('❌ 登录超时（6 分钟未扫码），请重新运行。');
  process.exit(1);
}

main().catch((err) => {
  console.error('[ncm-login]', err.message);
  console.error('   请确认网易云 API 服务已在 http://localhost:3000 运行。');
  process.exit(1);
});
