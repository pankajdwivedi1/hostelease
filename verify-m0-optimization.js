#!/usr/bin/env node

/**
 * 🔍 M0 Optimization Verification Checklist
 * Run this to verify all optimizations are properly implemented
 */

const fs = require('fs');
const path = require('path');

const checks = [
  {
    name: "MongoDB Connection Pool Optimization",
    file: "lib/mongodb.ts",
    required: ["maxPoolSize: 3", "socketTimeoutMS: 30000", "waitQueueTimeoutMS: 5000"],
    description: "Ultra-aggressive pooling for M0 cluster"
  },
  {
    name: "Request Rate Limiting",
    file: "lib/requestLimiter.ts",
    required: ["checkRateLimit", "MAX_REQUESTS_PER_WINDOW = 2"],
    description: "Prevents connection floods from single student"
  },
  {
    name: "Attendance Queue System",
    file: "lib/attendanceQueue.ts",
    required: ["queueAttendance", "insertMany", "MAX_BATCH_SIZE = 50"],
    description: "Batches attendance records to reduce DB operations"
  },
  {
    name: "Attendance Endpoint Optimization",
    file: "app/api/students/attendance/route.ts",
    required: [".lean()", "checkRateLimit", "queueAttendance"],
    description: "Rate limiting and query optimization in endpoint"
  },
  {
    name: "Face Match Query Optimization",
    file: "app/api/attendance/face-match/route.ts",
    required: [".lean()", ".select('faceDescriptor"],
    description: "Optimized face descriptor queries"
  },
  {
    name: "Database Indexes",
    file: "models/Attendance.ts",
    required: ["studentId: 1, date: 1", "date: 1, hostelName: 1", "index({ date: 1, needsReview: 1 })"],
    description: "Compound indexes for fast queries"
  },
  {
    name: "Health Check Endpoint",
    file: "app/api/health/m0-status/route.ts",
    required: ["getQueueStatus", "getRateLimitStatus", "poolInfo"],
    description: "Monitor optimization metrics"
  },
  {
    name: "Index Creation Script",
    file: "sync-indexes.js",
    required: ["syncIndexes", "Attendance.syncIndexes()"],
    description: "Script to create MongoDB indexes"
  },
  {
    name: "Documentation",
    file: "M0-OPTIMIZATION-1000-STUDENTS.md",
    required: ["1000+ Students", "maxPoolSize: 3", "Deployment Steps"],
    description: "Comprehensive optimization guide"
  }
];

function checkFile(filePath, requiredStrings) {
  try {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      return { passed: false, reason: "File not found" };
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const missing = [];

    for (const str of requiredStrings) {
      if (!content.includes(str)) {
        missing.push(str);
      }
    }

    if (missing.length === 0) {
      return { passed: true };
    } else {
      return { passed: false, reason: `Missing: ${missing.join(", ")}` };
    }
  } catch (error) {
    return { passed: false, reason: error.message };
  }
}

console.log("\n" + "=".repeat(80));
console.log("🔍 M0 OPTIMIZATION VERIFICATION CHECKLIST");
console.log("=".repeat(80) + "\n");

let passed = 0;
let failed = 0;

checks.forEach((check, index) => {
  const result = checkFile(check.file, check.required);
  const status = result.passed ? "✅ PASS" : "❌ FAIL";

  console.log(`${index + 1}. ${check.name}`);
  console.log(`   File: ${check.file}`);
  console.log(`   Status: ${status}`);
  console.log(`   Description: ${check.description}`);
  if (!result.passed) {
    console.log(`   Reason: ${result.reason}`);
  }
  console.log();

  if (result.passed) {
    passed++;
  } else {
    failed++;
  }
});

console.log("=".repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log("✨ ALL OPTIMIZATIONS VERIFIED! ✨\n");
  console.log("Next steps:");
  console.log("1. Run: node sync-indexes.js");
  console.log("2. Deploy to production");
  console.log("3. Monitor: http://localhost:3000/api/health/m0-status");
  console.log("4. Check MongoDB Atlas for connection metrics\n");
  process.exit(0);
} else {
  console.log("⚠️ Some optimizations are missing. Review the failures above.\n");
  process.exit(1);
}
