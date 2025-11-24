# 💧 Malawi Water Supply Comparison Dashboard

## 🌟 Overview

This single-page application (SPA) is a  tool for **water system design and planning** in Malawi. It provides data visualization and analysis capabilities to inform decisions on resource allocation, infrastructure investment, and monitoring of service effectiveness.

By integrating geographical data with economic performance metrics, the dashboard facilitates a detailed **economic comparison of water supply systems** across different regions.

### Key Features

* **Integrated Economic Comparison:** Provides detailed visual comparisons of system costs, operational efficiency, tariff structures, and investment needs across various water supply initiatives in Malawi.
* **Geographical System Design:** Utilizes the **Leaflet** map interface to visualize the location, coverage, and connectivity of water sources and infrastructure, directly informing optimal new system placement and expansion planning.
* **Data Visualization & Analysis:** Includes interactive charts (powered by **Recharts**) for analyzing trends in operational expenses, revenue generation, and service coverage gaps.
* **Data Export for Reporting:** Integrates **html2pdf** for generating immediate, printable reports essential for stakeholder briefings and investment proposals.
* **Responsive Design:** Styled with **Tailwind CSS** for usability on field tablets and desktop platforms.
***

## 🚀 Getting Started

### Prerequisites

You must have **Node.js** (version 16 or higher is recommended) and **npm** installed on your machine.

### Installation & Local Development

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/washways/SPWS1.git](https://github.com/washways/SPWS1.git)
    cd SPWS1
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    # The application will typically be available at http://localhost:5173
    ```

***

## 📦 Technology Stack

| Technology | Purpose |
| :--- | :--- |
| **Frontend Framework** | React |
| **Bundler / Tooling** | Vite + TypeScript |
| **Styling** | Tailwind CSS, PostCSS |
| **Mapping** | Leaflet |
| **Charting** | Recharts |
| **PDF Export** | html2pdf.js (CDN) |

***

## 🌐 Deployment Status

The application is deployed using **GitHub Pages** via a custom GitHub Actions workflow.

| Environment | Status | Notes |
| :--- | :--- | :--- |
| **GitHub Pages** | **Live** | Deployment successfully resolved complex asset path conflicts (JS/CSS) using relative paths (`./`) in the Vite configuration. |

> **Live URL:** *washways.org/SPWS1* 👈 

***

## 💡 Troubleshooting and Development Notes

This project was successfully migrated from an external development environment (Aistudio) to a standard Vite deployment structure. The following notes are crucial for maintenance:

### Common Runtime Fixes

* **Missing Styling:** If the page loads without any formatting, ensure the **`tailwind.config.js`** and **`postcss.config.js`** files are present in the project root. These files are necessary to instruct the build pipeline to compile your Tailwind utility classes.
* **Charts Not Working:** If the charts are blank, check the browser console for **Recharts prop warnings** or errors. Additionally, ensure the **`recharts`** package is listed in your `package.json` and installed.
* **Build Failure:** If the deployment fails silently (no JS/CSS files in the artifact), check that the main entry files (`src/index.tsx` and `src/index.css`) are present and correctly importing all necessary components.

### Build Configuration

* **Asset Resolution:** Asset paths are resolved using the **relative base path (`./`)** set in `vite.config.js` to ensure compatibility with GitHub Pages.

***

## 🤝 Contribution & License

### Contribution

Feel free to fork the repository and submit pull requests. For major changes or feature requests, please open an issue first to discuss the proposed changes.

### License

[License: MIT](LICENSE)
