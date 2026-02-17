#!/usr/bin/env node

/**
 * Apply WiFi Settings via API
 * 
 * This script reads wifi-update-payload.json and updates your admin settings
 * Usage: node apply-wifi-settings.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(`${color}${args.join(' ')}${colors.reset}`);
}

async function applyWiFiSettings(host = 'localhost', port = 3000) {
  try {
    log(colors.cyan, '\n🌐 Applying WiFi Settings via API\n');

    const payloadPath = path.join(__dirname, 'wifi-update-payload.json');
    
    if (!fs.existsSync(payloadPath)) {
      log(colors.red, '❌ Error: wifi-update-payload.json not found!');
      log(colors.yellow, '⚠️  Run: node setup-wifi-bssids.js first\n');
      process.exit(1);
    }

    const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
    const jsonString = JSON.stringify(payload);

    log(colors.blue, `📡 Connecting to API: http://${host}:${port}/api/admin/settings`);
    log(colors.blue, `📤 Sending ${payload.wifiWhitelist.length} hostel configurations...\n`);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: port,
        path: '/api/admin/settings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': jsonString.length
        }
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode === 200 && response.success) {
              log(colors.green, `✅ Success! WiFi settings applied.\n`);
              log(colors.blue, '📊 Updated configuration:');
              
              response.settings?.wifiWhitelist?.forEach((hostel, i) => {
                log(colors.cyan, `\n  ${i + 1}. ${hostel.hostelName}`);
                log(colors.blue, `     📍 ${hostel.description}`);
                log(colors.blue, `     🔗 ${hostel.bssids.length} WiFi routers (BSSIDs)`);
              });

              log(colors.green, '\n✅ All hostels updated!\n');
              resolve();
            } else {
              log(colors.red, `❌ Error: ${response.error || 'Unknown error'}\n`);
              reject(new Error(response.error));
            }
          } catch (e) {
            log(colors.red, '❌ Error parsing response:', e.message);
            reject(e);
          }
        });
      });

      req.on('error', (error) => {
        log(colors.red, `❌ Connection error: ${error.message}`);
        log(colors.yellow, `\n⚠️  Make sure your server is running:`);
        log(colors.cyan, `   npm run dev\n`);
        reject(error);
      });

      req.write(jsonString);
      req.end();
    });

  } catch (error) {
    log(colors.red, '❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  applyWiFiSettings()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { applyWiFiSettings };
