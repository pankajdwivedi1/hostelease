# HostelEaze Android Production Keystore Details

This file contains the permanent cryptographic signing credentials and fingerprints for the HostelEaze Android application. **Keep this file and `hosteleaze-release.jks` secure.**

---

## 1. Keystore Configuration & Credentials

* **Keystore File Location:** `android/app/hosteleaze-release.jks`
* **Key Alias:** `hosteleaze`
* **Keystore Password:** `HostelEaze@2026`
* **Key Password:** `HostelEaze@2026`
* **Encryption Type:** RSA 2048-bit with `SHA384withRSA` digital signature
* **Format:** PKCS12 (Standard Industry Keystore Format)
* **Validity:** Valid until **February 23, 2054** (~30 years)
* **Distinguished Name (DName):**
  * **CN (Common Name):** `HostelEaze`
  * **OU (Organizational Unit):** `HostelEaze App`
  * **O (Organization):** `HostelEaze`
  * **L (City/Locality):** `Bhopal`
  * **ST (State):** `Madhya Pradesh`
  * **C (Country):** `IN`

---

## 2. Certificate Digital Fingerprints

### 🌟 Production Keystore (`hosteleaze-release.jks`)
* **SHA-1 Fingerprint:**
  ```text
  6C:55:B4:2A:6A:53:C2:94:D0:BC:52:25:38:89:CA:48:2F:CD:6B:17
  ```
* **SHA-256 Fingerprint:**
  ```text
  0F:9C:E2:82:B6:F5:B7:2A:40:6C:DB:65:C1:CB:E0:D8:D1:FD:A2:50:AE:D6:74:11:3F:2D:DF:B8:9E:AD:AF:CC
  ```

---

### 🛠️ Local Debug Keystore (`debug.keystore`) - For Reference
* **SHA-1 Fingerprint:**
  ```text
  5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
  ```
* **SHA-256 Fingerprint:**
  ```text
  FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
  ```

---

## 3. Gradle Signing Configuration (`android/app/build.gradle`)

```groovy
signingConfigs {
    release {
        storeFile file('hosteleaze-release.jks')
        storePassword 'HostelEaze@2026'
        keyAlias 'hosteleaze'
        keyPassword 'HostelEaze@2026'
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

---

## 4. Google Play Store & Firebase Reference

* **Firebase Project ID:** `hostelease-81056`
* **Package Name (Application ID):** `com.hosteleaze.app`
* **Google OAuth Web Client ID:** `729813273338-btdk8vrja4u1eqmba6hdi3cicp0d4n4h.apps.googleusercontent.com`
