# Field Enforcement Settings Implementation Guide

## Overview
The Field Enforcement Settings feature allows you to:
- ✅ Select which fields are displayed to students after login
- ✅ Configure display timing (on-login, on-first-incomplete, on-next-login)
- ✅ Set duration limits for field display
- ✅ Auto-hide fields after completion
- ✅ Track completion status per student and per hostel
- ✅ Apply rules across multiple hostels simultaneously

## Architecture

### Models
1. **FieldEnforcement** (`models/FieldEnforcement.ts`)
   - Stores configuration rules per hostel
   - Defines which fields are enforced and how they're displayed
   - Manages notification priorities and success messages

2. **StudentFieldProgress** (`models/StudentFieldProgress.ts`)
   - Tracks completion status of enforced fields per student
   - Records completion timestamps
   - Links to field enforcement notifications

### API Endpoints

#### 1. **GET/POST/PUT/DELETE `/api/admin/field-enforcement`**
Manage field enforcement rules

**GET** - Fetch all rules or for specific hostel
```bash
curl "http://localhost:3000/api/admin/field-enforcement?hostelName=Boys%20Hostel"
```

**POST** - Create/update enforcement rules
```bash
curl -X POST http://localhost:3000/api/admin/field-enforcement \
  -H "Content-Type: application/json" \
  -d '{
    "hostelName": "Boys Hostel",
    "enforcedFields": [
      {
        "fieldId": "fatherName",
        "fieldLabel": "Father'\''s Name",
        "isEnabled": true,
        "displayMode": "on-login",
        "durationDays": 7,
        "skipCompleted": true,
        "order": 1
      }
    ],
    "isActive": true,
    "notificationPriority": "normal",
    "successMessage": "All fields completed!",
    "autoCloseNotification": true
  }'
```

#### 2. **GET `/api/admin/field-enforcement/status`**
Get completion status for a hostel

```bash
curl "http://localhost:3000/api/admin/field-enforcement/status?hostelName=Boys%20Hostel"
```

Response includes:
- Overall completion stats (total students, fields, completed count)
- Per-student completion status with field-by-field breakdown
- Completion percentages

#### 3. **GET/POST/PUT `/api/admin/field-enforcement/progress`**
Manage student field completion progress

**POST** - Mark field as completed
```bash
curl -X POST http://localhost:3000/api/admin/field-enforcement/progress \
  -H "Content-Type: application/json" \
  -d '{
    "firebaseUID": "user123",
    "hostelName": "Boys Hostel",
    "fieldId": "fatherName"
  }'
```

**GET** - Get student'\''s field progress
```bash
curl "http://localhost:3000/api/admin/field-enforcement/progress?firebaseUID=user123&hostelName=Boys%20Hostel"
```

**PUT** - Initialize field progress for new enforcement rules
```bash
curl -X PUT http://localhost:3000/api/admin/field-enforcement/progress \
  -H "Content-Type: application/json" \
  -d '{
    "firebaseUID": "user123",
    "hostelName": "Boys Hostel"
  }'
```

## UI Component: FieldEnforcementComponent

Located at: `app/components/FieldEnforcementComponent.tsx`

### Features

#### Configure Rules Tab
1. **Step 1: Select Hostels** - Choose which hostels to apply rules to (multi-select)
2. **Step 2: Select Mandatory Fields** - Choose fields to enforce
3. **Step 3: Configure Selected Fields** - Set display mode, duration, and completion behavior for each field
4. **Step 4: Global Settings** - Set notification priority, success message, and auto-close behavior

#### View Status Tab
- Shows completion statistics per hostel
- Lists all students and their field completion progress
- Color-coded status indicators (Complete ✓ / Pending ⏳)

## Integration with Student Profile

### Example: Update Profile and Mark Fields Complete

```typescript
// After student updates their profile with new field data
const handleProfileUpdate = async (firebaseUID: string, hostelName: string, updatedFields: string[]) => {
  // Mark each updated field as completed
  for (const fieldId of updatedFields) {
    await fetch('/api/admin/field-enforcement/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firebaseUID,
        hostelName,
        fieldId
      })
    });
  }

  // Fetch updated progress
  const response = await fetch(
    `/api/admin/field-enforcement/progress?firebaseUID=${firebaseUID}&hostelName=${hostelName}`
  );
  const data = await response.json();
  
  return data.data;
};
```

