#!/usr/bin/env node

/**
 * 🚀 MongoDB Index Creation Script for M0 Optimization
 * Run this once after deploying to create all required indexes
 * 
 * Usage: node sync-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  console.error('❌ MONGODB_URL not found in .env.local');
  process.exit(1);
}

async function syncIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URL, {
      bufferCommands: false,
      maxPoolSize: 3,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected to MongoDB');

    // Import models
    const Attendance = require('./models/Attendance').default;
    const Student = require('./models/Student').default;

    console.log('\n🔍 Syncing Attendance indexes...');
    await Attendance.syncIndexes();
    console.log('✅ Attendance indexes synced');

    console.log('\n🔍 Syncing Student indexes...');
    await Student.syncIndexes();
    console.log('✅ Student indexes synced');

    // List all indexes
    console.log('\n📊 Current Attendance Indexes:');
    const indexes = await Attendance.collection.getIndexes();
    Object.entries(indexes).forEach(([name, spec]) => {
      console.log(`  - ${name}:`, spec);
    });

    console.log('\n✨ Index creation completed successfully!');
    console.log('⚡ M0 cluster is now optimized for 1000+ students');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing indexes:', error.message);
    process.exit(1);
  }
}

syncIndexes();
