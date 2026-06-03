import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';
import readline from 'readline';

const PORT = 3099;
const REDIRECT_URI = `http://localhost:${PORT}`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('=== Google OAuth2 Refresh Token Generator ===');
  console.log('โปรดกรอกข้อมูลต่อไปนี้จาก Google Cloud Console (OAuth Client ID):');
  
  const clientId = await question('Google Client ID: ');
  const clientSecret = await question('Google Client Secret: ');

  if (!clientId || !clientSecret) {
    console.error('❌ ต้องระบุทั้ง Client ID และ Client Secret');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId.trim(),
    clientSecret.trim(),
    REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // crucial for getting refresh token
    scope: scopes,
    prompt: 'consent' // force consent screen to ensure refresh token is returned
  });

  const server = http.createServer(async (req, res) => {
    try {
      const urlParams = new URL(req.url || '', `http://localhost:${PORT}`);
      const code = urlParams.searchParams.get('code');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>เข้าสู่ระบบสำเร็จแล้ว!</h1><p>คุณสามารถปิดหน้านี้และกลับไปยัง Terminal ได้เลยครับ</p>');
        
        server.close();
        
        console.log('\n⏳ กำลังแลกเปลี่ยน Code เป็น Refresh Token...');
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('\n==================================================');
        console.log('🎉 ได้รับข้อมูลเรียบร้อยแล้ว!');
        console.log('ให้คัดลอกค่าด้านล่างนี้ไปใส่ในไฟล์ .env.local:\n');
        console.log(`GOOGLE_CLIENT_ID=${clientId.trim()}`);
        console.log(`GOOGLE_CLIENT_SECRET=${clientSecret.trim()}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('==================================================\n');
        
        process.exit(0);
      } else {
        res.writeHead(404);
        res.end();
      }
    } catch (err) {
      console.error('❌ เกิดข้อผิดพลาด:', err);
      res.writeHead(500);
      res.end('Error');
      process.exit(1);
    }
  });

  server.listen(PORT, () => {
    console.log(`\n🌐 กำลังเปิดเบราว์เซอร์เพื่อเข้าสู่ระบบ...`);
    // Open in browser
    const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${startCmd} "${authUrl}"`);
    console.log(`หากหน้าต่างไม่เปิดขึ้นมาโดยอัตโนมัติ ให้คลิกลิงก์นี้:`);
    console.log(authUrl);
  });
}

main().catch(console.error);
