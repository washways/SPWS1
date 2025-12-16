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

## Phase 2: Create the Script (UPDATED V2)
1.  In your Google Sheet, click **Extensions** (top menu) > **Apps Script**.
2.  A new tab will open. Name the project **`WashWays Backend`** (click "Untitled project" at top left).
3.  **Delete** all code in `Code.gs`.
4.  **Copy & Paste** the code below into `Code.gs`. **(This version now automatically calculates stats!)**

```javascript
/* =========================================================================
   WASHWAYS ANALYTICS BACKEND (V2 - With Stats Aggregation)
   ========================================================================= */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); 

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
        // Invalid JSON
      }
    }

    // --- ROUTER ---
    if (action === 'get_stats') {
      output = calculateStatsFromLogs(); // Real-time calc
    } else if (action === 'log_report') {
      output = logData('Logs', data);
      updateStatsSheet(); // Update the visible 'Stats' tab
    } else if (action === 'feedback') {
      output = logData('Feedback', data);
    } else {
      output = { status: 'error', message: 'Unknown action: ' + action };
    }

    // --- RESPONSE ---
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

// --- LOGGING ---

function logData(sheetName, data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { status: 'error', message: sheetName + ' sheet missing' };
  
  // Append Timestamp + JSON of data
  var row = [new Date(), JSON.stringify(data)];
  sheet.appendRow(row);
  
  return { status: 'success' };
}

// --- STATS CALCULATION ---

function calculateStatsFromLogs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Logs');
  if (!sheet) return getDefaultStats();

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return getDefaultStats(); // Only header or empty

  // Read all logs (Column B contains the JSON)
  // Get Range: Row 2, Col 2 (B), down to last row, 1 column wide
  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  
  var totalReports = 0;
  var totalPop = 0;
  var totalCapex = 0;
  var totalTime = 0;
  var solarWins = 0;
  var recentLogs = [];

  // usage: Iterate backwards to get recent logs first
  for (var i = values.length - 1; i >= 0; i--) {
    try {
      var jsonStr = values[i][0];
      if (!jsonStr) continue;
      
      var entry = JSON.parse(jsonStr);
      
      // Aggregates
      totalReports++;
      totalPop += (entry.population || 0);
      totalCapex += (entry.solarCapex || 0); // Estimate based on Solar cost
      totalTime += (entry.timeSpentSeconds || 0);
      if (entry.winner === 'Solar') solarWins++;

      // Recent Logs (Limit 50)
      if (recentLogs.length < 50) {
        // Add timestamp if missing (from row index approx)
        if (!entry.timestamp) entry.timestamp = new Date().toISOString(); 
        // Note: Real timestamp is in Col A, but simpler to just use current time 
        // or rely on client sent time if we were reading Col A too.
        // Let's rely on client data for simplicity here.
        recentLogs.push(entry);
      }

    } catch (e) {
      // bad json, skip
    }
  }

  var winRate = totalReports > 0 ? (solarWins / totalReports) * 100 : 0;
  var avgTime = totalReports > 0 ? (totalTime / totalReports) : 0;

  return {
    totalReports: totalReports,
    totalPopulationServed: totalPop,
    totalCapexEstimated: totalCapex,
    avgTimeSpentSeconds: Math.round(avgTime),
    solarWinRate: Math.round(winRate),
    recentLogs: recentLogs
  };
}

function getDefaultStats() {
  return {
    totalReports: 0,
    totalPopulationServed: 0,
    totalCapexEstimated: 0,
    avgTimeSpentSeconds: 0,
    solarWinRate: 0,
    recentLogs: []
  };
}

// Update the visible 'Stats' tab for the user to see in Sheets
function updateStatsSheet() {
  var stats = calculateStatsFromLogs();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Stats');
  
  if (sheet) {
    sheet.clear();
    sheet.appendRow(["Key", "Value"]); // Header
    sheet.appendRow(["Last Updated", new Date()]);
    sheet.appendRow(["Total Reports", stats.totalReports]);
    sheet.appendRow(["Total Pop Served", stats.totalPopulationServed]);
    sheet.appendRow(["Total Capex", stats.totalCapexEstimated]);
    sheet.appendRow(["Solar Win Rate (%)", stats.solarWinRate]);
  }
}
```

## Phase 3: Deploy (The Most Important Part)
1.  Click **Deploy** (blue button, top right) > **New deployment**.
2.  **Select type**: Click the Gear icon ⚙️ > **Web app**.
3.  **Fill in details**:
    *   **Description**: `Stats Fix`
    *   **Execute as**: **`Me`** (Your email address).
    *   **Who has access**: **`Anyone`**.
4.  Click **Deploy**.
5.  **Authorize** completely.
6.  **COPY the URL**.

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
