const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Manually load DATABASE_URL from .env.local for local script execution
const envContent = fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf8');
const match = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)?$/m);
if (match && match[1]) {
  process.env.DATABASE_URL = match[1].trim().replace(/^"|"$/g, '');
}

const prisma = new PrismaClient();

async function test() {
  const routes = [
    'http://localhost:3000/api/admin/hostels',
    'http://localhost:3000/api/admin/settings',
    'http://localhost:3000/api/admin/subscription-status',
    'http://localhost:3000/api/admin/field-enforcement',
    'http://localhost:3000/api/admin/attendance-summary'
  ];

  console.log('🚀 Running ETag & HTTP 304 Zero-Egress Tests on Live Server...\n');

  for (const url of routes) {
    const routeName = url.replace('http://localhost:3000', '');
    try {
      // 1. First Request: Fresh fetch (No ETag)
      const res1 = await fetch(url);
      const etag = res1.headers.get('etag');
      const cacheControl = res1.headers.get('cache-control');
      const body1 = await res1.text();
      const bytes1 = Buffer.byteLength(body1);

      console.log('📍 ' + routeName);
      console.log('   Call 1 (Fresh):  Status=' + res1.status + ', Bytes=' + bytes1 + ', ETag=' + etag);

      // 2. Second Request: Conditional fetch with If-None-Match
      const res2 = await fetch(url, {
        headers: { 'If-None-Match': etag || '' }
      });
      const body2 = await res2.text();
      const bytes2 = Buffer.byteLength(body2);

      console.log('   Call 2 (Cached): Status=' + res2.status + ' (Expected 304), Body Bytes=' + bytes2 + ' (Zero Egress!)');

      if (res1.status === 200 && res2.status === 304 && bytes2 === 0) {
        console.log('   ✅ PASS: Perfect 304 Zero-Egress behavior!\n');
      } else {
        console.log('   ⚠️ Review: Status=' + res2.status + '\n');
      }
    } catch (e) {
      console.error('   ❌ ERROR on ' + routeName + ':', e.message);
    }
  }
}

test();
