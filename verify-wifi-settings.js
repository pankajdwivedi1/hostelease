#!/usr/bin/env node

/**
 * Verify WiFi Settings in Database
 */

const http = require('http');

function getSettings() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/settings',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function verify() {
  try {
    const settings = await getSettings();
    
    console.log('\n✅ WiFi Configuration Verification\n');
    console.log('Full Response:');
    console.log(JSON.stringify(settings, null, 2));
    console.log('\n');
    
    if (!settings.wifiWhitelist || settings.wifiWhitelist.length === 0) {
      console.log('⚠️  wifiWhitelist is empty or undefined');
      return;
    }
    
    console.log('Hostels with WiFi:');
    console.log('─'.repeat(60));
    
    settings.wifiWhitelist.forEach((hostel, i) => {
      console.log(`${i + 1}. ${hostel.hostelName}`);
      console.log(`   📍 Description: ${hostel.description}`);
      console.log(`   🔗 Total BSSIDs: ${hostel.bssids.length}`);
      console.log(`   📡 BSSID List:`);
      hostel.bssids.forEach(bssid => {
        console.log(`      • ${bssid}`);
      });
      console.log();
    });
    
    const totalHostels = settings.wifiWhitelist.length;
    const totalBSSIDs = settings.wifiWhitelist.reduce((sum, h) => sum + h.bssids.length, 0);
    
    console.log('─'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`✅ Total Hostels: ${totalHostels}`);
    console.log(`✅ Total WiFi Routers: ${totalBSSIDs}`);
    console.log('\n✅ All WiFi configurations successfully applied!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verify();
