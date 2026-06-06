const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const options = {
  hostname: url.replace('https://', ''),
  path: '/rest/v1/permissions?select=id&limit=1',
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'count=exact'
  }
};

const req = https.request(options, (res) => {
  console.log('Count:', res.headers['content-range']);
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
