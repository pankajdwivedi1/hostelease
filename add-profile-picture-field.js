// Script to add Profile Picture field to Form Builder
// Run this once: node add-profile-picture-field.js

const mongoose = require('mongoose');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb+srv://pankaj:pankajdwivedi81@cluster0.pqvmg4l.mongodb.net/?retryWrites=true&w=majority';

const AdminSettingsSchema = new mongoose.Schema({}, { strict: false });
const AdminSettings = mongoose.model('AdminSettings', AdminSettingsSchema, 'adminsettings');

async function addProfilePictureField() {
    try {
        await mongoose.connect(MONGODB_URL);
        console.log('✅ Connected to MongoDB');

        const settings = await AdminSettings.findOne();

        if (!settings) {
            console.log('❌ No admin settings found');
            return;
        }

        let formBuilderConfig = settings.formBuilderConfig || [];

        // Check if profile picture field already exists
        const hasProfilePicture = formBuilderConfig.some(f => f.type === 'image' || f.id === 'profilePicture');

        if (hasProfilePicture) {
            console.log('✅ Profile picture field already exists!');
        } else {
            // Add profile picture field at the beginning
            formBuilderConfig.unshift({
                id: 'profilePicture',
                label: 'Profile Picture',
                type: 'image',
                required: true,
                visible: true,
                order: 0
            });

            // Update order for other fields
            formBuilderConfig.forEach((field, index) => {
                if (field.id !== 'profilePicture') {
                    field.order = index;
                }
            });

            await AdminSettings.updateOne({}, { $set: { formBuilderConfig } });
            console.log('✅ Profile picture field added successfully!');
        }

        console.log('\n📋 Current form fields:');
        formBuilderConfig.forEach(f => {
            console.log(`  ${f.visible ? '✓' : '✗'} ${f.label} (${f.type}) - ${f.required ? 'Required' : 'Optional'}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

addProfilePictureField();
