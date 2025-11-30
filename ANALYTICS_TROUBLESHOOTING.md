# Analytics Server - Troubleshooting Guide

## ✅ Server is Now Fixed

The analytics server has been updated to use ES module syntax and should now work correctly.

## Quick Test

### Step 1: Start the Analytics Server

Open a terminal in the project directory and run:
```powershell
$env:PATH = "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64;" + $env:PATH
node server.js
```

You should see:
```
Created analytics_data.json
🚀 Analytics server running on http://localhost:3001
📁 Data file: C:\Users\jrobertson\Downloads\SPWS1\analytics_data.json
📡 Endpoints:
   POST /api/log_report
   POST /api/feedback
   GET  /api/get_stats
   GET  /api/health
```

### Step 2: Test the Server (Optional)

Open another terminal and test the health endpoint:
```powershell
curl http://localhost:3001/api/health
```

You should get: `{"status":"ok","timestamp":"..."}`

### Step 3: Start the Frontend

In a **new terminal** (keep the server running), start the frontend:
```powershell
$env:PATH = "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64;" + $env:PATH
npm.cmd run dev
```

### Step 4: Test Analytics Collection

1. Open `http://localhost:5173` in your browser
2. Complete an analysis:
   - Go to "Design Map"
   - Search for a location
   - Place markers and design the system
   - Click "Apply Design"
   - Go to "Economic Analysis"
   - Click "Download Full Report"
3. Check the server terminal - you should see:
   ```
   ✅ Report logged: [Your Site Name] - Solar
   ```
4. Check `analytics_data.json` in the project root - it should contain your report data

### Step 5: Test Feedback Button

1. On the splash screen, click the feedback button (speech bubble icon)
2. Enter some feedback text
3. Click "Submit Feedback"
4. Check the server terminal - you should see:
   ```
   ✅ Feedback received
   ```
5. Check `analytics_data.json` - it should have a `feedback` array with your message

### Step 6: View Dashboard

1. Click the "Dashboard" tab
2. You should see your logged report with statistics

## Common Issues

### Issue: "Cannot find module 'express'"
**Solution:** Run `npm.cmd install` to install dependencies

### Issue: Server won't start - "Port 3001 already in use"
**Solution:** Another process is using port 3001. Either:
- Kill the other process
- Or change the PORT in `server.js` (line 11) to a different number like 3002

### Issue: "Failed to log report" in browser console
**Solution:** The analytics server isn't running. Start it with `node server.js`

### Issue: Dashboard shows "No Analytics Data Yet"
**Possible causes:**
1. Analytics server not running
2. No reports have been downloaded yet
3. Browser can't connect to localhost:3001

**Solution:** 
- Ensure server is running
- Download at least one report
- Check browser console for errors

### Issue: Feedback button does nothing
**Solution:** Check browser console for errors. Ensure analytics server is running on port 3001.

## File Locations

- **Server code:** `c:\Users\jrobertson\Downloads\SPWS1\server.js`
- **Data file:** `c:\Users\jrobertson\Downloads\SPWS1\analytics_data.json`
- **Analytics service:** `c:\Users\jrobertson\Downloads\SPWS1\services\analyticsService.ts`

## Verifying Data is Saved

Open `analytics_data.json` in a text editor. You should see:
```json
{
  "reports": [
    {
      "id": "abc123",
      "timestamp": "2025-11-30T...",
      "siteName": "Your Site",
      "population": 5000,
      "winner": "Solar",
      ...
    }
  ],
  "feedback": [
    {
      "id": "xyz789",
      "timestamp": "2025-11-30T...",
      "message": "Your feedback text"
    }
  ]
}
```

## Running Both Servers Together

Instead of two terminals, you can run both servers together:
```powershell
$env:PATH = "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64;" + $env:PATH
npm.cmd run dev:full
```

This starts both the analytics server and the frontend dev server simultaneously.
