# Analytics Test Guide (Google Sheets Backend)

## 1) Configure backend URL
1. Copy `.env.example` to `.env`.
2. Set `VITE_GOOGLE_SCRIPT_URL` to your deployed Apps Script Web App URL.
3. Restart the frontend dev server after editing `.env`.

## 2) Run app
```powershell
npm run dev
```
Open `http://localhost:5173`.

## 3) Verify report logging
1. Complete a design and click **Download Full Report**.
2. Open your Google Sheet used by Apps Script.
3. Check `Logs` tab:
  - Column A: timestamp.
  - Column B: JSON payload with site/cost/result fields.

## 4) Verify feedback logging
1. Submit feedback from splash/header.
2. Check `Feedback` tab:
  - Column A: timestamp.
  - Column B: JSON payload with message.

## 5) Verify dashboard
1. Open **Dashboard** tab in app.
2. Confirm totals populate and recent rows appear.
3. Use **Refresh Data** and confirm updates after new logs.

## Expected result
- If backend is healthy, dashboard status is normal and logs appear in `Logs`.
- If backend is unavailable or misconfigured, dashboard shows a degraded/error status message.
