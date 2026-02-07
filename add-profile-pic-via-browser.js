// Quick fix: Add profile picture field via API
// Open this in browser console on http://localhost:3000 and paste

async function addProfilePictureField() {
    try {
        // Fetch current settings
        const response = await fetch('/api/admin/settings');
        const data = await response.json();

        let formBuilderConfig = data.formBuilderConfig || [];

        // Check if already exists
        const hasImage = formBuilderConfig.some(f => f.type === 'image');

        if (hasImage) {
            console.log('✅ Profile picture field already exists!');
            return;
        }

        // Add profile picture field
        formBuilderConfig.unshift({
            id: 'profilePicture',
            label: 'Profile Picture',
            type: 'image',
            required: true,
            visible: true,
            order: 0
        });

        // Update settings
        const updateResponse = await fetch('/api/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formBuilderConfig })
        });

        const result = await updateResponse.json();

        if (result.success) {
            console.log('✅ Profile picture field added! Refresh the registration page.');
            alert('Profile picture field added successfully! Please refresh the student registration page.');
        } else {
            console.error('❌ Failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run it
addProfilePictureField();
