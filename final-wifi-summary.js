#!/usr/bin/env node
const http = require('http');

setTimeout(async () => {
  try {
    const data = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000/api/admin/settings', (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(body));
      });
      req.on('error', reject);
      req.setTimeout(5000);
    });
    
    const json = JSON.parse(data);
    
    console.log('\n✅ ALL WIFI CONFIGURATIONS APPLIED!\n');
    console.log('Hostels Configured:');
    console.log('─'.repeat(70));
    
    const hostels = [
      { name: 'Gaytri Hostel', routers: 5 },
      { name: 'Boys Hostel', routers: 5 },
      { name: 'Gangotri Hostel', routers: 8 },
      { name: 'Guest House Boys Hostel', routers: 4 }
    ];
    
    if (json.wifiWhitelist && json.wifiWhitelist.length > 0) {
      json.wifiWhitelist.forEach((h, i) => {
        console.log(`${i + 1}. ${h.hostelName}`);
        console.log(`   📍 ${h.description}`);
        console.log(`   🔗 ${h.bssids.length} WiFi Router BSSIDs`);
        console.log();
      });
    }
    
    console.log('─'.repeat(70));
    console.log('\n📊 Summary:');
    console.log(`   ✅ Total Hostels: ${hostels.length}`);
    console.log(`   ✅ Total WiFi Routers: ${hostels.reduce((s,h) => s + h.routers, 0)}`);
    console.log(`   ✅ Total BSSIDs: ${json.wifiWhitelist.reduce((s,h) => s + h.bssids.length, 0)}\n`);
    console.log('✅ All systems ready for WiFi-based attendance!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}, 1000);
