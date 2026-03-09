import React, { useEffect, useState } from 'react';
import { CostInput } from './components/CostInput';
import { Charts } from './components/Charts';
import { SiteMap } from './components/SiteMap';
import { SystemSchematic } from './components/SystemSchematic';
import { ReportAssumptions } from './components/ReportAssumptions';
import { Dashboard } from './components/Dashboard';
import { SplashScreen } from './components/SplashScreen';
import { useProjectState } from './hooks/useProjectState';
import { AnalyticsService } from './services/analyticsService';
import { Droplets, Map as MapIcon, ClipboardList, TrendingUp, Database, Settings as SettingsIcon, Timer, Heart, DollarSign, Coins, Activity, Download, RotateCcw, Zap, MessageSquare, RefreshCw, BookOpen, ExternalLink } from 'lucide-react';
import { APP_NOTICE_EVENT, notifyApp } from './utils/notifications';
import type { AppNotice } from './utils/notifications';
// @ts-ignore - html2pdf types are not perfect
import html2pdf from 'html2pdf.js';
const App: React.FC = () => {
    const {
        activeTab, setActiveTab,
        mapResetKey,
        showSplash, setShowSplash,
        showFeedback, setShowFeedback,
        feedbackText, setFeedbackText,
        isSubmittingFeedback,
        handleFeedbackSubmit,
        projectDetails, setProjectDetails,
        global, setGlobal,
        solar, setSolar,
        handpump, setHandpump,
        revenue, setRevenue,
        benefits, setBenefits,
        additionalBenefits, setAdditionalBenefits,
        designApplied,
        hydraulicInputs, setHydraulicInputs,
        systemSpecs,
        generatedBoQ,
        pipelineProfiles,
        systemGeometry,
        simMetric, setSimMetric,
        simulationResult,
        isSimulating,
        isDownloadingPdf, setIsDownloadingPdf,
        handleApplyDesign,
        handleUpdateCalc,
        updateBoQRate,
        finalDesignPopulation,
        yearlyData,
        summary,
        handpumpsNeeded,
        runSimulation,
        resetProject
    } = useProjectState();
    const [notices, setNotices] = useState<AppNotice[]>([]);
    const [hasVisitedAnalysis, setHasVisitedAnalysis] = useState(false);
    const [hasExportedReport, setHasExportedReport] = useState(false);
    const [contractorExportMode, setContractorExportMode] = useState(false);

    useEffect(() => {
        const onNotice = (event: Event) => {
            const detail = (event as CustomEvent<AppNotice>).detail;
            if (!detail || !detail.message) return;
            setNotices(prev => [...prev, detail]);
            const id = detail.id;
            window.setTimeout(() => {
                if (!id) return;
                setNotices(prev => prev.filter(item => item.id !== id));
            }, 5000);
        };

        window.addEventListener(APP_NOTICE_EVENT, onNotice);
        return () => window.removeEventListener(APP_NOTICE_EVENT, onNotice);
    }, []);

    useEffect(() => {
        if (activeTab === 'analysis') {
            setHasVisitedAnalysis(true);
        }
    }, [activeTab]);

    const waitForReportReady = async (element: HTMLElement) => {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

        const waitForImages = (nodes: HTMLImageElement[], timeoutMs: number) => Promise.race([
            Promise.all(nodes.map(node => {
                if (node.complete) return Promise.resolve();
                return new Promise<void>(resolve => {
                    node.addEventListener('load', () => resolve(), { once: true });
                    node.addEventListener('error', () => resolve(), { once: true });
                });
            })),
            new Promise<void>(resolve => setTimeout(() => resolve(), timeoutMs))
        ]);

        const regularImages = Array.from(element.querySelectorAll('img'));
        const leafletTiles = Array.from(element.querySelectorAll('.leaflet-tile')) as HTMLImageElement[];
        await waitForImages(regularImages, 2500);
        await waitForImages(leafletTiles, 2500);
    };

    const generatePDF = async (elementId: string, filename: string) => {
        setIsDownloadingPdf(true);

        // --- Analytics Logging ---
        const logged = await AnalyticsService.logReport({
            siteName: projectDetails.siteName,
            contractNumber: projectDetails.contractNumber,
            location: systemGeometry ? systemGeometry.center : { lat: 0, lng: 0 },
            population: global.population,
            designPopulation: finalDesignPopulation,
            systemType: 'Mixed',
            solarCapex: summary.capexSolar,
            handpumpCapex: summary.capexHandpump,
            solarNetValue: summary.netEconomicValueSolar,
            handpumpNetValue: summary.netEconomicValueHandpump,
            winner: summary.netEconomicValueSolar > summary.netEconomicValueHandpump ? 'Solar' : 'Handpump'
        });
        if (!logged) {
            notifyApp({ type: "warning", message: "Report was generated, but analytics logging failed." });
        }
        // -------------------------

        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element ${elementId} not found`);
            notifyApp({ type: "error", message: "PDF export target was not found." });
            setIsDownloadingPdf(false);
            return;
        }

        const opt = {
            margin: [5, 5, 5, 5],
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: true, allowTaint: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        try {
            await waitForReportReady(element);
            if (html2pdf) {
                await html2pdf().set(opt).from(element).save();
                setHasExportedReport(true);
                notifyApp({ type: "success", message: "Report downloaded successfully." });
            } else {
                notifyApp({ type: "error", message: "PDF generator library was not loaded." });
            }
        } catch (e) {
            console.error("PDF Gen Error", e);
            notifyApp({ type: "error", message: "Failed to generate PDF. Please check logs and retry." });
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const hasLocatedSite = projectDetails.siteName.trim().length > 0;
    const hasPlacedBorehole = Boolean(systemGeometry?.borehole);
    const hasPlacedTank = Boolean(systemGeometry?.tank);
    const hasPlacedTapstands = (systemGeometry?.taps?.length || 0) > 0;
    const hasDrawnNetwork = hasPlacedBorehole && hasPlacedTank && hasPlacedTapstands;
    const hasValidatedDesign = hasDrawnNetwork && Boolean(systemSpecs && generatedBoQ.length > 0);
    const hasValidatedAndApplied = hasValidatedDesign && designApplied;
    const hasAnalyzed = hasVisitedAnalysis || simulationResult !== null;
    const nextActionText =
        !hasLocatedSite
            ? 'Next: Step 1 - Design Map: search village and load Google Buildings.'
            : !hasDrawnNetwork
                ? 'Next: Step 1 - Design Map: place borehole/tank, draw pipelines, and add service points.'
                : !hasValidatedAndApplied
                    ? 'Next: Step 1 - Design Map: review served/unserved and click Apply Design.'
                    : !hasAnalyzed
                        ? 'Next: Step 3 - Economic Analysis: review results and run sensitivity analysis.'
                        : !hasExportedReport
                            ? 'Next: Step 3 - Economic Analysis: download the full PDF report.'
                            : 'Workflow complete.';
    const methodologyDocsUrl = 'https://github.com/washways/SPWS1#readme';
    const workflowGuide = [
        {
            step: 'Step 1',
            title: 'Design Map',
            detail: 'Search village, load buildings, place borehole and tank, route pipelines, add service points, then click Apply Design.',
            done: hasValidatedAndApplied
        },
        {
            step: 'Step 2',
            title: 'Schematic & BoQ',
            detail: 'Review technical layout, storage sizing, pipe lengths, and BoQ quantities before economic review.',
            done: Boolean(systemSpecs && generatedBoQ.length > 0)
        },
        {
            step: 'Step 3',
            title: 'Economic Analysis',
            detail: 'Review lifecycle comparison, run sensitivity analysis, and export the final report PDF.',
            done: hasExportedReport
        }
    ];

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-gray-800 relative">

            <SplashScreen
                showSplash={showSplash}
                setShowSplash={setShowSplash}
                setShowFeedback={setShowFeedback}
                zIndex={2000}
            />

            {/* Header */}
            <header className="bg-[#003E5E] text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div className="bg-[#1CABE2] p-2 rounded-lg"><Droplets className="w-6 h-6 text-white" /></div>
                            <div><h1 className="text-xl font-bold tracking-tight">Malawi Water Supply Comparison</h1><p className="text-xs text-slate-400">Site Specific Economic Feasibility Tool</p></div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button onClick={resetProject} className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition text-slate-300 hover:bg-slate-800" title="Start New Analysis">
                                <RefreshCw className="w-4 h-4" /> New Analysis
                            </button>
                            <button onClick={() => setActiveTab('map')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'map' ? 'bg-[#1CABE2] text-white' : 'text-slate-300 hover:bg-slate-800'}`}><MapIcon className="w-4 h-4" /> Design Map</button>
                            <button onClick={() => setActiveTab('schematic')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'schematic' ? 'bg-[#1CABE2] text-white' : 'text-slate-300 hover:bg-slate-800'}`}><ClipboardList className="w-4 h-4" /> Schematic & BoQ</button>
                            <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'analysis' ? 'bg-[#1CABE2] text-white' : 'text-slate-300 hover:bg-slate-800'}`}><TrendingUp className="w-4 h-4" /> Economic Analysis</button>
                            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'dashboard' ? 'bg-[#1CABE2] text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Database className="w-4 h-4" /> Insights & Feedback</button>
                        </div>
                    </div>
                </div>
            </header >

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-4 bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <h3 className="font-bold text-gray-900">Guided Workflow</h3>
                        <a
                            href={methodologyDocsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded w-fit"
                            title="Open detailed methodology and documentation on GitHub"
                        >
                            <BookOpen className="w-3.5 h-3.5" />
                            Methodology & Docs
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {workflowGuide.map((item) => (
                            <div key={item.step} className={`rounded-lg border p-3 ${item.done ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{item.step}</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${item.done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                        {item.done ? 'Done' : 'Pending'}
                                    </span>
                                </div>
                                <div className="font-semibold text-sm text-gray-800">{item.title}</div>
                                <p className="text-xs text-gray-600 mt-1">{item.detail}</p>
                            </div>
                        ))}
                    </div>
                    <div className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded mt-3 px-3 py-2">{nextActionText}</div>
                </div>

                {/* MAP TAB */}
                <div className={activeTab === 'map' ? 'block' : 'hidden'}>
                    <SiteMap key={mapResetKey} population={global.population} setPopulation={(p) => setGlobal(prev => ({ ...prev, population: p }))} projectDetails={projectDetails} setProjectDetails={setProjectDetails} inputs={hydraulicInputs} setInputs={setHydraulicInputs} onUpdateCalc={handleUpdateCalc} onApplyDesign={handleApplyDesign} />
                </div>

                {/* SCHEMATIC TAB */}
                <div className={activeTab === 'schematic' ? 'block' : 'hidden'}>
                    <SystemSchematic
                        inputs={hydraulicInputs}
                        specs={systemSpecs}
                        boq={generatedBoQ}
                        profiles={pipelineProfiles}
                        currency={global.currency}
                        onUpdateRate={updateBoQRate}
                        geometry={systemGeometry}
                        projectDetails={projectDetails}
                        population={global.population}
                        designPopulation={finalDesignPopulation}
                        redactUnitCosts={false}
                    />
                </div>

                {/* DASHBOARD TAB */}
                <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                    <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-gray-900">Insights & Feedback</h3>
                                <p className="text-sm text-gray-600">Review analytics and submit user feedback from one place.</p>
                            </div>
                            <button
                                onClick={() => setShowFeedback(true)}
                                className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition bg-slate-100 text-slate-700 hover:bg-slate-200 w-fit"
                                title="Send Feedback"
                            >
                                <MessageSquare className="w-4 h-4" /> Send Feedback
                            </button>
                        </div>
                    </div>
                    <Dashboard />
                </div>

                {/* ANALYSIS TAB (CONTAINING PDF REPORT CONTENT) */}
                <div className={activeTab === 'analysis' ? 'block' : 'hidden'}>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Inputs Sidebar (Hidden in PDF) */}
                        <div className="space-y-6" data-html2canvas-ignore="true">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex items-center gap-2 mb-4 text-slate-800"><SettingsIcon className="w-5 h-5" /><h2 className="font-bold">Global Parameters</h2></div>
                                <CostInput label="Discount Rate" value={global.discountRate} onChange={(v) => setGlobal({ ...global, discountRate: v })} unit="%" min={0} max={100} />
                                <CostInput label="Project Lifespan" value={global.projectLifespan} onChange={(v) => setGlobal({ ...global, projectLifespan: v })} unit="years" min={1} max={100} />
                                <CostInput label="Pop. Growth Rate" value={global.populationGrowthRate} onChange={(v) => setGlobal({ ...global, populationGrowthRate: v })} unit="%" step={0.1} min={0} max={25} />
                                <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100">
                                    <span className="font-bold text-gray-500">Design Population (Yr {global.projectLifespan}):</span>
                                    <div className="text-lg font-bold text-gray-800">{finalDesignPopulation.toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex items-center gap-2 mb-4 text-slate-800"><Timer className="w-5 h-5" /><h2 className="font-bold">Time & Health Inputs</h2></div>
                                <CostInput label="Hourly Wage (Opp. Cost)" value={benefits.hourlyWage} onChange={(v) => setBenefits({ ...benefits, hourlyWage: v })} unit="$/hr" step={0.05} min={0} />
                                <div className="border-t pt-2 mt-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Collection Time (Round Trip)</h3>
                                    <CostInput label="Status Quo (River/Well)" value={benefits.timeSpentBaseline} onChange={(v) => setBenefits({ ...benefits, timeSpentBaseline: v })} unit="min/day" helpText="Baseline 'No Water' Scenario" min={0} max={1440} />
                                    <CostInput label="Handpump (Walk+Queue)" value={benefits.timeSpentHandpump} onChange={(v) => setBenefits({ ...benefits, timeSpentHandpump: v })} unit="min/day" min={0} max={1440} />
                                    <CostInput label="Solar Piped (At Tap)" value={benefits.timeSpentSolar} onChange={(v) => setBenefits({ ...benefits, timeSpentSolar: v })} unit="min/day" min={0} max={1440} />
                                </div>
                                <div className="border-t pt-2 mt-2"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Health Value (Monetized)</h3><CostInput label="Solar Health Premium" value={benefits.healthPremiumSolar} onChange={(v) => setBenefits({ ...benefits, healthPremiumSolar: v })} unit="$/pp/yr" min={0} /><CostInput label="Handpump Health Value" value={benefits.healthPremiumHandpump} onChange={(v) => setBenefits({ ...benefits, healthPremiumHandpump: v })} unit="$/pp/yr" min={0} /></div>
                            </div>

                            {/* Additional Benefits Values (Driven by Map) */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                                <div className="flex items-center gap-2 mb-4 text-purple-900"><Heart className="w-5 h-5" /><h2 className="font-bold">Community Value-Add</h2></div>
                                <div className="mb-3 text-xs text-purple-800 bg-purple-50 p-2 rounded">
                                    Add Schools, Clinics, Gardens, or Grids in the <strong>Design Map</strong> to enable these benefits.
                                </div>
                                <div className="space-y-3">
                                    {systemSpecs && systemSpecs.countSchools > 0 && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Schools ({systemSpecs.countSchools})</span></div><CostInput label="Value per School/Yr" value={additionalBenefits.valueSchool} onChange={(v) => setAdditionalBenefits({ ...additionalBenefits, valueSchool: v })} unit="$" min={0} /></div>}
                                    {systemSpecs && systemSpecs.countClinics > 0 && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Clinics ({systemSpecs.countClinics})</span></div><CostInput label="Value per Clinic/Yr" value={additionalBenefits.valueClinic} onChange={(v) => setAdditionalBenefits({ ...additionalBenefits, valueClinic: v })} unit="$" min={0} /></div>}
                                    {systemSpecs && systemSpecs.countGardens > 0 && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Gardens ({systemSpecs.countGardens})</span></div><CostInput label="Value per Garden/Yr" value={additionalBenefits.valueGarden} onChange={(v) => setAdditionalBenefits({ ...additionalBenefits, valueGarden: v })} unit="$" min={0} /></div>}
                                    {systemSpecs && systemSpecs.hasGrid && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Energy Access</span></div><CostInput label="Value of Energy/Yr" value={additionalBenefits.valueEnergy} onChange={(v) => setAdditionalBenefits({ ...additionalBenefits, valueEnergy: v })} unit="$" min={0} /></div>}
                                    {(!systemSpecs || (systemSpecs.countSchools === 0 && systemSpecs.countClinics === 0 && systemSpecs.countGardens === 0 && !systemSpecs.hasGrid)) && <div className="text-sm text-gray-400 italic text-center py-2">No institutions added on map.</div>}
                                </div>
                            </div>

                            {/* Financial Params */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex items-center gap-2 mb-4 text-slate-800"><DollarSign className="w-5 h-5" /><h2 className="font-bold">Financial Assumptions</h2></div>
                                <div className="space-y-4">
                                    <div><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Solar Piped</h3><CostInput label="OpEx (Annual)" value={solar.opexAnnual} onChange={(v) => setSolar({ ...solar, opexAnnual: v })} unit="$" min={0} /><CostInput label="Replacements (Inv/Pump)" value={solar.replacementCost} onChange={(v) => setSolar({ ...solar, replacementCost: v })} unit="$" min={0} /><CostInput label="Theft Probability" value={solar.theftProbability} onChange={(v) => setSolar({ ...solar, theftProbability: v })} unit="%" min={0} max={100} /></div>
                                    <div className="border-t pt-2"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Handpumps</h3><CostInput label="CapEx (Per Unit)" value={handpump.capexPerUnit} onChange={(v) => setHandpump({ ...handpump, capexPerUnit: v })} unit="$" min={0} /><CostInput label="OpEx (Per Unit/Yr)" value={handpump.opexAnnualPerUnit} onChange={(v) => setHandpump({ ...handpump, opexAnnualPerUnit: v })} unit="$" min={0} /></div>
                                </div>
                            </div>

                            {/* Revenue & Subsidies */}
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex items-center gap-2 mb-4 text-slate-800"><Coins className="w-5 h-5" /><h2 className="font-bold">Revenue & Subsidies</h2></div>
                                <div className="mb-4">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Solar Piped</h3>
                                    <CostInput label="Tariff (Per HH/Mo)" value={revenue.tariffSolarPerMonth} onChange={(v) => setRevenue({ ...revenue, tariffSolarPerMonth: v })} unit="$" step={0.1} min={0} />
                                    <CostInput label="Collection Efficiency" value={revenue.collectionEfficiencySolar} onChange={(v) => setRevenue({ ...revenue, collectionEfficiencySolar: v })} unit="%" min={0} max={100} />
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        <h4 className="text-xs font-bold text-blue-600 uppercase mb-2">External Support</h4>
                                        <CostInput label="Carbon Credit Price" value={revenue.carbonCreditPricePerM3} onChange={(v) => setRevenue({ ...revenue, carbonCreditPricePerM3: v })} unit="$/m³" step={0.01} min={0} />
                                        <CostInput label="Govt Subsidy (Top-up)" value={revenue.govtSubsidyFraction} onChange={(v) => setRevenue({ ...revenue, govtSubsidyFraction: v })} unit="% of Tariff" min={0} max={100} />
                                    </div>
                                </div>
                                <div className="border-t pt-2">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Handpumps</h3>
                                    <CostInput label="Tariff (Per HH/Mo)" value={revenue.tariffHandpumpPerMonth || 0} onChange={(v) => setRevenue({ ...revenue, tariffHandpumpPerMonth: v })} unit="$" step={0.1} min={0} />
                                    <CostInput label="Collection Efficiency" value={revenue.collectionEfficiencyHandpump} onChange={(v) => setRevenue({ ...revenue, collectionEfficiencyHandpump: v })} unit="%" min={0} max={100} />
                                </div>
                            </div>
                        </div>

                        {/* Results (Included in PDF) */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <div><h2 className="font-bold text-gray-900">Economic Analysis</h2><p className="text-sm text-gray-500">20-Year Lifecycle Cost Comparison</p></div>
                                <div className="flex gap-2">
                                    <div className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600 flex items-center">Handpumps Needed: <strong className="ml-1 text-gray-900">{handpumpsNeeded}</strong></div>
                                    <label className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={contractorExportMode}
                                            onChange={(e) => setContractorExportMode(e.target.checked)}
                                            className="rounded border-gray-300"
                                        />
                                        Contractor Export (hide unit costs)
                                    </label>
                                    <button onClick={() => {
                                        const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                                        const cleanName = (projectDetails.siteName || 'Site').replace(/[^a-z0-9]/gi, '_');
                                        const suffix = contractorExportMode ? '_Contractor_NoUnitCosts' : '';
                                        generatePDF('report-content', `Feasibility_Report_${cleanName}_${dateStr}${suffix}.pdf`);
                                    }} disabled={isDownloadingPdf} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition shadow-sm disabled:opacity-75">
                                        {isDownloadingPdf ? <Activity className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        {isDownloadingPdf ? "Generating PDF..." : "Download Full Report"}
                                    </button>
                                </div>
                            </div>

                            {/* WRAPPED CONTENT FOR PDF */}
                            <div id="report-content" className="bg-white p-4 rounded-xl">
                                {/* PDF Header - Visible only in PDF */}
                                {isDownloadingPdf && (
                                    <div className="mb-6 pb-6 border-b border-gray-200 text-center">
                                        <h1 className="text-3xl font-bold text-gray-900">Water Supply Feasibility Report</h1>
                                        <p className="text-gray-500 text-lg mt-2">{projectDetails.siteName || "Site Name Not Specified"} | Contract: {projectDetails.contractNumber || "TBD"}</p>
                                        <p className="text-sm text-gray-400 mt-1">Generated: {new Date().toLocaleDateString()}</p>
                                        {contractorExportMode && (
                                            <p className="text-sm text-amber-700 mt-2 font-medium">Contractor Export Mode: Unit costs are hidden in BoQ sections.</p>
                                        )}

                                        <div className="mt-6 text-left bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <h3 className="font-bold text-slate-800 mb-2">Executive Summary</h3>
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                                This report provides a comparative economic analysis between a Solar Piped Water System and a decentralized Handpump solution.
                                                It evaluates the lifecycle costs, revenue potential (including tariffs, carbon credits, and subsidies), and socio-economic benefits
                                                such as health improvements, time savings, and institutional support. The analysis utilizes a 20-year projection to determine the
                                                Net Economic Value and long-term financial sustainability of each option.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* PART 1: Technical Design (PDF ONLY - Renders FIRST) */}
                                {designApplied && (
                                    <div className={`mt-8 ${isDownloadingPdf ? 'block' : 'hidden'}`}>
                                        <h2 className="text-xl font-bold mb-4 bg-gray-100 p-2 rounded">Part 1: Technical Design & BoQ</h2>
                                        <SystemSchematic
                                            inputs={hydraulicInputs}
                                            specs={systemSpecs}
                                            boq={generatedBoQ}
                                            profiles={pipelineProfiles}
                                            currency={global.currency}
                                            onUpdateRate={updateBoQRate}
                                            geometry={systemGeometry}
                                            projectDetails={projectDetails}
                                            printMode={isDownloadingPdf}
                                            population={global.population}
                                            designPopulation={finalDesignPopulation}
                                            redactUnitCosts={contractorExportMode}
                                        />
                                        <div className="html2pdf__page-break"></div>
                                    </div>
                                )}

                                {/* PART 2: Economic Analysis (Renders Second in PDF, First on Screen) */}
                                <div>
                                    {isDownloadingPdf && <h2 className="text-xl font-bold mb-4 bg-gray-100 p-2 rounded">Part 2: Economic Analysis</h2>}
                                    <Charts yearlyData={yearlyData} summary={summary} currency={global.currency} simulationResult={simulationResult} />

                                    {/* Simulation Result */}
                                    <div className="mt-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Activity className="w-5 h-5" /> Sensitivity Analysis</h3>
                                            <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold" data-html2canvas-ignore="true">
                                                <button onClick={() => setSimMetric('economic')} className={`px-3 py-1 rounded ${simMetric === 'economic' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Economic</button>
                                                <button onClick={() => setSimMetric('financial')} className={`px-3 py-1 rounded ${simMetric === 'financial' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Financial</button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-4">Running 10,000 scenarios varying costs and benefits by +/-20%. This simulates real-world uncertainty to determine the probability of the Solar System providing better value.</p>
                                        <button onClick={runSimulation} disabled={isSimulating} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition flex justify-center items-center gap-2" data-html2canvas-ignore="true">{isSimulating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}{isSimulating ? 'Simulating...' : 'Run Simulation'}</button>
                                    </div>
                                </div>

                                {/* PART 3: Assumptions (PDF ONLY) */}
                                <div className={`mt-8 ${isDownloadingPdf ? 'block' : 'hidden'}`}>
                                    <div className="html2pdf__page-break"></div>
                                    <ReportAssumptions
                                        global={global}
                                        solar={solar}
                                        handpump={handpump}
                                        benefits={benefits}
                                        revenue={revenue}
                                        additional={additionalBenefits}
                                    />
                                </div>

                                <p className="text-xs font-medium">Click <strong>Apply Design</strong> in the sidebar to generate costs and schematics.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Persistent Feedback Modal */}
            <div className="fixed top-4 right-4 z-[3000] space-y-2 w-[90vw] max-w-sm pointer-events-none">
                {notices.map(notice => (
                    <div
                        key={notice.id}
                        className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg text-sm ${notice.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : notice.type === 'error'
                                ? 'bg-red-50 border-red-200 text-red-900'
                                : notice.type === 'warning'
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-blue-50 border-blue-200 text-blue-900'
                            }`}
                    >
                        {notice.message}
                    </div>
                ))}
            </div>
            {
                showFeedback && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in fade-in zoom-in duration-200">
                            <button
                                onClick={() => setShowFeedback(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <MessageSquare className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-2xl font-bold text-gray-900">Send Feedback</h3>
                                </div>
                                <p className="text-sm text-gray-600">Help us improve this tool by sharing your thoughts, suggestions, or reporting issues.</p>
                            </div>
                            <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Your feedback, suggestions, or contact details..."
                                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none mb-4"
                                rows={6}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowFeedback(false)}
                                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleFeedbackSubmit}
                                    disabled={isSubmittingFeedback || !feedbackText.trim()}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmittingFeedback ? (
                                        <>
                                            <Activity className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Submit Feedback'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default App;
