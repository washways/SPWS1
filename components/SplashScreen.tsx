import React from 'react';
import { MessageSquare, Activity, Sun, TrendingUp, Settings, FileText, ArrowRight, X } from 'lucide-react';

interface SplashScreenProps {
    showSplash: boolean;
    setShowSplash: (show: boolean) => void;
    setShowFeedback: (show: boolean) => void;
    zIndex?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
    showSplash,
    setShowSplash,
    setShowFeedback,
    zIndex = 50
}) => {
    if (!showSplash) return null;

    return (
        <div className="fixed inset-0 flex items-start sm:items-center justify-center bg-[#003E5E]/95 backdrop-blur-sm text-white px-4 py-4 sm:py-6" style={{ zIndex }}>
            <div className="max-w-xl w-full max-h-[85vh] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 p-4 md:p-5 text-center relative overflow-y-auto animate-in fade-in zoom-in duration-300">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#1CABE2] via-[#003E5E] to-[#1CABE2]"></div>
                <button
                    onClick={() => setShowSplash(false)}
                    className="absolute top-3 right-3 p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                    aria-label="Close splash screen"
                    title="Close"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className="flex justify-center mb-3">
                    <div className="bg-[#1CABE2] p-4 rounded-2xl shadow-lg shadow-[#1CABE2]/20">
                        <Activity className="w-12 h-12 text-white" />
                    </div>
                </div>

                <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-amber-500/50">
                    v2.1 Experimental Tool
                </div>

                <h1 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-[#003E5E]">Rural Water Supply <span className="text-[#1CABE2]">Economic Analyzer</span></h1>

                <div className="space-y-4 text-left bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex gap-3">
                            <div className="mt-1 bg-[#1CABE2]/10 p-1.5 rounded text-[#1CABE2]"><Sun className="w-4 h-4" /></div>
                            <div>
                                <h4 className="font-bold text-[#003E5E]">Solar Piped Systems</h4>
                                <p className="text-sm text-slate-600">Design networks, size pumps and panels, and estimate hydraulic profiles.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="mt-1 bg-[#1CABE2]/10 p-1.5 rounded text-[#1CABE2]"><TrendingUp className="w-4 h-4" /></div>
                            <div>
                                <h4 className="font-bold text-[#003E5E]">Economic Analysis</h4>
                                <p className="text-sm text-slate-600">Compare Net Present Value (NPV) against traditional handpumps.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="mt-1 bg-[#1CABE2]/10 p-1.5 rounded text-[#1CABE2]"><Settings className="w-4 h-4" /></div>
                            <div>
                                <h4 className="font-bold text-[#003E5E]">Full Customization</h4>
                                <p className="text-sm text-slate-600">Adjust tariffs, subsidies, population growth, and carbon credits.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className="mt-1 bg-[#1CABE2]/10 p-1.5 rounded text-[#1CABE2]"><FileText className="w-4 h-4" /></div>
                            <div>
                                <h4 className="font-bold text-[#003E5E]">Report Generation</h4>
                                <p className="text-sm text-slate-600">Export technical designs and financial models to PDF.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <h3 className="font-bold text-[#003E5E] mb-3 text-lg">Data Layers and Sources</h3>
                        <div className="space-y-3 text-sm">
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                <p className="font-semibold text-[#003E5E] mb-1">Google Buildings</p>
                                <p className="text-slate-600 text-xs">Building footprints from Google Open Buildings for population-served estimation.</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                <p className="font-semibold text-[#003E5E] mb-1">Depth to Water (DTW)</p>
                                <p className="text-slate-600 text-xs">Estimated groundwater depth from WashWays GEE datasets to guide borehole assumptions.</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                <p className="font-semibold text-[#003E5E] mb-1">Groundwater Potential</p>
                                <p className="text-slate-600 text-xs">Aquifer productivity estimates to assess borehole success likelihood.</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                                <p className="font-semibold text-[#003E5E] mb-1">Elevation and Hillshade</p>
                                <p className="text-slate-600 text-xs">Terrain data from SRTM for hydraulic head calculations and visualization.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <h3 className="font-bold text-[#003E5E] mb-2">Population Served Calculation</h3>
                        <p className="text-xs text-slate-600">Population is estimated by counting buildings within a 250m buffer and multiplying by people per household (default 5).</p>
                    </div>
                </div>

                <div className="sticky bottom-0 pt-3 bg-white/95 backdrop-blur-sm flex flex-col md:flex-row gap-3 justify-center">
                    <button
                        onClick={() => setShowSplash(false)}
                        className="px-6 py-2.5 bg-[#1CABE2] hover:bg-[#1597c9] text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-[#1CABE2]/25 flex items-center justify-center gap-2 text-base group"
                    >
                        Start Analysis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                        onClick={() => setShowFeedback(true)}
                        className="px-5 py-2.5 bg-white hover:bg-gray-50 text-slate-600 font-medium rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-2"
                    >
                        <MessageSquare className="w-4 h-4" /> Leave Feedback
                    </button>
                </div>
            </div>
        </div>
    );
};
