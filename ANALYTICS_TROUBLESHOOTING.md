# Analytics Troubleshooting (Google Sheets Backend)

## Symptom: Dashboard shows degraded/error status
### Check 1: URL configuration
- Ensure `.env` contains `VITE_GOOGLE_SCRIPT_URL=...`.
- Ensure the URL matches the latest Apps Script deployment URL.
- Restart `npm run dev` after editing `.env`.

### Check 2: Apps Script deployment permissions
- In Apps Script deployment, confirm:
  - Type: **Web app**
  - Execute as: **Me**
  - Who has access: **Anyone**

### Check 3: Spreadsheet tabs
- Confirm your bound spreadsheet has tabs:
  - `Logs`
  - `Feedback`
  - `Stats`

### Check 4: Action routing
- Confirm script handles:
  - `action=log_report`
  - `action=feedback`
  - `action=get_stats`

## Symptom: Report downloads but no rows in `Logs`
- Check browser console for analytics POST errors.
- Confirm the deployed script URL is current (new deployment can change URL).
- Verify your Apps Script `doPost` parses `e.postData.contents` and appends to `Logs`.

## Symptom: Feedback says failed
- Confirm `Feedback` tab exists in your spreadsheet.
- Confirm `doPost` routes `action=feedback` and appends to `Feedback`.

## Symptom: Dashboard shows zeros only
- Open `Logs` tab and confirm rows exist beyond header.
- Confirm `get_stats` returns object fields:
  - `totalReports`
  - `totalPopulationServed`
  - `totalCapexEstimated`
  - `avgTimeSpentSeconds`
  - `solarWinRate`
  - `recentLogs`

## Quick sanity test endpoint
Open in browser:
```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=get_stats
```
If configured correctly, it should return JSON.
