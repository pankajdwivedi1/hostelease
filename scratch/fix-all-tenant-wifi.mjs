import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const newWhitelist = [
  { name: 'GAYTRI HOSTEL', hostelName: 'GAYTRI HOSTEL', ip: '103.82.97.12', bssids: ['64:29:95:4d:d2:80','64:29:95:4d:ef:f0','64:29:95:4d:aef:a0','64:29:43:bb:6b:88','64:29:43:bb:6b:00'] },
  { name: 'BOYS HOSTEL', hostelName: 'BOYS HOSTEL', ip: '103.82.97.12', bssids: ['64:29:43:bb:84:b0','64:29:43:bb:89:70','64:ed:07:cc:ee:00','64:29:43:bb:88:e0','64:29:43:bb:89:10'] },
  { name: 'GANGOTRI HOSTEL', hostelName: 'GANGOTRI HOSTEL', ip: '103.82.97.12', bssids: ['64:29:43:bb:78:60','64:29:43:bb:78:68','64:29:43:bb:79:40','64:29:43:bb:79:48','64:29:43:bb:79:20','64:29:43:bb:79:a8','64:29:43:bb:78:b0','64:29:43:bb:78:b8','64:29:43:bb:6f:40','64:29:43:bb:6f:48','64:29:43:bb:79:58','64:29:43:bb:84:f0','64:29:43:bb:84:f8','64:29:43:bb:85:50','64:29:43:bb:85:58'] },
  { name: 'GHB HOSTEL', hostelName: 'GHB HOSTEL', ip: '103.82.97.12', bssids: ['64:29:43:bb:7d:78','64:29:45:bb:76:a0','64:29:2b:3b:bb:76:a8','64:29:43:bb:7d:70','64:29:43:bb:8b:c8'] },
  { name: 'Campus Public IP', hostelName: 'CAMPUS', ip: '103.82.97.12', bssids: [] },
];

// Update BOTH rows to have the correct whitelist
const rows = await prisma.adminSettings.findMany({ select: { id: true, tenantId: true } });

for (const row of rows) {
  await prisma.adminSettings.update({
    where: { id: row.id },
    data: { wifiWhitelist: newWhitelist }
  });
  console.log(`✅ Updated row tenantId: ${row.tenantId} with ${newWhitelist.length} whitelist entries`);
}

// Verify
const updated = await prisma.adminSettings.findMany({ select: { id: true, tenantId: true, wifiWhitelist: true } });
updated.forEach((r, i) => {
  const wl = Array.isArray(r.wifiWhitelist) ? r.wifiWhitelist : [];
  const ips = wl.filter(w => w && w.ip).map(w => w.ip);
  console.log(`\nRow ${i} | tenantId: ${r.tenantId} | entries: ${wl.length} | IPs: ${[...new Set(ips)]}`);
});

await prisma.$disconnect();
