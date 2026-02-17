#!/usr/bin/env node

/**
 * Test Permissions API
 */

const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n📡 ${path}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body:`, data.substring(0, 500));
        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Error on ${path}:`, err.message);
      reject();
    });

    req.setTimeout(5000);
    req.end();
  });
}

async function test() {
  console.log('🧪 Testing Permissions API\n');
  
  try {
    await makeRequest('/api/permissions?light=true');
    await makeRequest('/api/permissions');
  } catch (e) {
    console.error('Test failed:', e.message);
  }
}

setTimeout(test, 1000);
