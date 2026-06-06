const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.log('Missing env vars');
  process.exit(1);
}

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const options = {
  hostname: url.replace('https://', ''),
  path: '/rest/v1/permissions?select=*,students!student_id(*)&order=created_at.desc&limit=1000',
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
