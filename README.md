<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1rZUCFPaOen4QeZk-feSiDs47U71D-WKD

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Google Apps Script Integration (Backend)

The dashboard and feedback features rely on a Google Apps Script Web App.

1.  **Create a Google Sheet**: Create a new Google Sheet.
2.  **Open Script Editor**: Go to `Extensions > Apps Script`.
3.  **Deploy Script**:
    *   Implement `doGet(e)` to return report data as JSON.
    *   Implement `doPost(e)` to handle `action: 'log_report'` and `action: 'feedback'`.
    *   **Important**: Deploy as **Web App**.
    *   **Execute as**: Me.
    *   **Who has access**: *Anyone* (to allow the app to post data without user login).
4.  **Update URL**: Copy the Web App URL and update `GOOGLE_SCRIPT_URL` in `services/analyticsService.ts`.

**Note**: Without this backend, the dashboard will show empty stats and feedback will not be saved.

## Google Earth Engine (GEE) Layers

The app supports displaying GEE layers (Depth to Water, Groundwater, FABDEM) using **Client-Side Authentication**.

**One-Time Setup (Required for GitHub Pages):**
1.  **Get Client ID**: Create a **Google Cloud OAuth Client ID** (Application Type: Web Application).
    *   Add your GitHub Pages URL (and `http://localhost:5173`) to "Authorized JavaScript Origins".
2.  **Configuration**:
    *   Open `components/SiteMap.tsx`.
    *   Paste your Client ID into the `GEE_CLIENT_ID` variable at the top of the file:
        ```typescript
        const GEE_CLIENT_ID = "YOUR_CLIENT_ID_HERE";
        ```
    *   Run `npm run build` and deploy.
    *   **Security Note**: It is safe to commit this Client ID to a public repo *IF* you have restricted the "Authorized JavaScript Origins" in the Google Cloud Console to *only* your trusted domains (e.g., your GitHub Pages URL).

**Alternative**: Leave the variable empty. You will be prompted to paste the ID every time you toggle a layer (useful for testing without editing code).
