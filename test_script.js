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
    // Mock LockService for local syntax check
    var LockService = { getScriptLock: () => ({ tryLock: () => { }, releaseLock: () => { } }) };
    var ContentService = { createTextOutput: () => ({ setMimeType: () => { } }), MimeType: { JSON: 'json' } };

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
    // Mock SpreadsheetApp
    var SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ appendRow: () => { } }) }) };

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
    // Mock SpreadsheetApp
    var SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getLastRow: () => 10, getRange: () => ({ getValues: () => [] }) }) }) };

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
    // Mock SpreadsheetApp
    var SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ clear: () => { }, appendRow: () => { } }) }) };

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
