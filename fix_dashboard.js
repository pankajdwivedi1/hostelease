const fs = require('fs');
const path = 'c:/Users/PANKAJ DWIVEDI/Desktop/hostelease/app/components/StudentDashboard.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

// The ternary ends at 2240-2242.
// Everything from 2243 to 2335 is modals.
// Line 2336 starts: false && showPaymentModal && (
// It has nested divs: 2337 (fixed), 2338 (bg-white), 2339 (p-6-header-border), 2355 (overflow-y-auto)
// Header (3) closes at 2353.
// Overflow (4) starts at 2355.
// Inside (4) is paymentHistory at 2539.
// paymentHistory (5) closes at 2558.
// We need to close (4) at 2559, (2) at 2560, (1) at 2561, and finally (block) at 2562.

lines[2558] = '                  </div>'; // closes (4)
lines[2559] = '                </div>'; // closes (2)
lines[2560] = '              </div>'; // closes (1)
lines[2561] = '            )}'; // closes block 2336

// Remove the ghosts at 2563-2564
lines.splice(2562, 2);

fs.writeFileSync(path, lines.join('\n'));
console.log('Ghost cleanup completed');
