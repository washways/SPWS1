# Analytics Server Test Guide

## Quick Start

Run both servers together:
```powershell
$env:PATH = "C:\Users\jrobertson\Downloads\node-v24.11.1-win-x64\node-v24.11.1-win-x64;" + $env:PATH
npm.cmd run dev:full
```

Then open `http://localhost:5173` in your browser.

## What Gets Logged

Every time a user downloads a report, the following data is automatically saved:
- Site name and contract number
- Population (initial and design)
- System costs (Solar vs Handpump)
- Economic analysis results (Net Present Value for each option)
- Winner (which system is more economical)
- Time spent on the analysis

## Viewing Analytics

1. Click the **Dashboard** tab in the application
2. You'll see:
   - Total reports generated
   - Total population served across all analyses
   - Total capital expenditure estimated
   - Average session time
   - Solar vs Handpump win rate (pie chart)
   - Detailed table of all recent reports

## Data Storage

All data is stored in `analytics_data.json` in the project root. This file is created automatically when the first report is logged.

## Server Endpoints

- `POST http://localhost:3001/api/log_report` - Save a new report
- `POST http://localhost:3001/api/feedback` - Save user feedback
- `GET http://localhost:3001/api/get_stats` - Get all analytics data
- `GET http://localhost:3001/api/health` - Check if server is running

## Testing Checklist

- [ ] Both servers start without errors
- [ ] Can complete an analysis and download PDF
- [ ] `analytics_data.json` file is created
- [ ] Dashboard shows the logged report
- [ ] Can complete multiple analyses and see data accumulate
- [ ] Dashboard refreshes when clicking "Refresh Data"
