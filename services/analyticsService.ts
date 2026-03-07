import type { DashboardStats, DashboardStatsResponse, ReportLog } from "../types";

const SESSION_START_KEY = "mw_tool_session_start";
const GOOGLE_SCRIPT_URL = (import.meta.env.VITE_GOOGLE_SCRIPT_URL || "").trim();

const EMPTY_STATS: DashboardStats = {
  totalReports: 0,
  totalPopulationServed: 0,
  totalCapexEstimated: 0,
  avgTimeSpentSeconds: 0,
  solarWinRate: 0,
  recentLogs: [],
};

const requireScriptUrl = () => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("Analytics is not configured. Set VITE_GOOGLE_SCRIPT_URL.");
  }
  return GOOGLE_SCRIPT_URL;
};

const parseJsonResponse = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Analytics backend returned non-JSON content.");
  }
};

const postToScript = async (payload: unknown) => {
  const url = requireScriptUrl();
  const response = await fetch(url, {
    method: "POST",
    // Send as plain text to avoid preflight and keep Apps Script compatibility.
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Analytics POST failed: ${response.status} ${response.statusText}`);
  }

  const data = await parseJsonResponse(response);
  if (data && typeof data === "object" && "status" in data && data.status !== "success") {
    throw new Error(data.message || "Analytics backend rejected request.");
  }

  return data;
};

const normalizeRecentLogs = (rawLogs: unknown): ReportLog[] => {
  if (!Array.isArray(rawLogs)) return [];

  return rawLogs.map((entry: any, index: number) => ({
    id: entry?.id || `${entry?.timestamp || "log"}-${index}`,
    timestamp: entry?.timestamp || new Date().toISOString(),
    timeSpentSeconds: Number(entry?.timeSpentSeconds || 0),
    siteName: entry?.siteName || "",
    contractNumber: entry?.contractNumber || "",
    location: entry?.location,
    population: Number(entry?.population || 0),
    designPopulation: Number(entry?.designPopulation || 0),
    systemType: entry?.systemType || "Mixed",
    solarCapex: Number(entry?.solarCapex || 0),
    handpumpCapex: Number(entry?.handpumpCapex || 0),
    solarNetValue: Number(entry?.solarNetValue || 0),
    handpumpNetValue: Number(entry?.handpumpNetValue || 0),
    winner: entry?.winner === "Handpump" ? "Handpump" : "Solar",
  }));
};

export const AnalyticsService = {
  startSession: () => {
    sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
  },

  getSessionDuration: (): number => {
    const start = sessionStorage.getItem(SESSION_START_KEY);
    if (!start) return 0;
    const diff = Date.now() - parseInt(start, 10);
    return Math.round(diff / 1000);
  },

  logReport: async (logData: Omit<ReportLog, "id" | "timestamp" | "timeSpentSeconds">): Promise<boolean> => {
    try {
      await postToScript({
        action: "log_report",
        ...logData,
        timeSpentSeconds: AnalyticsService.getSessionDuration(),
      });
      return true;
    } catch (error) {
      console.warn("Analytics: Failed to log report", error);
      return false;
    }
  },

  sendFeedback: async (message: string): Promise<boolean> => {
    await postToScript({
      action: "feedback",
      message,
      timestamp: new Date().toISOString(),
    });
    return true;
  },

  getDashboardStats: async (): Promise<DashboardStatsResponse> => {
    if (!GOOGLE_SCRIPT_URL) {
      return {
        stats: EMPTY_STATS,
        sourceStatus: "error",
        message: "Analytics URL is not configured. Set VITE_GOOGLE_SCRIPT_URL.",
      };
    }

    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=get_stats`);
      if (!response.ok) {
        throw new Error(`Analytics GET failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || typeof data !== "object" || !("totalReports" in data)) {
        throw new Error("Analytics payload shape is invalid.");
      }

      return {
        sourceStatus: "ok",
        stats: {
          totalReports: Number(data.totalReports || 0),
          totalPopulationServed: Number(data.totalPopulationServed || 0),
          totalCapexEstimated: Number(data.totalCapexEstimated || 0),
          avgTimeSpentSeconds: Number(data.avgTimeSpentSeconds || 0),
          solarWinRate: Number(data.solarWinRate || 0),
          recentLogs: normalizeRecentLogs(data.recentLogs),
        },
      };
    } catch (error: any) {
      return {
        sourceStatus: "degraded",
        stats: EMPTY_STATS,
        message: error?.message || "Failed to load analytics from Google Sheets backend.",
      };
    }
  },
};
