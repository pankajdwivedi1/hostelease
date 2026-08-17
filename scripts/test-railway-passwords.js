const { Client } = require('pg');

const candidates = [
  "PiUUSLCdzQvIPfhQEggBWSrNwOzTdVl",
  "PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl",
  "PiUUSLCdzQvIPfhQEggBwSrNwOzTdVl",
  "PiUUSLCdzQvIPfhQEggBWSrNwOzTdVl",
  "PiUUSLCdzQvIPfhQEggBWsrNwOzTdVl",
  "PiUUSLCdzQvIPfhQEggbWSrNwOzTdVl"
];

async function testAll() {
  for (const pw of candidates) {
    const url = `postgresql://postgres:${encodeURIComponent(pw)}@thomas.proxy.rlwy.net:25119/railway`;
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`\n🎉 RAILWAY PASSWORD FOUND! Password is: ${pw}`);
      await client.end();
      return pw;
    } catch (e) {
      console.log(`Failed for password ${pw.slice(0, 8)}... : ${e.message}`);
      try { await client.end(); } catch(_) {}
    }
  }
}

testAll();
