import fetch from 'node-fetch';

const debugFieldEnforcement = async () => {
    const baseURL = 'http://localhost:3000';
    const tenantSlug = 'oist'; 
    const hostels = ['Boys Hostel', 'Gangotri Hostel', 'Gaytri Hostel', 'GHB Hostel'];

    console.log(`--- Debugging Field Enforcement Local for ${hostels.join(', ')} ---`);

    for (const hostel of hostels) {
        try {
            console.log(`Testing ${hostel}...`);
            const response = await fetch(`${baseURL}/api/admin/field-enforcement?tenant=${tenantSlug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hostelName: hostel,
                    enforcedFields: [
                        {
                            fieldId: 'semester',
                            fieldLabel: 'Semester',
                            isEnabled: true,
                            displayMode: 'on-login',
                            order: 1
                        }
                    ],
                    isActive: true,
                    notificationPriority: 'normal',
                    successMessage: 'Updated!',
                    autoCloseNotification: true
                }),
            });

            const data = await response.json();
            console.log(`${hostel} Status:`, response.status);
            if (!response.ok) {
                console.log(`❌ Failed to update ${hostel}:`, JSON.stringify(data, null, 2));
            } else {
                console.log(`✅ Successfully updated ${hostel}.`);
            }
        } catch (e) {
            console.log(`❌ Exception for ${hostel}:`, e.message);
        }
    }
};

debugFieldEnforcement();
