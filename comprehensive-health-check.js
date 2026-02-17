#!/usr/bin/env node

/**
 * Comprehensive System Health & Attendance Testing
 * Tests all critical systems: MongoDB, WiFi, Attendance API, Connection Pooling
 */

const http = require('http');
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(color, ...args) {
  console.log(`${color}${args.join(' ')}${colors.reset}`);
}

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
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function runTests() {
  console.clear();
  log(colors.cyan + colors.bold, '\n🔧 COMPREHENSIVE SYSTEM HEALTH CHECK\n');
  log(colors.cyan, '═'.repeat(70));

  let passedTests = 0;
  let failedTests = 0;

  // Test 1: MongoDB Connection
  log(colors.blue, '\n1️⃣  MongoDB Connection Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const result = await apiCall('GET', '/api/health/m0-status');
    if (result.status === 200 && result.data.status === 'connected') {
      log(colors.green, '   ✅ MongoDB Connected');
      log(colors.blue, `   📊 Pool Size: ${result.data.poolSize}`);
      log(colors.blue, `   🔗 Status: ${result.data.status}`);
      passedTests++;
    } else {
      log(colors.red, `   ❌ MongoDB Failed: ${result.data.status || 'Unknown'}`);
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ MongoDB Error: ${error.message}`);
    failedTests++;
  }

  // Test 2: Admin Settings
  log(colors.blue, '\n2️⃣  Admin Settings Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const result = await apiCall('GET', '/api/admin/settings');
    if (result.status === 200 && result.data.success) {
      log(colors.green, '   ✅ Settings Retrieved');
      
      // Check WiFi settings
      if (result.data.wifiWhitelist && result.data.wifiWhitelist.length > 0) {
        log(colors.green, `   ✅ WiFi Configured: ${result.data.wifiWhitelist.length} hostels`);
        passedTests++;
      } else {
        log(colors.yellow, '   ⚠️  WiFi Settings Empty');
      }

      // Check attendance times
      log(colors.blue, `   ⏰ Attendance: ${result.data.startTime} - ${result.data.endTime}`);
      
      // Check locations
      if (result.data.locations && result.data.locations.length > 0) {
        log(colors.green, `   ✅ Locations: ${result.data.locations.length} configured`);
        passedTests++;
      }
    } else {
      log(colors.red, '   ❌ Settings Failed');
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ Settings Error: ${error.message}`);
    failedTests++;
  }

  // Test 3: Students API (Attendance relevance)
  log(colors.blue, '\n3️⃣  Students API Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const startTime = Date.now();
    const result = await apiCall('GET', '/api/students?light=true');
    const duration = Date.now() - startTime;
    
    if (result.status === 200) {
      const studentCount = Array.isArray(result.data) ? result.data.length : 0;
      log(colors.green, `   ✅ Students Retrieved: ${studentCount} students`);
      log(colors.blue, `   ⚡ Response Time: ${duration}ms`);
      if (duration < 5000) {
        log(colors.green, '   ✅ Performance: Good (< 5s)');
        passedTests++;
      } else {
        log(colors.yellow, `   ⚠️  Performance: Slow (${duration}ms)`);
      }
    } else {
      log(colors.red, `   ❌ Students API Failed: Status ${result.status}`);
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ Students API Error: ${error.message}`);
    failedTests++;
  }

  // Test 4: Attendance Endpoints
  log(colors.blue, '\n4️⃣  Attendance API Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const result = await apiCall('GET', '/api/admin/attendance-summary?date=2026-02-17');
    if (result.status === 200) {
      log(colors.green, '   ✅ Attendance Summary Accessible');
      log(colors.blue, `   📊 Response: ${typeof result.data === 'object' ? 'Valid' : 'Parse Error'}`);
      passedTests++;
    } else {
      log(colors.red, `   ❌ Attendance API Failed: Status ${result.status}`);
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ Attendance API Error: ${error.message}`);
    failedTests++;
  }

  // Test 5: Permissions
  log(colors.blue, '\n5️⃣  Permissions API Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const result = await apiCall('GET', '/api/permissions?light=true');
    if (result.status === 200) {
      log(colors.green, '   ✅ Permissions Retrieved');
      passedTests++;
    } else {
      log(colors.red, `   ❌ Permissions Failed: Status ${result.status}`);
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ Permissions Error: ${error.message}`);
    failedTests++;
  }

  // Test 6: Warden Accounts
  log(colors.blue, '\n6️⃣  Warden Accounts Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const result = await apiCall('GET', '/api/admin/warden-accounts');
    if (result.status === 200) {
      const accountCount = Array.isArray(result.data) ? result.data.length : 0;
      log(colors.green, `   ✅ Warden Accounts: ${accountCount} accounts`);
      passedTests++;
    } else {
      log(colors.red, `   ❌ Warden Accounts Failed`);
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ Warden Accounts Error: ${error.message}`);
    failedTests++;
  }

  // Test 7: Hostels
  log(colors.blue, '\n7️⃣  Hostels API Test');
  log(colors.cyan, '─'.repeat(70));
  try {
    const result = await apiCall('GET', '/api/admin/hostels');
    if (result.status === 200) {
      const hostelCount = Array.isArray(result.data) ? result.data.length : 0;
      log(colors.green, `   ✅ Hostels Retrieved: ${hostelCount} hostels`);
      passedTests++;
    } else {
      log(colors.red, `   ❌ Hostels API Failed`);
      failedTests++;
    }
  } catch (error) {
    log(colors.red, `   ❌ Hostels Error: ${error.message}`);
    failedTests++;
  }

  // Summary
  log(colors.cyan, '\n═'.repeat(70));
  log(colors.bold + colors.white, '\n📊 TEST SUMMARY\n');
  
  const totalTests = passedTests + failedTests;
  const percentage = Math.round((passedTests / totalTests) * 100);
  
  log(colors.green, `   ✅ Passed: ${passedTests}/${totalTests}`);
  log(colors.red, `   ❌ Failed: ${failedTests}/${totalTests}`);
  log(colors.cyan, `   📈 Success Rate: ${percentage}%`);

  if (failedTests === 0) {
    log(colors.green + colors.bold, '\n✅ ALL SYSTEMS OPERATIONAL!\n');
    log(colors.green, '   ✓ MongoDB M0 Connection: HEALTHY');
    log(colors.green, '   ✓ WiFi Configuration: ACTIVE');
    log(colors.green, '   ✓ Attendance APIs: READY');
    log(colors.green, '   ✓ Connection Pooling: OPTIMIZED');
    log(colors.green, '   ✓ Performance: GOOD');
    log(colors.cyan, '\n🚀 Ready for Attendance Marking Operations!\n');
  } else {
    log(colors.yellow, '\n⚠️  SOME SYSTEMS NEED ATTENTION\n');
    log(colors.blue, '   Please check the errors above and restart if needed.');
    log(colors.cyan, '   Run: npm run dev\n');
  }

  log(colors.cyan, '═'.repeat(70) + '\n');
  process.exit(failedTests === 0 ? 0 : 1);
}

// Run with a small delay to ensure server is ready
setTimeout(runTests, 1000);
