
import { DashboardStats, ReportLog } from "../types";

const SESSION_START_KEY = "mw_tool_session_start";
// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAK788sWe3dBiiZhvDHlM-f21EnWHyEWc5lsBkur8G_vqcCaq5sArBaK3ky1FlKJon/exec';

export const AnalyticsService = {

  // 1. Session Management
  startSession: () => {
    sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
  },

  getSessionDuration: (): number => {
    const start = sessionStorage.getItem(SESSION_START_KEY);
    if (!start) return 0;
    const diff = Date.now() - parseInt(start);
    return Math.round(diff / 1000); // Seconds
  },

  // 2. Log Generation (Send to Google Script)
  logReport: async (logData: Omit<ReportLog, 'id' | 'timestamp' | 'timeSpentSeconds'>) => {
    try {
      const payload = {
        action: 'log_report',
        ...logData,
        timeSpentSeconds: AnalyticsService.getSessionDuration()
      };

      // Send to Google Script
      // mode: 'no-cors' is often required for Google Scripts to avoid CORS errors on simple writes,
      // but it prevents reading the response.
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log("Analytics: Report sent to Google Script");
    } catch (e) {
      console.warn("Analytics: Failed to log report", e);
    }
  },

  // 3. Feedback Submission
  sendFeedback: async (message: string) => {
    try {
      const payload = {
        action: 'feedback',
        message: message,
        timestamp: new Date().toISOString()
      };

      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log("Feedback sent to Google Script");
    } catch (e) {
      console.error("Feedback error", e);
      throw e;
    }
  },

  // 4. Analytics Retrieval
  getDashboardStats: async (): Promise<DashboardStats> => {
    try {
      console.log("Fetching stats from Google Script...");

      // Note: For this to work, the Google Script must:
      // 1. Implement doGet()
      // 2. Return JSON content using ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
      // 3. Be deployed as "Who can access: Anyone" (or user must be logged in)
      // 4. Handle CORS (Google Scripts usually handle this automatically if returning JSON correctly)

      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_stats`);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Stats received:", data);

      // Validate data structure roughly
      if (data && typeof data === 'object' && 'totalReports' in data) {
        // Safe guard against missing recentLogs
        if (!Array.isArray(data.recentLogs)) {
          data.recentLogs = [];
        }
        return data as DashboardStats;
      } else {
        console.warn("Received data but it doesn't match DashboardStats interface:", data);
        throw new Error("Invalid data format from script");
      }

    } catch (e) {
      console.warn("Error loading stats from Google Script (Falling back to empty stats):", e);
      console.error("CORS Error Detected? Please check 'GOOGLE_APPS_SCRIPT_SETUP.md' in your project root for deployment instructions.");

      // Fallback to empty stats so the dashboard works even if script fails
      return {
        totalReports: 0,
        totalPopulationServed: 0,
        totalCapexEstimated: 0,
        avgTimeSpentSeconds: 0,
        solarWinRate: 0,
        recentLogs: []
      };
    }
  }
};
