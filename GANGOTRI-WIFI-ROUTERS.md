# Gangotri Hostel WiFi Routers - Configuration Reference

## **Complete List of Configured BSSIDs**

This document lists all WiFi router BSSIDs configured for Gangotri Hostel attendance verification.

---

## **Ground Floor (Floor 0):**

### **Router: OGH_F0_1**
- **2.4 GHz BSSID:** `64:29:43:bb:78:60`
- **5 GHz BSSID:** `64:29:43:bb:78:68`
- **Signal Strength:** Good (-57 to -68 dBm)
- **Coverage:** Ground floor area

### **Router: OGH_F0_2**
- **2.4 GHz BSSID:** `64:29:43:bb:79:40`
- **5 GHz BSSID:** `64:29:43:bb:79:48`
- **Signal Strength:** Excellent (-42 to -57 dBm)
- **Coverage:** Ground floor area (primary router)

---

## **First Floor:**

### **Router: OGH_F1_2**
- **2.4 GHz BSSID:** `64:29:43:bb:79:20`
- **5 GHz BSSID:** `64:29:43:bb:79:a8`
- **Signal Strength:** Moderate (-59 to -77 dBm)
- **Coverage:** First floor area

### **Router: OGH_F1_3**
- **2.4 GHz BSSID:** `64:29:43:bb:78:b0`
- **5 GHz BSSID:** `64:29:43:bb:78:b8`
- **Signal Strength:** Good (-56 to -62 dBm)
- **Coverage:** First floor area

---

## **Second Floor:**

### **Router: OGH_F2_3**
- **2.4 GHz BSSID:** `64:29:43:bb:6f:40`
- **5 GHz BSSID:** `64:29:43:bb:6f:48`
- **Signal Strength:** Moderate (-66 to -67 dBm)
- **Coverage:** Second floor area

### **Router: OGH_F2_4**
- **5 GHz BSSID:** `64:29:43:bb:79:58`
- **Signal Strength:** Weak (-85 dBm)
- **Coverage:** Second floor area (limited)
- **Note:** 2.4GHz band not detected (may be disabled)

---

## **Third Floor:**

### **Router: OGH_F3_3**
- **2.4 GHz BSSID:** `64:29:43:bb:84:f0`
- **5 GHz BSSID:** `64:29:43:bb:84:f8`
- **Signal Strength:** Good (-58 to -63 dBm)
- **Coverage:** Third floor area

### **Router: OGH_F3_4**
- **2.4 GHz BSSID:** `64:29:43:bb:85:50`
- **5 GHz BSSID:** `64:29:43:bb:85:58`
- **Signal Strength:** Moderate (-67 to -79 dBm)
- **Coverage:** Third floor area

---

## **Summary Statistics:**

- **Total Routers:** 8
- **Total BSSIDs:** 15 (one router missing 2.4GHz)
- **Floor Coverage:** 4 floors (Ground + 3 floors)
- **Primary Band:** Dual-band (2.4GHz + 5GHz)
- **Vendor OUI:** 64:29:43 (Common manufacturer prefix)

---

## **Quick Reference List (All BSSIDs):**

```
64:29:43:bb:78:60  ← OGH_F0_1 (2.4GHz)
64:29:43:bb:78:68  ← OGH_F0_1 (5GHz)
64:29:43:bb:79:40  ← OGH_F0_2 (2.4GHz)
64:29:43:bb:79:48  ← OGH_F0_2 (5GHz)
64:29:43:bb:79:20  ← OGH_F1_2 (2.4GHz)
64:29:43:bb:79:a8  ← OGH_F1_2 (5GHz)
64:29:43:bb:78:b0  ← OGH_F1_3 (2.4GHz)
64:29:43:bb:78:b8  ← OGH_F1_3 (5GHz)
64:29:43:bb:6f:40  ← OGH_F2_3 (2.4GHz)
64:29:43:bb:6f:48  ← OGH_F2_3 (5GHz)
64:29:43:bb:79:58  ← OGH_F2_4 (5GHz only)
64:29:43:bb:84:f0  ← OGH_F3_3 (2.4GHz)
64:29:43:bb:84:f8  ← OGH_F3_3 (5GHz)
64:29:43:bb:85:50  ← OGH_F3_4 (2.4GHz)
64:29:43:bb:85:58  ← OGH_F3_4 (5GHz)
```

---

## **Coverage Map:**

```
Floor 3: ████ OGH_F3_3  ████ OGH_F3_4
         (Good)         (Moderate)

Floor 2: ████ OGH_F2_3  ▓▓▓▓ OGH_F2_4
         (Moderate)     (Weak)

Floor 1: ████ OGH_F1_2  ████ OGH_F1_3
         (Moderate)     (Good)

Floor 0: █████ OGH_F0_1 ██████ OGH_F0_2
         (Good)         (Excellent)
```

---

## **Notes:**

1. **Dual-Band Coverage:** Most routers broadcast on both 2.4GHz and 5GHz
   - 2.4GHz: Longer range, better wall penetration
   - 5GHz: Shorter range, faster speeds
   
2. **Detection Strategy:** App should scan for any BSSID in the list
   - Student's device will detect whichever band is stronger
   - No need to specify 2.4 vs 5GHz - both work!

3. **Ground Floor:** Best coverage (OGH_F0_2 is primary)

4. **Expansion:** Easy to add more routers
   - Just append BSSIDs to the whitelist array
   - No code changes needed

---

**Source:** WiFi scan performed on 2026-02-07  
**Location:** Gangotri Hostel, All Floors  
**Status:** ✅ Active and Configured
