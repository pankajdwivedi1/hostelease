# MongoDB Timeout Error - Quick Fix

## **Error:**
```
Operation `students.findOne()` buffering timed out after 10000ms
```

## **What This Means:**
The database query is taking too long. MongoDB M0 free tier has connection limits, and the connection pool may be exhausted.

## **Quick Fix Steps:**

### **1. Restart Dev Server:**
```powershell
# In your terminal:
# Press Ctrl+C to stop the server
# Then run:
npm run dev
```

### **2. Check MongoDB Connection:**
- Make sure your MongoDB Atlas cluster is running
- Check if you have too many stale connections
- Verify your internet connection is stable

### **3. If Still Failing:**
```powershell
# Clear all node processes:
taskkill /F /IM node.exe

# Restart:
npm run dev
```

## **Why This Happened:**

Your MongoDB M0 free tier has these limits:
- **Max connections:** 500 concurrent
- **Connection timeout:** 10 seconds
- **Max pool size:** 5 (per your config)

During attendance marking, multiple students hit the database at once, exhausting the connection pool.

## **Preventive Measures:**

The code already has optimizations:
- ✅ Connection pooling (maxPoolSize: 5)
- ✅ Admin settings cache (1 minute)
- ✅ Retry logic with exponential backoff

But if the database is slow, queries will still timeout.

## **Immediate Action:**

**Stop the dev server and restart it:**

1. Go to your terminal where `npm run dev` is running
2. Press **Ctrl+C** to stop
3. Wait 2-3 seconds
4. Run `npm run dev` again
5. Test attendance marking

## **Expected Result:**
After restart, database connections will be reset and attendance should work!

---

**TL;DR: Stop dev server (Ctrl+C) and restart it (`npm run dev`)** ✅
