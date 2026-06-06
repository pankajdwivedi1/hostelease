const fs = require('fs');
const https = require('https');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

const options = {
  hostname: url.replace('https://', ''),
  path: '/rest/v1/permissions?select=*,students!student_id(name,tenant_id)&order=created_at.desc&limit=10',
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
    const perms = JSON.parse(data);
    perms.forEach(p => console.log(p.students ? p.students.name : 'NO_STUDENT', p.students ? p.students.tenant_id : 'NONE'));
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
