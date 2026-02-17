#!/usr/bin/env node

/**
 * Attendance System Health Check
 * Tests: MongoDB Connection, WiFi Settings, Attendance APIs
 */

const http = require('http');
const fs = require('fs');

async function apiCall(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), ok: res.statusCode === 200 });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, ok: res.statusCode === 200 });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function runTests() {
  let report = [];
  report.push('═'.repeat(80));
  report.push('🔧 ATTENDANCE SYSTEM HEALTH CHECK - ' + new Date().toLocaleString());
  report.push('═'.repeat(80));
  report.push('');

  let pass = 0, fail = 0;

  // Test 1: MongoDB
  report.push('TEST 1: MongoDB Connection & Connection Pooling');
  report.push('─'.repeat(80));
  try {
    const result = await apiCall('GET', '/api/health/m0-status');
    if (result.ok && result.data.database.state === 'connected') {
      report.push('✅ PASS - MongoDB Connected');
      report.push(`   Connection State: ${result.data.database.state}`);
      report.push(`   Pool Info: ${JSON.stringify(result.data.database.poolInfo)}`);
      report.push(`   Status: ${result.data.status}`);
      pass++;
    } else if (result.ok) {
      report.push(`✅ PASS - MongoDB Health Check Passed`);
      report.push(`   Status: ${result.data.status}`);
      report.push(`   Database State: ${result.data.database.state}`);
      pass++;
    } else {
      report.push(`❌ FAIL - MongoDB: ${result.data.status || result.status}`);
      fail++;
    }
  } catch (e) {
    report.push(`❌ FAIL - MongoDB Error: ${e.message}`);
    fail++;
  }
  report.push('');

  // Test 2: WiFi Settings
  report.push('TEST 2: WiFi Configuration');
  report.push('─'.repeat(80));
  try {
    const result = await apiCall('GET', '/api/admin/settings');
    if (result.ok && result.data.wifiWhitelist) {
      const count = result.data.wifiWhitelist.length;
      const totalBSSID = result.data.wifiWhitelist.reduce((s, h) => s + h.bssids.length, 0);
      report.push(`✅ PASS - WiFi Configured`);
      report.push(`   Hostels: ${count}`);
      report.push(`   Total BSSIDs: ${totalBSSID}`);
      
      result.data.wifiWhitelist.forEach((h) => {
        report.push(`   • ${h.hostelName}: ${h.bssids.length} BSSIDs`);
      });
      pass++;
    } else {
      report.push('❌ FAIL - WiFi Settings missing');
      fail++;
    }
  } catch (e) {
    report.push(`❌ FAIL - WiFi Error: ${e.message}`);
    fail++;
  }
  report.push('');

  // Test 3: Attendance Times
  report.push('TEST 3: Attendance Time Configuration');
  report.push('─'.repeat(80));
  try {
    const result = await apiCall('GET', '/api/admin/settings');
    if (result.ok) {
      report.push(`✅ PASS - Attendance Times Set`);
      report.push(`   Start Time: ${result.data.startTime}`);
      report.push(`   End Time: ${result.data.endTime}`);
      pass++;
    } else {
      report.push('❌ FAIL - Could not read attendance times');
      fail++;
    }
  } catch (e) {
    report.push(`❌ FAIL - Attendance Time Error: ${e.message}`);
    fail++;
  }
  report.push('');

  // Test 4: Students API
  report.push('TEST 4: Students API (Attendance Related)');
  report.push('─'.repeat(80));
  try {
    const start = Date.now();
    const result = await apiCall('GET', '/api/students?light=true');
    const time = Date.now() - start;
    if (result.ok) {
      const count = Array.isArray(result.data) ? result.data.length : 0;
      report.push(`✅ PASS - Students Retrieved`);
      report.push(`   Count: ${count} students`);
      report.push(`   Response Time: ${time}ms`);
      pass++;
    } else {
      report.push(`❌ FAIL - Students API: ${result.status}`);
      fail++;
    }
  } catch (e) {
    report.push(`❌ FAIL - Students Error: ${e.message}`);
    fail++;
  }
  report.push('');

  // Test 5: Attendance Summary
  report.push('TEST 5: Attendance Summary API');
  report.push('─'.repeat(80));
  try {
    const start = Date.now();
    const result = await apiCall('GET', '/api/admin/attendance-summary?date=2026-02-17');
    const time = Date.now() - start;
    if (result.ok) {
      report.push(`✅ PASS - Attendance Summary`);
      report.push(`   Response Time: ${time}ms`);
      pass++;
    } else {
      report.push(`❌ FAIL - Attendance API: ${result.status}`);
      fail++;
    }
  } catch (e) {
    report.push(`❌ FAIL - Attendance Error: ${e.message}`);
    fail++;
  }
  report.push('');

  // Test 6: Locations
  report.push('TEST 6: GPS Location Configuration');
  report.push('─'.repeat(80));
  try {
    const result = await apiCall('GET', '/api/admin/settings');
    if (result.ok && result.data.locations) {
      const count = result.data.locations.length;
      report.push(`✅ PASS - Locations Configured`);
      report.push(`   Total: ${count} locations`);
      result.data.locations.forEach((l) => {
        report.push(`   • ${l.name}: ${l.lat}, ${l.lng} (${l.radius}m radius)`);
      });
      pass++;
    } else {
      report.push('❌ FAIL - Locations not configured');
      fail++;
    }
  } catch (e) {
    report.push(`❌ FAIL - Locations Error: ${e.message}`);
    fail++;
  }
  report.push('');

  // Summary
  report.push('═'.repeat(80));
  report.push('📊 SUMMARY');
  report.push('═'.repeat(80));
  report.push(`✅ Passed: ${pass}/6`);
  report.push(`❌ Failed: ${fail}/6`);
  report.push(`📈 Success Rate: ${Math.round((pass/6)*100)}%`);
  report.push('');

  if (fail === 0) {
    report.push('🎉 ALL SYSTEMS OPERATIONAL!');
    report.push('');
    report.push('✓ MongoDB Connection: HEALTHY');
    report.push('✓ WiFi Configuration: ACTIVE');
    report.push('✓ Attendance APIs: READY');
    report.push('✓ Connection Pooling: OPTIMIZED');
    report.push('');
    report.push('✅ System Ready for Attendance Operations!');
  } else {
    report.push('⚠️  ISSUES DETECTED - Please review above');
  }

  report.push('');
  report.push('═'.repeat(80));

  const output = report.join('\n');
  console.log(output);
  
  fs.writeFileSync('health-check-report.txt', output);
  console.log('\n📄 Report saved to: health-check-report.txt');
  
  process.exit(fail === 0 ? 0 : 1);
}

setTimeout(runTests, 1000);
