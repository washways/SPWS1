import React from 'react';
import { MessageSquare, Activity, Sun, TrendingUp, Settings, FileText, ArrowRight, Send } from 'lucide-react';

interface SplashScreenProps {
    showSplash: boolean;
    setShowSplash: (show: boolean) => void;
    showFeedback: boolean;
    setShowFeedback: (show: boolean) => void;
    feedbackText: string;
    setFeedbackText: (text: string) => void;
    handleFeedbackSubmit: () => void;
    isSubmittingFeedback: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
    showSplash,
    setShowSplash,
    showFeedback,
    setShowFeedback,
    feedbackText,
    setFeedbackText,
    handleFeedbackSubmit,
    isSubmittingFeedback
}) => {
    if (!showSplash) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm text-white px-4">
            <div className="max-w-3xl w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Decorative background element */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>

                {showFeedback ? (
                    <div className="text-left animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-6 h-6 text-blue-400" />
                            <h2 className="text-2xl font-bold">Feedback</h2>
                        </div>
                        <p className="text-slate-300 mb-4 text-sm">Help us improve this experimental tool. Your input is valuable.</p>
                        <textarea
                            className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            placeholder="Describe your issue or suggestion here..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                        ></textarea>
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => setShowFeedback(false)} className="px-4 py-2 text-slate-400 hover:text-white transition">Cancel</button>
                            <button
                                onClick={handleFeedbackSubmit}
                                disabled={isSubmittingFeedback || !feedbackText.trim()}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSubmittingFeedback ? <Activity className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Submit Feedback
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-center mb-6">
                            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20">
                                <Activity className="w-12 h-12 text-white" />
                            </div>
                        </div>

                        <div className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-amber-500/50">
                            v2.1 Experimental Tool
                        </div>

                        <h1 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Rural Water Supply <span className="text-blue-400">Economic Analyzer</span></h1>

                        <div className="space-y-4 text-left bg-slate-700/30 p-6 rounded-xl border border-slate-600 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-blue-500/20 p-1.5 rounded text-blue-300"><Sun className="w-4 h-4" /></div>
                                    <div>
                                        <h4 className="font-bold text-white">Solar Piped Systems</h4>
                                        <p className="text-sm text-slate-400">Design networks, size pumps & panels, and estimate hydraulic profiles.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-emerald-500/20 p-1.5 rounded text-emerald-300"><TrendingUp className="w-4 h-4" /></div>
                                    <div>
                                        <h4 className="font-bold text-white">Economic Analysis</h4>
                                        <p className="text-sm text-slate-400">Compare Net Present Value (NPV) against traditional Handpumps.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-purple-500/20 p-1.5 rounded text-purple-300"><Settings className="w-4 h-4" /></div>
                                    <div>
                                        <h4 className="font-bold text-white">Full Customization</h4>
                                        <p className="text-sm text-slate-400">Adjust tariffs, subsidies, population growth, and carbon credits.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-orange-500/20 p-1.5 rounded text-orange-300"><FileText className="w-4 h-4" /></div>
                                    <div>
                                        <h4 className="font-bold text-white">Report Generation</h4>
                                        <p className="text-sm text-slate-400">Export detailed technical designs and financial models to PDF.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            <button
                                onClick={() => setShowSplash(false)}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2 text-lg group"
                            >
                                Start Analysis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={() => setShowFeedback(true)}
                                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all border border-slate-600 flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" /> Leave Feedback
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
