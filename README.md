# SPWS Designer (Solar Piped Water Supply Tool)


## 🔍 Project Overview

The **SPWS Designer** is a web-based decision support tool designed for water supply engineers in Malawi. Its primary purpose is to **compare the economic feasibility** of two competing water supply technologies:

1.  **Solar Piped Water Systems (SPWS)**: Centralized borehole with solar pump, elevated tank, and distribution network to tap stands.
2.  **Boreholes with Handpumps**: Decentralized point sources.

The tool guides the user through a full design workflow—from spatial planning to hydraulic calculations to lifecycle cost analysis—ending with a downloadable PDF feasibility report.

---

## 🚀 Key Features

*   **Interactive Design Map**:
    *   Satellite imagery & Topographic views.
    *   **Google Building Footprints**: Over 6M buildings (via FlatGeobuf) for accurate population estimation.
    *   **Hydrogeology Layers**: Visualizes "Depth to Water" and "Groundwater Potential" to guide borehole siting.
*   **Hydraulic Engine**:
    *   Dynamic pipe sizing & friction loss calculations.
    *   Pump power & solar array sizing based on Total Dynamic Head (TDH).
    *   Pipeline elevation profiling.
*   **Economic Analysis**:
    *   20-year Lifecycle Cost Analysis (LCCA).
    *   **Benefit Monetization**: Calculates value of time saved, health improvements, and carbon credits.
    *   **Monte Carlo Simulation**: Runs 10,000 scenarios to assess risk and probability of success.
*   **Serverless Backend**:
    *   Uses **Google Apps Script** & **Google Sheets** as a free, maintenance-free backend for logging usage stats and feedback.
*   **PDF Reporting**:
    *   Generates professional feasibility reports directly in the browser.

---

## 🛠️ Architecture & Tech Stack

### Frontend
*   **Framework**: [React](https://react.dev/) with [Vite](https://vitejs.dev/) (fast, modern tooling).
*   **Language**: TypeScript (for type safety and robust logic).
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (utility-first styling).

### Mapping & Geospatial
*   **Engine**: [Leaflet](https://leafletjs.com/) (lightweight mapping).
*   **Data Formats**:
    *   **FlatGeobuf**: Efficiently streams millions of building polygons without a backend server.
    *   **Cloud Optimized GeoTIFF (COG)**: Serves raster layers (Elevation, GW Potential) as static files.
    *   **OpenStreetMap**: Used for search/geocoding and base maps.

### Backend (Serverless)
*   **Compute**: [Google Apps Script](https://script.google.com/) (Web App deployment).
*   **Database**: [Google Sheets](https://sheets.google.com/).
*   **Integration**: The frontend communicates via `fetch()` to the Apps Script Web App URL to log designs and save feedback.

---

## 💻 Getting Started

### Prerequisites
*   Node.js (v18 or higher recommended).

### Installation
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/washways/SPWS1.git
    cd SPWS1
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Run locally**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` in your browser.

---

## ⚙️ Backend Setup (Important)

The application requires a connection to a Google Apps Script to log data. If you are forking this repo, you must set up your own backend.

👉 **[Read the Google Apps Script Setup Guide](./GOOGLE_APPS_SCRIPT_SETUP.md)**

1.  Create a new Google Sheet.
2.  Add the provided script.
3.  Deploy as a Web App (Access: **Anyone**).
4.  Update `GOOGLE_SCRIPT_URL` in `src/services/analyticsService.ts`.

---

## 📖 how it Works (The Workflow)

1.  **Locate & Identify**: User searches for a village. The tool loads building footprints to estimate population (e.g., 5 people per house).
2.  **Design System**: User places a Borehole, Tank, and draws Pipes to connect Taps across the village.
3.  **Hydraulic Check**: The tool calculates elevation differences (using Open-Meteo API), pipe friction, and required pump power.
4.  **Financial Inputs**: User confirms costs (CAPEX/OPEX), tariffs, and subsidy levels.
5.  **Simulate**: The "Economic Analysis" tab compares the 20-year Net Present Value (NPV) of the Solar system vs. drilling multiple Handpumps.
6.  **Report**: User downloads a comprehensive PDF for stakeholders/donors.

---

## 💡 Ideas for Future Improvements

### 1. Offline Capability (PWA)
*   **Challenge**: Field engineers often work in areas with poor internet.
*   **Idea**: Convert the app to a **Progressive Web App (PWA)**. Cache the static assets and basic map tiles. Store hydraulic calculations locally and sync with Google Sheets when online.

### 2. Advanced Hydraulic Solver
*   **Challenge**: Currently assumes a simple branching network.
*   **Idea**: Integrate a compiled [EPANET](https://github.com/OpenWaterAnalytics/epanet-js) WASM module to handle looped networks and complex pressure zones.

### 3. User Accounts & Projects
*   **Challenge**: Designs are currently "session-based" and lost on reload (unless saved to PDF).
*   **Idea**: Add FireBase or Supabase authentication to allow users to "Save" and "Load" their projects.

### 4. Live GEE Integration
*   **Challenge**: Static GeoTIFFs cover only specific areas (Malawi main).
*   **Idea**: Re-integrate Google Earth Engine (Compute API) to generate layers dynamically for *any* location in the world, authenticated via a Service Account proxy.

---

## 📄 License

This project is open-source. Please see the [LICENSE](LICENSE) file for details.
