
import React, { useEffect, useState } from 'react';
import { DashboardStats } from '../types';
import { AnalyticsService } from '../services/analyticsService';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, DollarSign, Clock, FileText, MapPin, Database, RefreshCcw, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    setError(false);
    try {
        const data = await AnalyticsService.getDashboardStats();
        setStats(data);
    } catch (e) {
        setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) return <div className="p-12 text-center text-gray-500 flex flex-col items-center"><RefreshCcw className="w-8 h-8 animate-spin mb-4"/>Loading Server Data...</div>;

  // Show friendly empty state if no stats or error
  if (!stats || error) return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center bg-white rounded-xl border border-dashed border-gray-300 m-4">
          <AlertCircle className="w-12 h-12 mb-4 text-orange-400"/>
          <h3 className="text-lg font-bold text-gray-900">Could not load analytics</h3>
          <p className="max-w-md mx-auto mb-4">Ensure the Flask backend is running (`python app.py`) on port 5000 to save and view reports.</p>
          <button onClick={loadStats} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition">Retry Connection</button>
      </div>
  );

  const winData = [
    { name: 'Solar Wins', value: stats.solarWinRate, color: '#3b82f6' },
    { name: 'Handpump Wins', value: 100 - stats.solarWinRate, color: '#10b981' }
  ];

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m ${seconds % 60}s`;
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-800 p-6 rounded-xl text-white shadow-lg">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2"><Database className="w-6 h-6"/> Usage Analytics Dashboard</h2>
                <p className="text-slate-300">Live data from server CSV log.</p>
            </div>
            <button 
                onClick={loadStats}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold transition flex items-center gap-2"
            >
                <RefreshCcw className="w-3 h-3"/> Refresh Data
            </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase">Reports Generated</h3>
                    <FileText className="w-5 h-5 text-blue-500"/>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalReports}</div>
                <div className="text-xs text-green-600 font-medium mt-1">Total Logs in CSV</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase">Pop. Served</h3>
                    <Users className="w-5 h-5 text-purple-500"/>
                </div>
                <div className="text-3xl font-bold text-gray-900">{(stats.totalPopulationServed / 1000).toFixed(1)}k</div>
                <div className="text-xs text-gray-400 font-medium mt-1">Cumulative Design Pop</div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase">Est. CapEx</h3>
                    <DollarSign className="w-5 h-5 text-emerald-500"/>
                </div>
                <div className="text-3xl font-bold text-gray-900">${(stats.totalCapexEstimated / 1000000).toFixed(2)}M</div>
                <div className="text-xs text-gray-400 font-medium mt-1">Project Value Analyzed</div>
            </div>

             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase">Avg Session</h3>
                    <Clock className="w-5 h-5 text-orange-500"/>
                </div>
                <div className="text-3xl font-bold text-gray-900">{formatTime(stats.avgTimeSpentSeconds)}</div>
                <div className="text-xs text-gray-400 font-medium mt-1">Time per Report</div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Charts */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-6">System Preference (Winner)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={winData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {winData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val: number) => `${val.toFixed(1)}%`} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-sm font-medium">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded-full"></span> Solar ({stats.solarWinRate.toFixed(0)}%)</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 bg-emerald-500 rounded-full"></span> Handpump ({(100-stats.solarWinRate).toFixed(0)}%)</div>
                </div>
            </div>

            {/* Recent Activity Log - Detailed Data Table */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Recent Generated Reports</h3>
                    <div className="flex gap-2">
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">Most Recent 50</span>
                    </div>
                </div>
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Date & Time</th>
                                <th className="px-4 py-3">Site Name</th>
                                <th className="px-4 py-3 text-center">Pop. (Design)</th>
                                <th className="px-4 py-3 text-right">Solar CapEx</th>
                                <th className="px-4 py-3 text-right">HP CapEx</th>
                                <th className="px-4 py-3 text-right bg-blue-50/50">Solar Net Val</th>
                                <th className="px-4 py-3 text-right bg-emerald-50/50">HP Net Val</th>
                                <th className="px-4 py-3 text-center">Winner</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.recentLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleDateString()}<br/>
                                        <span className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="font-bold text-gray-900 truncate max-w-[120px]" title={log.siteName}>{log.siteName || "Unnamed"}</div>
                                        <div className="text-[10px] text-gray-400">{log.contractNumber || "-"}</div>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <span className="font-medium text-gray-700">{log.designPopulation.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-gray-600">
                                        {formatCurrency(log.solarCapex)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-gray-600">
                                        {formatCurrency(log.handpumpCapex)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-blue-700 font-bold bg-blue-50/20">
                                        {formatCurrency(log.solarNetValue)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-emerald-700 font-bold bg-emerald-50/20">
                                        {formatCurrency(log.handpumpNetValue)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${log.winner === 'Solar' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                            {log.winner === 'Solar' ? 'SOLAR' : 'HP'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {stats.recentLogs.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-gray-400 italic">No reports logged yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};
