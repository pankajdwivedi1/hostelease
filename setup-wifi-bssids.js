#!/usr/bin/env node

/**
 * WiFi BSSID Configuration Tool
 * 
 * This script helps you add WiFi router BSSIDs to your hostel system
 * without touching the code. Updates AdminSettings in MongoDB.
 * 
 * Usage:
 * 1. Update wifi-bssids-config.json with your router information
 * 2. Run: node setup-wifi-bssids.js
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
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

async function setupWiFiBSSIDs() {
  try {
    log(colors.cyan, '\n🔧 WiFi BSSID Configuration Tool\n');

    // Load config
    const configPath = path.join(__dirname, 'wifi-bssids-config.json');
    if (!fs.existsSync(configPath)) {
      log(colors.red, '❌ Error: wifi-bssids-config.json not found!');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    log(colors.blue, '📋 Configuration loaded:\n');

    // Build wifiWhitelist array from config
    const wifiWhitelist = [];
    
    for (const hostel of config.hostels) {
      if (hostel.floors.length === 0) {
        log(colors.yellow, `⏭️  Skipping ${hostel.hostelName} (no floors configured yet)`);
        continue;
      }

      const allBSSIDs = [];
      let routerCount = 0;

      for (const floorData of hostel.floors) {
        for (const router of floorData.routers) {
          allBSSIDs.push(...router.bssids);
          routerCount++;
        }
      }

      wifiWhitelist.push({
        hostelName: hostel.hostelName,
        bssids: allBSSIDs,
        description: `${hostel.description} - ${routerCount} routers`
      });

      log(colors.green, `✅ ${hostel.hostelName}`);
      log(colors.blue, `   - Floors: ${hostel.floors.map(f => f.floor).join(', ')}`);
      log(colors.blue, `   - Total routers: ${routerCount}`);
      log(colors.blue, `   - Total BSSIDs: ${allBSSIDs.length}\n`);
    }

    // Print summary
    log(colors.cyan, '\n📊 Summary:');
    log(colors.blue, `   - Hostels configured: ${wifiWhitelist.length}`);
    log(colors.blue, `   - Total WiFi routers: ${wifiWhitelist.reduce((sum, h) => sum + (h.bssids.length), 0)}`);

    // Save to update file
    const updatePayload = { wifiWhitelist };
    const updateFilePath = path.join(__dirname, 'wifi-update-payload.json');
    fs.writeFileSync(updateFilePath, JSON.stringify(updatePayload, null, 2));

    log(colors.green, `\n✅ Configuration ready!\n`);
    log(colors.yellow, '📝 Next Steps:\n');
    log(colors.blue, '1️⃣  Option A - Update via API (Recommended):');
    log(colors.cyan, `   curl -X POST http://localhost:3000/api/admin/settings \\`);
    log(colors.cyan, `     -H "Content-Type: application/json" \\`);
    log(colors.cyan, `     -d @wifi-update-payload.json\n`);

    log(colors.blue, '2️⃣  Option B - Use MongoDB Admin Dashboard:');
    log(colors.cyan, `   Go to MongoDB Atlas > Collections > AdminSettings`);
    log(colors.cyan, `   Update the wifiWhitelist field\n`);

    log(colors.blue, '3️⃣  Option C - View the JSON payload:');
    log(colors.cyan, `   cat wifi-update-payload.json\n`);

    // Display the payload
    log(colors.yellow, '📄 Payload Preview:\n');
    console.log(JSON.stringify(updatePayload, null, 2));

    log(colors.green, `\n✅ Saved to: wifi-update-payload.json\n`);

  } catch (error) {
    log(colors.red, '❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  setupWiFiBSSIDs();
}

module.exports = { setupWiFiBSSIDs };
