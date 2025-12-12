# SPWS Designer

A web-based design tool for Solar Pumping Water Supply systems in Malawi. This tool helps engineers verify designs, check service areas, and visualize "Depth to Water" and "Groundwater Potential" layers.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

## Deployment (GitHub Pages)

This application is designed to be hosted on **GitHub Pages**.

1.  **Build**: Run `npm run build` to generate the `dist` folder.
2.  **Deploy**: Push the `dist` folder to your repository or configure GitHub Pages to serve from the `dist` directory (or specialized branch).

## Google Earth Engine (GEE) Layers

The app supports displaying GEE layers (Depth to Water, Groundwater, FABDEM) using **Client-Side Authentication**.

**One-Time Setup (Required for GitHub Pages):**
1.  **Get Client ID**: Create a **Google Cloud OAuth Client ID** (Application Type: Web Application).
    *   Add your GitHub Pages URL to "Authorized JavaScript Origins".
2.  **Configuration**:
    *   Open `components/SiteMap.tsx`.
    *   Paste your Client ID into the `GEE_CLIENT_ID` variable at the top of the file:
        ```typescript
        const GEE_CLIENT_ID = "YOUR_CLIENT_ID_HERE";
        ```
    *   Run `npm run build` and deploy.
    *   **Security Note**: It is safe to commit this Client ID to a public repo *IF* you have restricted the "Authorized JavaScript Origins" in the Google Cloud Console to *only* your trusted domains (e.g., your GitHub Pages URL).

## Google Apps Script Integration (Backend)

The dashboard and feedback features rely on a Google Apps Script Web App.

1.  **Deploy Script**: Deploy the provided Google Apps Script as a **Web App** accessible to *Anyone*.
2.  **Update URL**: Update `GOOGLE_SCRIPT_URL` in `services/analyticsService.ts`.

## Local Development

To run the project locally for development:

1.  **Install**: `npm install`
2.  **Run**: `npm run dev`
    *   Open `http://localhost:5173`.
    *   **Note**: To test GEE layers locally, you must add `http://localhost:5173` to your OAuth Client ID's authorized origins.