### Example: Display Pending Fields to Student

```typescript
// In student profile page
const fetchPendingFields = async (firebaseUID: string, hostelName: string) => {
  const response = await fetch(
    `/api/admin/field-enforcement/progress?firebaseUID=${firebaseUID}&hostelName=${hostelName}`
  );
  const data = await response.json();
  
  if (data.success && data.data.pendingFields.length > 0) {
    // Show notification with pending fields
    return data.data.pendingFields;
  }
  
  return [];
};
```

## Display Modes Explained

### 1. **on-login** (Default)
- Field is displayed every time student logs in
- Until the field is marked complete
- Useful for critical registration fields

### 2. **on-first-incomplete**
- Field is displayed only the first time a student accesses the system
- After completion, it won't appear again
- Good for new fields being added

### 3. **on-next-login**
- Field is displayed on the next login after rule is created
- Appears even if not completed
- Useful for reminders

## Duration Settings

- **No limit** (leave blank): Field displays until student completes it
- **N days**: Field displays for N days, then auto-hides regardless of completion
- Useful for temporary data collection or surveys

## Skip Completed

When enabled (default):
- Field is not displayed after student marks it complete
- Student can still view/edit from profile settings if needed

When disabled:
- Field continues to display even after completion
- Good if you want to remind students of the information they entered

## Database Schema Details

### FieldEnforcement Collection
```typescript
{
  hostelName: "Boys Hostel",
  enforcedFields: [
    {
      fieldId: "fatherName",
      fieldLabel: "Father's Name",
      isEnabled: true,
      displayMode: "on-login",
      durationDays: 7,
      skipCompletedTitle: "✓ Completed",
      skipCompleted: true,
      order: 1
    }
  ],
  isActive: true,
  notificationPriority: "normal",
  successMessage: "All fields completed!",
  autoCloseNotification: true,
  createdAt: Date,
  updatedAt: Date
}
```

### StudentFieldProgress Collection
```typescript
{
  studentId: ObjectId,
  firebaseUID: "user123",
  hostelName: "Boys Hostel",
  fieldId: "fatherName",
  fieldLabel: "Father's Name",
  isCompleted: true,
  completedAt: Date,
  notificationId: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## Best Practices

1. **Start Small**
   - Test with one hostel and 2-3 fields first
   - Monitor completion rates before expanding

2. **Clear Communication**
   - Use meaningful field labels
   - Write clear success messages
   - Consider setting reasonable duration limits

3. **Monitor Progress**
   - Check status tab regularly
   - Look for fields with low completion rates
   - Consider adjusting display modes or durations

4. **Phased Rollout**
   - Add new fields gradually
   - Use "on-first-incomplete" for new fields
   - Give students time to complete before adding more

5. **Auto-Close Settings**
   - Enable auto-close to reduce notification spam
   - Disable for critical fields that need repeated attention

## Troubleshooting

### Fields not appearing to students
1. Check `isActive: true` in rules
2. Verify student hasn't already completed the field
3. Check display mode and duration settings
4. Ensure field enforcement rules are created for student's hostel

### Completion status not updating
1. Verify field enforcement progress API is working
2. Check that firebaseUID matches student's actual UID
3. Ensure hostelName matches student's hostel exactly
4. Check browser console for API errors

### Students seeing completed fields
1. Enable "skipCompleted" checkbox in field configuration
2. Verify the field is marked as completed in database
3. Check if durationDays limit has passed

## Future Enhancements

- [ ] Bulk initialization of field progress when rules are created
- [ ] Email/SMS notifications for pending fields
- [ ] Field completion deadlines with escalation
- [ ] Export completion reports as CSV/PDF
- [ ] Scheduled field deployment (activate at specific time)
- [ ] A/B testing different display modes
- [ ] Student preference to hide fields temporarily

---

**Last Updated**: February 17, 2026
**Version**: 1.0.0
