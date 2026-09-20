import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rows = await prisma.adminSettings.findMany({ 
  select: { id: true, tenantId: true, wifiWhitelist: true } 
});

console.log('Total adminSettings rows:', rows.length);
rows.forEach((r, i) => {
  const wl = Array.isArray(r.wifiWhitelist) ? r.wifiWhitelist : [];
  const ips = wl.filter(w => w && w.ip).map(w => w.ip);
  const bssidEntries = wl.filter(w => w && Array.isArray(w.bssids) && w.bssids.length > 0).length;
  console.log(`\nRow ${i}:`);
  console.log('  tenantId:', r.tenantId);
  console.log('  id:', r.id);
  console.log('  whitelist entries:', wl.length);
  console.log('  IPs in whitelist:', ips);
  console.log('  BSSID entries:', bssidEntries);
});

await prisma.$disconnect();
