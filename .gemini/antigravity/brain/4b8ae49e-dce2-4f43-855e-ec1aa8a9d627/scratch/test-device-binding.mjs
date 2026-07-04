import crypto from 'crypto';

async function testDeviceBinding() {
    const studentUID = 'QjkSV8NRNUYPPo1WGa8xdbVpTbh1'; // student: TARU
    const secret = "hosteleaze_secure_gate_key_2026";
    const gateName = "Main Gate";
    const timestamp = Date.now();
    const dataToVerify = `${gateName}:${timestamp}`;
    const signature = crypto.createHmac('sha256', secret).update(dataToVerify).digest('hex');
    const token = `${timestamp}.${signature}`;

    const qrData = JSON.stringify({
        app: "hosteleaze-getpass",
        t: token,
        g: gateName
    });

    console.log("🚀 Testing device binding flow...");

    // Step 1: Force deviceId to 'no-binding' in database via student update PATCH
    // First, find the student's ID
    const studentRes = await fetch(`http://127.0.0.1:3000/api/students?firebaseUID=${studentUID}&tenant=oist`);
    const studentData = await studentRes.json();
    if (!studentData.student) {
        console.error("❌ Student not found in DB");
        return;
    }
    const studentId = studentData.student._id;
    console.log(`👤 Found student ${studentData.student.name} with database ID: ${studentId}`);
    
    console.log("📝 Setting student deviceId to 'no-binding'...");
    const updateRes = await fetch(`http://127.0.0.1:3000/api/students/${studentId}?tenant=oist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'no-binding' })
    });
    const updateData = await updateRes.json();
    console.log(`✅ Device ID updated in DB to: "${updateData.student.deviceId}"`);

    // Step 2: Try scanning with a new deviceId (this should trigger AUTO-BIND because stored is 'no-binding')
    const testDeviceId = "test-device-uuid-123456";
    console.log(`\n📷 Step 2: Scanning with new device ID: "${testDeviceId}"...`);
    const scanRes = await fetch('http://127.0.0.1:3000/api/getpass/scan?tenant=oist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            qrData,
            firebaseUID: studentUID,
            deviceId: testDeviceId
        })
    });
    
    const scanData = await scanRes.json();
    console.log("Scan Response status:", scanRes.status);
    console.log("Scan Response body:", scanData);

    if (scanData.success || scanData.error?.includes("no 'allowed' permission") || scanData.error?.includes("window closed") || scanData.error?.includes("expired")) {
        console.log("✅ Device auto-bind successful or bypassed validation checks.");
    } else {
        console.error("❌ Device auto-bind failed.");
    }

    // Step 3: Fetch student profile again to verify deviceId is now bound to 'test-device-uuid-123456'
    const studentRes2 = await fetch(`http://127.0.0.1:3000/api/students?firebaseUID=${studentUID}&tenant=oist`);
    const studentData2 = await studentRes2.json();
    console.log(`\n👤 Stored device ID in DB is now: "${studentData2.student.deviceId}"`);
    if (studentData2.student.deviceId === testDeviceId) {
        console.log("✅ VERIFIED: Device ID was auto-bound successfully!");
    } else {
        console.error("❌ Device ID was NOT auto-bound.");
    }

    // Step 4: Scan again with a DIFFERENT device ID - should fail with DEVICE_MISMATCH (403)
    const differentDeviceId = "different-device-uuid-789";
    console.log(`\n📷 Step 4: Scanning with mismatching device ID: "${differentDeviceId}"...`);
    const scanRes3 = await fetch('http://127.0.0.1:3000/api/getpass/scan?tenant=oist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            qrData,
            firebaseUID: studentUID,
            deviceId: differentDeviceId
        })
    });
    const scanData3 = await scanRes3.json();
    console.log("Scan Response status:", scanRes3.status);
    console.log("Scan Response body:", scanData3);
    if (scanRes3.status === 403 && scanData3.code === "DEVICE_MISMATCH") {
        console.log("✅ VERIFIED: Different device was successfully blocked with DEVICE_MISMATCH!");
    } else {
        console.error("❌ Mismatching device was NOT blocked correctly.");
    }

    // Step 5: Restore original deviceId or reset it
    console.log("\n🧹 Cleaning up student deviceId to null...");
    await fetch(`http://127.0.0.1:3000/api/students/${studentId}?tenant=oist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'no-binding', isProfileLocked: false })
    });
    console.log("✅ Cleanup complete.");
}

testDeviceBinding();
