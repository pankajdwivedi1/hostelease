# Student Attendance Mode Override

## Changes
- **Database Schema**: Added `attendanceMode` field to `Student` model.
  - Options: `default`, `strict`, `gps-only`, `biometric`.
  - Default: `default` (Follows hostel settings).
- **Admin Dashboard**:
  - Added "Security Level" button in Student Details modal (next to Reset Device ID).
  - Allows Admins to override attendance mode for individual students.
  - Three options provided as requested:
    - 🛡️ **Default**: Follows global hostel rules.
    - 📍 **GPS Only**: For students with device/camera issues.
    - 👆 **Biometric**: Uses device sensors (FaceID/TouchID).
    - 📸 **Camera**: Strict photo matching.

## How to Use
1. Open **Admin Dashboard**.
2. Click on a **Student** to view details.
3. Click the **Security** button (Shield/Icon) near the "Reset Device ID" button.
4. Select the desired attendance mode for that specific student.
