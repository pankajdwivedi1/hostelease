const v8 = require('v8');

function formatMB(bytes) {
  return Math.round((bytes / 1024 / 1024) * 100) / 100 + ' MB';
}

console.log('==========================================');
console.log('📊 NODE.JS PRODUCTION MEMORY AUDIT');
console.log('==========================================');
const mem = process.memoryUsage();
const stats = v8.getHeapStatistics();

console.log(`- Active Heap Used:     ${formatMB(mem.heapUsed)}`);
console.log(`- Allocated Heap Total: ${formatMB(mem.heapTotal)}`);
console.log(`- Total Process RAM:    ${formatMB(mem.rss)}`);
console.log(`- V8 Max Heap Limit:    ${formatMB(stats.heap_size_limit)}`);
console.log('==========================================');
