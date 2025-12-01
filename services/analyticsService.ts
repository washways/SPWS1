
import { DashboardStats, ReportLog } from "../types";

const SESSION_START_KEY = "mw_tool_session_start";

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

  // 2. Log Generation (Send to Express Backend)
  logReport: async (logData: Omit<ReportLog, 'id' | 'timestamp' | 'timeSpentSeconds'>) => {
    try {
      const payload = {
        ...logData,
        timeSpentSeconds: AnalyticsService.getSessionDuration()
      };

      const response = await fetch('https://script.google.com/macros/s/AKfycbwwGx6bFqF39NFT5_uFNRumh02righDBnHrmoy0nXI87RjhyCka9sBqAOFGVczZr1Ua3w/exec', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      console.log("Analytics: Report logged to server");
    } catch (e) {
      // Graceful degradation - don't block the user if analytics fails
      console.warn("Analytics: Failed to log report (Server might be offline)", e);
    }
  },

  // 3. Feedback Submission
  sendFeedback: async (message: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!response.ok) throw new Error('Failed to send feedback');
    } catch (e) {
      console.error("Feedback error", e);
      throw e;
    }
  },

  // 4. Analytics Retrieval (Get from Express Backend)
  getDashboardStats: async (): Promise<DashboardStats> => {
    try {
      const response = await fetch('http://localhost:3001/api/get_stats');
      if (!response.ok) throw new Error('Failed to fetch stats');

      const rawLogs: any[] = await response.json();

      // Map CSV keys to Frontend Types
      const logs: ReportLog[] = rawLogs.map((row: any) => ({
        id: row.id || Math.random().toString(36),
        timestamp: row.timestamp,
        siteName: row.site_name,
        contractNumber: row.contract_number,
        location: { lat: 0, lng: 0 },
        population: row.population_initial,
        designPopulation: row.population_design,
        systemType: row.system_type,
        solarCapex: row.solar_capex,
        handpumpCapex: row.handpump_capex,
        solarNetValue: parseFloat(row.solar_net_value) || 0,
        handpumpNetValue: parseFloat(row.handpump_net_value) || 0,
        winner: row.winner,
        timeSpentSeconds: row.time_spent_seconds
      }));

      if (logs.length === 0) {
        return {
          totalReports: 0,
          totalPopulationServed: 0,
          totalCapexEstimated: 0,
          avgTimeSpentSeconds: 0,
          solarWinRate: 0,
          recentLogs: []
        };
      }

      const totalReports = logs.length;
      const totalPopulationServed = logs.reduce((acc, log) => acc + (log.designPopulation || 0), 0);
      const totalCapexEstimated = logs.reduce((acc, log) => acc + (log.winner === 'Solar' ? (log.solarCapex || 0) : (log.handpumpCapex || 0)), 0);
      const totalTime = logs.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0);
      const solarWins = logs.filter(l => l.winner === 'Solar').length;

      return {
        totalReports,
        totalPopulationServed,
        totalCapexEstimated,
        avgTimeSpentSeconds: totalReports > 0 ? Math.round(totalTime / totalReports) : 0,
        solarWinRate: totalReports > 0 ? (solarWins / totalReports) * 100 : 0,
        recentLogs: logs.slice(0, 50) // Return top 50
      };
    } catch (e) {
      console.warn("Error loading stats (Server might be offline):", e);
      // Return empty stats if server is down
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
