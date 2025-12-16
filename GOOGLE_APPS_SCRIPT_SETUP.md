# Google Apps Script: Fresh Start Guide

Follow these steps exactly to create a new backend for your application. This method is the easiest because it links the script directly to your sheet, avoiding "ID" confusion.

## Phase 1: Create the Google Sheet
1.  Go to [sheets.new](https://sheets.new) to create a blank spreadsheet.
2.  Name it: **`WashWays Analytics`** (top left corner).
3.  **Create 3 Tabs** (at the bottom):
    *   Rename `Sheet1` to **`Stats`**.
    *   Click `+` to add a sheet, rename it to **`Logs`**.
    *   Click `+` to add a sheet, rename it to **`Feedback`**.
4.  **Setup Header Rows** (Optional but good for visibility):
    *   In **Logs**: Type `Timestamp`, `Action`, `Data` in row 1.
    *   In **Feedback**: Type `Timestamp`, `Message` in row 1.
    *   In **Stats**: Type `Key`, `Value` in row 1. (e.g., A2=`totalPopulationServed`, B2=`0`)

## Phase 2: Create the Script
1.  In your Google Sheet, click **Extensions** (top menu) > **Apps Script**.
2.  A new tab will open. Name the project **`WashWays Backend`** (click "Untitled project" at top left).
3.  **Delete** all code in `Code.gs`.
4.  **Copy & Paste** the code below into `Code.gs`:

```javascript
/* =========================================================================
   WASHWAYS ANALYTICS BACKEND
   ========================================================================= */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s for other requests

  try {
    var output = {};
    var action = e.parameter.action;
    
    // Check for POST data
    var data = null;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
        if (data.action) action = data.action;
      } catch (err) {
        // Invalid JSON body
      }
    }

    // --- ROUTER ---
    if (action === 'get_stats') {
      output = getStats();
    } else if (action === 'log_report') {
      output = logData('Logs', data);
    } else if (action === 'feedback') {
      output = logData('Feedback', data);
    } else {
      output = { status: 'error', message: 'Unknown action: ' + action };
    }

    // --- RESPONSE (CORS FIX) ---
    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- CORE FUNCTIONS ---

function getStats() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Stats');
  
  if (!sheet) return { error: "Stats sheet not found" };

  // Simple Key-Value Reader (Assuming Column A=Key, Column B=Value)
  var data = sheet.getDataRange().getValues();
  var stats = {};
  
  // Start from row 1 (index 1) to skip header
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) {
      stats[data[i][0]] = data[i][1];
    }
  }

  // Provide defaults if empty
  if (Object.keys(stats).length === 0) {
    return {
      totalReports: 0,
      totalPopulationServed: 0,
      totalCapexEstimated: 0,
      avgTimeSpentSeconds: 0,
      solarWinRate: 0,
    };
  }
  return stats;
}

function logData(sheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { status: 'error', message: sheetName + ' sheet missing' };
  
  // Append Timestamp + JSON of data
  // You can customize this to break out columns if preferred
  var row = [new Date(), JSON.stringify(data)];
  sheet.appendRow(row);
  
  return { status: 'success' };
}
```

## Phase 3: Deploy (The Most Important Part)
1.  Click **Deploy** (blue button, top right) > **New deployment**.
2.  **Select type**: Click the Gear icon ⚙️ > **Web app**.
3.  **Fill in details**:
    *   **Description**: `Initial Setup`
    *   **Execute as**: **`Me`** (Your email address).
    *   **Who has access**: **`Anyone`** (Must be "Anyone", NOT "Anyone with Google Account").
4.  Click **Deploy**.
5.  If asked to **Authorize Access**:
    *   Click "Review Permissions".
    *   Choose your account.
    *   (If you see "Google hasn't verified this app"): Click **Advanced** > **Go to WashWays Backend (unsafe)**.
    *   Click **Allow**.
6.  **COPY the URL** (It ends in `/exec`).

## Phase 4: Connect App
1.  Open your project file: `services/analyticsService.ts`.
2.  Update the variable at the top:
    ```typescript
    const GOOGLE_SCRIPT_URL = 'YOUR_NEW_COPIED_URL';
    ```

## Troubleshooting: "Forbidden (403)" Error?
If you see `403 Forbidden` in your console, it means the script is blocking you.
This **ALWAYS** happens for one reason:

*   **Who has access** was not set to **`Anyone`**.

**To Fix:**
1.  Go back to your script.
2.  **Deploy > New deployment** (You MUST create a new one, editing does not work reliably).
3.  Set **Who has access** to **`Anyone`**.
4.  Click **Deploy**.
5.  **Copy the NEW URL** (it changes every time!) and update line 6 in `services/analyticsService.ts`.
