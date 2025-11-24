
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DEFAULT_GLOBAL, DEFAULT_HANDPUMP, DEFAULT_SOLAR, DEFAULT_BENEFITS, SOLAR_COST_FACTORS, DEFAULT_ADDITIONAL_BENEFITS, DEFAULT_REVENUE } from './constants';
import { GlobalParams, HandpumpParams, SolarSystemParams, FinancialResult, ComparisonSummary, BenefitsParams, VillageLayout, SimulationResult, MonteCarloStat, AdditionalBenefitsParams, RevenueParams, HydraulicInputs, SystemSpecs, BoQItem, PipelineProfile, SystemGeometry, ProjectDetails } from './types';
import { CostInput } from './components/CostInput';
import { Charts } from './components/Charts';
import { SiteMap } from './components/SiteMap';
import { SystemSchematic } from './components/SystemSchematic';
import { ReportAssumptions } from './components/ReportAssumptions';
import { Dashboard } from './components/Dashboard';
import { AnalyticsService } from './services/analyticsService';
import { Calculator, Sun, Droplets, Lightbulb, RotateCcw, Map as MapIcon, Activity, GraduationCap, Stethoscope, Sprout, Zap, TrendingUp, DollarSign, Coins, Lock, Unlock, ClipboardList, Clock, Heart, Printer, Info, Timer, Download, FileText, Database, Globe, ArrowRight, MessageSquare, Send, Search, Layers, Settings, Mountain, CheckCircle } from 'lucide-react';

const App: React.FC = () => {
  // --- View State ---
  const [activeTab, setActiveTab] = useState<'map' | 'schematic' | 'analysis' | 'dashboard'>('map');
  const [mapResetKey, setMapResetKey] = useState(0); 
  const [showSplash, setShowSplash] = useState(true);
  
  // Feedback State
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // --- State ---
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({ siteName: '', contractNumber: '' });
  const [global, setGlobal] = useState<GlobalParams>(DEFAULT_GLOBAL);
  const [solar, setSolar] = useState<SolarSystemParams>(DEFAULT_SOLAR);
  const [handpump, setHandpump] = useState<HandpumpParams>(DEFAULT_HANDPUMP);
  const [revenue, setRevenue] = useState<RevenueParams>(DEFAULT_REVENUE);
  const [benefits, setBenefits] = useState<BenefitsParams>(DEFAULT_BENEFITS);
  const [additionalBenefits, setAdditionalBenefits] = useState<AdditionalBenefitsParams>(DEFAULT_ADDITIONAL_BENEFITS);
  const [layout, setLayout] = useState<VillageLayout>('compact');
  
  // Auto-Scale Logic
  const [autoScaleSolar, setAutoScaleSolar] = useState(true);
  const [designApplied, setDesignApplied] = useState(false);
  
  // Lifted Engineering State
  const [hydraulicInputs, setHydraulicInputs] = useState<HydraulicInputs>({
      boreholeDepth: 60, staticWaterLevel: 25, elevationDifference: 15, tankHeight: 6, pipeLength: 0, dailyDemandPerCapita: 30, peakSunHours: 5.5, pumpEfficiency: 0.6, frictionLossFactor: 0.08, boreholeElevation: undefined, tankElevation: undefined
  });
  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs | null>(null);
  const [generatedBoQ, setGeneratedBoQ] = useState<BoQItem[]>([]);
  const [pipelineProfiles, setPipelineProfiles] = useState<PipelineProfile[]>([]);
  const [systemGeometry, setSystemGeometry] = useState<SystemGeometry | null>(null);

  // Simulation Settings
  const [simMetric, setSimMetric] = useState<'economic' | 'financial'>('economic');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // --- Analytics Initialization ---
  useEffect(() => {
    AnalyticsService.startSession();
  }, []);

  // --- Handlers ---
  const handleApplyDesign = (civilCost: number, equipCost: number, pipeLength: number) => {
      if (autoScaleSolar) {
          setSolar(prev => ({ ...prev, capexDrillingAndCivil: civilCost, capexEquip: equipCost }));
      }
      setDesignApplied(true);
      setActiveTab('schematic'); 
  };

  const handleUpdateCalc = (specs: SystemSpecs, boq: BoQItem[], profiles: PipelineProfile[], geometry: SystemGeometry) => {
      setSystemSpecs(specs);
      setGeneratedBoQ(boq);
      setPipelineProfiles(profiles);
      setSystemGeometry(geometry);

      // Real-time cost updates
      const civils = boq.filter(i => i.category === 'Civils' || i.category === 'Network').reduce((acc, i) => acc + i.amount, 0);
      const equip = boq.filter(i => i.category === 'Mechanical' || i.category === 'Electrical').reduce((acc, i) => acc + i.amount, 0);
      
      if (autoScaleSolar) {
          setSolar(prev => ({ ...prev, capexDrillingAndCivil: civils, capexEquip: equip }));
      }
  };

  const updateBoQRate = (id: string, newRate: number) => {
      const updated = generatedBoQ.map(item => {
          if (item.id === id) return { ...item, rate: newRate, amount: newRate * item.qty };
          return item;
      });
      setGeneratedBoQ(updated);
      const civils = updated.filter(i => i.category === 'Civils' || i.category === 'Network').reduce((acc, i) => acc + i.amount, 0);
      const equip = updated.filter(i => i.category === 'Mechanical' || i.category === 'Electrical').reduce((acc, i) => acc + i.amount, 0);
      if(autoScaleSolar) { setSolar(prev => ({...prev, capexDrillingAndCivil: civils, capexEquip: equip})); }
  };

  const handleFeedbackSubmit = async () => {
      if(!feedbackText.trim()) return;
      setIsSubmittingFeedback(true);
      try {
          await AnalyticsService.sendFeedback(feedbackText);
          alert("Thank you! Your feedback has been recorded.");
          setFeedbackText("");
          setShowFeedback(false);
      } catch (e) {
          alert("Error sending feedback. Please check if the backend is running.");
      } finally {
          setIsSubmittingFeedback(false);
      }
  };

  // --- Calculations ---
  
  // Calculate Final Design Population based on compounded growth
  const finalDesignPopulation = useMemo(() => {
    return Math.round(global.population * Math.pow(1 + global.populationGrowthRate / 100, global.projectLifespan));
  }, [global.population, global.populationGrowthRate, global.projectLifespan]);

  const calculateNPV = useCallback(() => {
    const results: FinancialResult[] = [];
    
    const solarCapex = solar.capexDrillingAndCivil + solar.capexEquip;
    const handpumpsNeeded = Math.ceil(global.population / handpump.usersPerPump);
    const handpumpCapex = handpumpsNeeded * handpump.capexPerUnit;

    // Financial Cash Flow: OPERATIONAL ONLY (Bank Balance)
    // Starts at 0, assuming CapEx is donor-funded.
    let sCum = 0;
    let hCum = 0;
    
    // Net Economic Value: INCLUDES CAPEX (Society/Project View)
    // Starts at negative CapEx.
    let sNetValue = -solarCapex; 
    let hNetValue = -handpumpCapex;
    
    // Determine system volume for carbon credits
    const annualVolumeM3 = systemSpecs ? (systemSpecs.dailyDemandM3 * 365) : (global.population * 30 / 1000 * 365);

    for (let year = 1; year <= global.projectLifespan; year++) {
        const currentPop = global.population * Math.pow(1 + global.populationGrowthRate / 100, year);
        const discountFactor = Math.pow(1 + global.discountRate / 100, year);

        // Costs
        let sCost = solar.opexAnnual;
        if (year % solar.replacementInterval === 0) sCost += solar.replacementCost;
        let hCost = (handpumpsNeeded * handpump.opexAnnualPerUnit);
        if (year % handpump.rehabInterval === 0) hCost += (handpumpsNeeded * handpump.rehabCostPerUnit);

        // Revenues (Tariffs + Subsidies)
        const tariffRev = (currentPop / revenue.householdSize) * revenue.tariffSolarPerMonth * 12 * (revenue.collectionEfficiencySolar / 100);
        
        // Volumetric Carbon Credit (Assuming system size roughly matches pop growth or fixed capacity, using fixed for simplicity or scaled)
        // Using fixed annual volume capacity of system for carbon credits (as installed capacity is the limit)
        const carbonRev = annualVolumeM3 * revenue.carbonCreditPricePerM3; 
        
        // Subsidy as fraction of tariff
        const subsidyRev = tariffRev * (revenue.govtSubsidyFraction / 100);
        
        const sRev = tariffRev + carbonRev + subsidyRev;

        const hRev = (currentPop / revenue.householdSize) * (revenue.tariffHandpumpPerMonth || 0) * 12 * (revenue.collectionEfficiencyHandpump / 100);

        // Cash Flow Accumulation (Revenue - Cost)
        // NOTE: CapEx is excluded here as per requirements (Donor funded)
        sCum += (sRev - sCost); 
        hCum += (hRev - hCost);

        // Economic Benefits (Absolute vs Baseline Status Quo of "No Water")
        const solarTimeSavedHours = ((benefits.timeSpentBaseline - benefits.timeSpentSolar) / 60) * 365; // Hours per person per year
        const solarTimeValue = Math.max(0, solarTimeSavedHours * currentPop * benefits.hourlyWage * 0.5); 
        const solarHealthValue = currentPop * benefits.healthPremiumSolar;
        let solarAddValue = 0;
        if (systemSpecs) {
             solarAddValue += (systemSpecs.countSchools * additionalBenefits.valueSchool);
             solarAddValue += (systemSpecs.countClinics * additionalBenefits.valueClinic);
             solarAddValue += (systemSpecs.countGardens * additionalBenefits.valueGarden);
             if(systemSpecs.hasGrid) solarAddValue += additionalBenefits.valueEnergy;
        }
        
        const theftCost = (solarCapex * (solar.theftProbability / 100));
        
        // Economic Flow: Benefits - Costs. 
        // Note: Subsidies are transfer payments (cancelled out in econ analysis), but Carbon is external inflow.
        const sEconFlow = (tariffRev + solarTimeValue + solarHealthValue + solarAddValue + carbonRev) - (sCost + theftCost);
        sNetValue += (sEconFlow / discountFactor);

        // Handpump Benefits
        const hpTimeSavedHours = ((benefits.timeSpentBaseline - benefits.timeSpentHandpump) / 60) * 365;
        const hpTimeValue = Math.max(0, hpTimeSavedHours * currentPop * benefits.hourlyWage * 0.5);
        const hpHealthValue = currentPop * benefits.healthPremiumHandpump;
        
        const hEconFlow = (hRev + hpTimeValue + hpHealthValue) - hCost;
        hNetValue += (hEconFlow / discountFactor);

        results.push({ year, solarCost: sCost, solarRevenue: sRev, solarCumulativeCashflow: sCum, handpumpCost: hCost, handpumpRevenue: hRev, handpumpCumulativeCashflow: hCum, solarNetValue: sNetValue, handpumpNetValue: hNetValue });
    }

    const calcNPV = (val: number, yrs: number) => {
        let npv = 0;
        for(let y=1; y<=yrs; y++) npv += val / Math.pow(1 + global.discountRate/100, y);
        return npv;
    };

    // Calculate Total Carbon and Subsidy NPV for summary
    const totalCarbonNPV = calcNPV(annualVolumeM3 * revenue.carbonCreditPricePerM3, global.projectLifespan);
    
    // Approximate average tariff revenue for subsidy calc (simplified)
    const avgPop = global.population * Math.pow(1 + global.populationGrowthRate/100, global.projectLifespan/2);
    const avgTariffRev = (avgPop / revenue.householdSize) * revenue.tariffSolarPerMonth * 12 * (revenue.collectionEfficiencySolar / 100);
    const totalSubsidyNPV = calcNPV(avgTariffRev * (revenue.govtSubsidyFraction / 100), global.projectLifespan);

    const summary: ComparisonSummary = {
        layout,
        capexSolar: solarCapex,
        capexHandpump: handpumpCapex,
        opexSolarNPV: calcNPV(solar.opexAnnual, global.projectLifespan),
        opexHandpumpNPV: calcNPV(handpumpsNeeded * handpump.opexAnnualPerUnit, global.projectLifespan),
        revenueSolarNPV: calcNPV(avgTariffRev + (annualVolumeM3 * revenue.carbonCreditPricePerM3) + (avgTariffRev * revenue.govtSubsidyFraction/100), global.projectLifespan),
        revenueHandpumpNPV: calcNPV((global.population / revenue.householdSize) * (revenue.tariffHandpumpPerMonth||0) * 12 * (revenue.collectionEfficiencyHandpump/100), global.projectLifespan),
        totalSolarFinNPV: results[results.length-1].solarCumulativeCashflow,
        totalHandpumpFinNPV: results[results.length-1].handpumpCumulativeCashflow,
        
        theftRiskNPV: calcNPV(solarCapex * (solar.theftProbability/100), global.projectLifespan),
        
        timeSavedSolarNPV: calcNPV( (global.population * (benefits.timeSpentBaseline - benefits.timeSpentSolar)/60 * 365 * benefits.hourlyWage * 0.5), global.projectLifespan),
        timeSavedHandpumpNPV: calcNPV( (global.population * (benefits.timeSpentBaseline - benefits.timeSpentHandpump)/60 * 365 * benefits.hourlyWage * 0.5), global.projectLifespan),
        
        healthBenefitSolarNPV: calcNPV(global.population * benefits.healthPremiumSolar, global.projectLifespan),
        healthBenefitHandpumpNPV: calcNPV(global.population * benefits.healthPremiumHandpump, global.projectLifespan),
        
        valueSchoolNPV: systemSpecs ? calcNPV(systemSpecs.countSchools * additionalBenefits.valueSchool, global.projectLifespan) : 0,
        valueClinicNPV: systemSpecs ? calcNPV(systemSpecs.countClinics * additionalBenefits.valueClinic, global.projectLifespan) : 0,
        valueGardenNPV: systemSpecs ? calcNPV(systemSpecs.countGardens * additionalBenefits.valueGarden, global.projectLifespan) : 0,
        valueEnergyNPV: systemSpecs && systemSpecs.hasGrid ? calcNPV(additionalBenefits.valueEnergy, global.projectLifespan) : 0,
        valueCarbonNPV: totalCarbonNPV + totalSubsidyNPV, // Combining external financial inflows here for the chart breakdown

        netEconomicValueSolar: results[results.length-1].solarNetValue,
        netEconomicValueHandpump: results[results.length-1].handpumpNetValue
    };

    return { yearlyData: results, summary };
  }, [global, solar, handpump, revenue, benefits, additionalBenefits, layout, systemSpecs]);

  const { yearlyData, summary } = useMemo(() => calculateNPV(), [calculateNPV]);
  const handpumpsNeeded = Math.ceil(global.population / handpump.usersPerPump);

  const generatePDF = async (elementId: string, filename: string) => {
    setIsDownloadingPdf(true);

    // --- Analytics Logging ---
    AnalyticsService.logReport({
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
    // -------------------------

    // Ensure state propagates and elements become visible
    setTimeout(async () => {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element ${elementId} not found`);
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
            // @ts-ignore
            if (window.html2pdf) {
                // @ts-ignore
                await window.html2pdf().set(opt).from(element).save();
            } else {
                alert("PDF Generator library not loaded. Please refresh the page.");
            }
        } catch (e) {
            console.error("PDF Gen Error", e);
            alert("Failed to generate PDF. Please check the console for errors.");
        } finally {
            setIsDownloadingPdf(false);
        }
    }, 2500); // Wait for Map Tiles to render
  };

  const runSimulation = () => {
      setIsSimulating(true);
      setTimeout(() => {
          const iterations = 10000; 
          const diffs: number[] = [];
          let sWins = 0;
          
          for(let i=0; i<iterations; i++) {
              const rand = () => 1 + (Math.random() * 0.4 - 0.2); 
              
              const sCap = summary.capexSolar * rand();
              const hCap = summary.capexHandpump * rand();
              const sOpex = summary.opexSolarNPV * rand();
              const hOpex = summary.opexHandpumpNPV * rand();
              
              const sTimeVal = summary.timeSavedSolarNPV * rand();
              const hTimeVal = summary.timeSavedHandpumpNPV * rand();
              const sHealthVal = summary.healthBenefitSolarNPV * rand();
              const hHealthVal = summary.healthBenefitHandpumpNPV * rand();
              
              const sAddVal = (summary.valueSchoolNPV + summary.valueClinicNPV + summary.valueGardenNPV + summary.valueEnergyNPV + summary.valueCarbonNPV) * rand();
              const sRisk = summary.theftRiskNPV * rand();

              let sNet = 0; 
              let hNet = 0;

              if (simMetric === 'financial') {
                 const sRev = summary.revenueSolarNPV * rand();
                 const hRev = summary.revenueHandpumpNPV * rand();
                 // Financial: Revenue - Opex (Assuming CapEx covered externally as per new requirement)
                 sNet = sRev - sOpex;
                 hNet = hRev - hOpex;
              } else {
                 // Economic: All Benefits - All Costs (Including CapEx)
                 sNet = (sTimeVal + sHealthVal + sAddVal) - (sCap + sOpex + sRisk);
                 hNet = (hTimeVal + hHealthVal) - (hCap + hOpex);
              }

              if (sNet > hNet) sWins++;
              diffs.push(sNet - hNet);
          }
          
          diffs.sort((a,b) => a-b);
          const bins = 40;
          const min = diffs[0];
          const max = diffs[diffs.length-1];
          const range = max - min;
          const binSize = range / bins;
          
          const dist: MonteCarloStat[] = [];
          for(let b=0; b<bins; b++) {
              const start = min + b*binSize;
              const end = start + binSize;
              const count = diffs.filter(d => d >= start && d < end).length;
              dist.push({ binStart: start, binEnd: end, count, label: `${(start/1000).toFixed(0)}k` });
          }
          setSimulationResult({ solarWins: sWins, handpumpWins: iterations - sWins, solarWinRate: (sWins/iterations)*100, distribution: dist });
          setIsSimulating(false);
      }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 relative">
      
      {/* --- SPLASH SCREEN OVERLAY --- */}
      {showSplash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm text-white px-4">
            <div className="max-w-3xl w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 text-center relative overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Decorative background element */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"></div>
                
                {showFeedback ? (
                    <div className="text-left animate-in slide-in-from-right duration-300">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-6 h-6 text-blue-400"/>
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
                                 {isSubmittingFeedback ? <Activity className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
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
                                    <div className="mt-1 bg-blue-500/20 p-1.5 rounded text-blue-300"><Sun className="w-4 h-4"/></div>
                                    <div>
                                        <h4 className="font-bold text-white">Solar Piped Systems</h4>
                                        <p className="text-sm text-slate-400">Design networks, size pumps & panels, and estimate hydraulic profiles.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-emerald-500/20 p-1.5 rounded text-emerald-300"><TrendingUp className="w-4 h-4"/></div>
                                    <div>
                                        <h4 className="font-bold text-white">Economic Analysis</h4>
                                        <p className="text-sm text-slate-400">Compare Net Present Value (NPV) against traditional Handpumps.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-purple-500/20 p-1.5 rounded text-purple-300"><Settings className="w-4 h-4"/></div>
                                    <div>
                                        <h4 className="font-bold text-white">Full Customization</h4>
                                        <p className="text-sm text-slate-400">Adjust tariffs, subsidies, population growth, and carbon credits.</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <div className="mt-1 bg-orange-500/20 p-1.5 rounded text-orange-300"><FileText className="w-4 h-4"/></div>
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
                                Start Analysis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
                            </button>
                            <button 
                                onClick={() => setShowFeedback(true)}
                                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-all border border-slate-600 flex items-center justify-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4"/> Leave Feedback
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg"><Droplets className="w-6 h-6 text-white" /></div>
              <div><h1 className="text-xl font-bold tracking-tight">Malawi Water Supply Comparison</h1><p className="text-xs text-slate-400">Site Specific Economic Feasibility Tool</p></div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('map')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'map' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><MapIcon className="w-4 h-4" /> Design Map</button>
                <button onClick={() => setActiveTab('schematic')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'schematic' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><ClipboardList className="w-4 h-4" /> Schematic & BoQ</button>
                <button onClick={() => setActiveTab('analysis')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'analysis' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><TrendingUp className="w-4 h-4" /> Economic Analysis</button>
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}><Database className="w-4 h-4" /> Dashboard</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* MAP TAB */}
        <div className={activeTab === 'map' ? 'block' : 'hidden'}>
             <div className="mb-6 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-gray-800 text-lg">System Design Instructions</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm text-gray-600">
                    <div className="bg-blue-50 p-3 rounded border border-blue-100">
                        <div className="flex items-center gap-2 font-bold text-blue-800 mb-1"><Search className="w-4 h-4"/> 1. Search Location</div>
                        <p className="text-xs">Use the search bar on the left panel to find a Village. Drag the map to refine.</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-100">
                         <div className="flex items-center gap-2 font-bold text-blue-800 mb-1"><Layers className="w-4 h-4"/> 2. Choose View</div>
                         <p className="text-xs">Switch to <strong>Satellite</strong> for buildings or <strong>Topography</strong> for hydraulic planning.</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-100">
                        <div className="flex items-center gap-2 font-bold text-blue-800 mb-1"><Settings className="w-4 h-4"/> 3. Adjust Inputs</div>
                        <p className="text-xs">Update <strong>Borehole Depth</strong> and <strong>Static Water Level</strong> before starting.</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded border border-blue-100">
                        <div className="flex items-center gap-2 font-bold text-blue-800 mb-1"><MapIcon className="w-4 h-4"/> 4. Design Network</div>
                        <p className="text-xs">Place <strong>Borehole</strong> & <strong>Tank</strong>. Connect with <strong>Pipes</strong>. Add <strong>Taps</strong> near homes.</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded border border-emerald-100 ring-2 ring-emerald-500/20">
                        <div className="flex items-center gap-2 font-bold text-emerald-800 mb-1"><CheckCircle className="w-4 h-4"/> 5. Final Step</div>
                        <p className="text-xs font-medium">Click <strong>Apply Design</strong> in the sidebar to generate costs and schematics.</p>
                    </div>
                </div>
             </div>
             <SiteMap key={mapResetKey} population={global.population} setPopulation={(p) => setGlobal(prev => ({...prev, population: p}))} projectDetails={projectDetails} setProjectDetails={setProjectDetails} inputs={hydraulicInputs} setInputs={setHydraulicInputs} onUpdateCalc={handleUpdateCalc} onApplyDesign={handleApplyDesign} />
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
            />
        </div>

        {/* DASHBOARD TAB */}
        <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
            <Dashboard />
        </div>

        {/* ANALYSIS TAB (CONTAINING PDF REPORT CONTENT) */}
        <div className={activeTab === 'analysis' ? 'block' : 'hidden'}>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Inputs Sidebar (Hidden in PDF) */}
                <div className="space-y-6" data-html2canvas-ignore="true">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800"><SettingsIcon className="w-5 h-5"/><h2 className="font-bold">Global Parameters</h2></div>
                        <CostInput label="Discount Rate" value={global.discountRate} onChange={(v) => setGlobal({...global, discountRate: v})} unit="%" />
                        <CostInput label="Project Lifespan" value={global.projectLifespan} onChange={(v) => setGlobal({...global, projectLifespan: v})} unit="years" />
                        <CostInput label="Pop. Growth Rate" value={global.populationGrowthRate} onChange={(v) => setGlobal({...global, populationGrowthRate: v})} unit="%" step={0.1}/>
                        <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="font-bold text-gray-500">Design Population (Yr {global.projectLifespan}):</span>
                          <div className="text-lg font-bold text-gray-800">{finalDesignPopulation.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800"><Timer className="w-5 h-5"/><h2 className="font-bold">Time & Health Inputs</h2></div>
                         <CostInput label="Hourly Wage (Opp. Cost)" value={benefits.hourlyWage} onChange={(v) => setBenefits({...benefits, hourlyWage: v})} unit="$/hr" step={0.05}/>
                         <div className="border-t pt-2 mt-2">
                             <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Collection Time (Round Trip)</h3>
                             <CostInput label="Status Quo (River/Well)" value={benefits.timeSpentBaseline} onChange={(v) => setBenefits({...benefits, timeSpentBaseline: v})} unit="min/day" helpText="Baseline 'No Water' Scenario"/>
                             <CostInput label="Handpump (Walk+Queue)" value={benefits.timeSpentHandpump} onChange={(v) => setBenefits({...benefits, timeSpentHandpump: v})} unit="min/day"/>
                             <CostInput label="Solar Piped (At Tap)" value={benefits.timeSpentSolar} onChange={(v) => setBenefits({...benefits, timeSpentSolar: v})} unit="min/day"/>
                         </div>
                         <div className="border-t pt-2 mt-2"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Health Value (Monetized)</h3><CostInput label="Solar Health Premium" value={benefits.healthPremiumSolar} onChange={(v) => setBenefits({...benefits, healthPremiumSolar: v})} unit="$/pp/yr"/><CostInput label="Handpump Health Value" value={benefits.healthPremiumHandpump} onChange={(v) => setBenefits({...benefits, healthPremiumHandpump: v})} unit="$/pp/yr"/></div>
                    </div>

                    {/* Additional Benefits Values (Driven by Map) */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                         <div className="flex items-center gap-2 mb-4 text-purple-900"><Heart className="w-5 h-5"/><h2 className="font-bold">Community Value-Add</h2></div>
                         <div className="mb-3 text-xs text-purple-800 bg-purple-50 p-2 rounded">
                             Add Schools, Clinics, Gardens, or Grids in the <strong>Design Map</strong> to enable these benefits.
                         </div>
                         <div className="space-y-3">
                            {systemSpecs && systemSpecs.countSchools > 0 && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Schools ({systemSpecs.countSchools})</span></div><CostInput label="Value per School/Yr" value={additionalBenefits.valueSchool} onChange={(v)=>setAdditionalBenefits({...additionalBenefits, valueSchool: v})} unit="$" /></div>}
                            {systemSpecs && systemSpecs.countClinics > 0 && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Clinics ({systemSpecs.countClinics})</span></div><CostInput label="Value per Clinic/Yr" value={additionalBenefits.valueClinic} onChange={(v)=>setAdditionalBenefits({...additionalBenefits, valueClinic: v})} unit="$" /></div>}
                            {systemSpecs && systemSpecs.countGardens > 0 && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Gardens ({systemSpecs.countGardens})</span></div><CostInput label="Value per Garden/Yr" value={additionalBenefits.valueGarden} onChange={(v)=>setAdditionalBenefits({...additionalBenefits, valueGarden: v})} unit="$" /></div>}
                            {systemSpecs && systemSpecs.hasGrid && <div className="pl-2 border-l-2 border-purple-200"><div className="flex justify-between text-sm font-medium mb-1"><span>Energy Access</span></div><CostInput label="Value of Energy/Yr" value={additionalBenefits.valueEnergy} onChange={(v)=>setAdditionalBenefits({...additionalBenefits, valueEnergy: v})} unit="$" /></div>}
                            {(!systemSpecs || (systemSpecs.countSchools === 0 && systemSpecs.countClinics === 0 && systemSpecs.countGardens === 0 && !systemSpecs.hasGrid)) && <div className="text-sm text-gray-400 italic text-center py-2">No institutions added on map.</div>}
                        </div>
                    </div>

                     {/* Financial Params */}
                     <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800"><DollarSign className="w-5 h-5"/><h2 className="font-bold">Financial Assumptions</h2></div>
                        <div className="space-y-4">
                             <div><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Solar Piped</h3><CostInput label="OpEx (Annual)" value={solar.opexAnnual} onChange={(v) => setSolar({...solar, opexAnnual: v})} unit="$" /><CostInput label="Replacements (Inv/Pump)" value={solar.replacementCost} onChange={(v) => setSolar({...solar, replacementCost: v})} unit="$" /><CostInput label="Theft Probability" value={solar.theftProbability} onChange={(v) => setSolar({...solar, theftProbability: v})} unit="%" /></div>
                             <div className="border-t pt-2"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Handpumps</h3><CostInput label="CapEx (Per Unit)" value={handpump.capexPerUnit} onChange={(v) => setHandpump({...handpump, capexPerUnit: v})} unit="$" /><CostInput label="OpEx (Per Unit/Yr)" value={handpump.opexAnnualPerUnit} onChange={(v) => setHandpump({...handpump, opexAnnualPerUnit: v})} unit="$" /></div>
                        </div>
                    </div>

                    {/* Revenue & Subsidies */}
                     <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-800"><Coins className="w-5 h-5"/><h2 className="font-bold">Revenue & Subsidies</h2></div>
                        <div className="mb-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Solar Piped</h3>
                            <CostInput label="Tariff (Per HH/Mo)" value={revenue.tariffSolarPerMonth} onChange={(v) => setRevenue({...revenue, tariffSolarPerMonth: v})} unit="$" step={0.1} />
                            <CostInput label="Collection Efficiency" value={revenue.collectionEfficiencySolar} onChange={(v) => setRevenue({...revenue, collectionEfficiencySolar: v})} unit="%" />
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-blue-600 uppercase mb-2">External Support</h4>
                                <CostInput label="Carbon Credit Price" value={revenue.carbonCreditPricePerM3} onChange={(v) => setRevenue({...revenue, carbonCreditPricePerM3: v})} unit="$/m³" step={0.01} />
                                <CostInput label="Govt Subsidy (Top-up)" value={revenue.govtSubsidyFraction} onChange={(v) => setRevenue({...revenue, govtSubsidyFraction: v})} unit="% of Tariff" />
                            </div>
                        </div>
                        <div className="border-t pt-2">
                             <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Handpumps</h3>
                             <CostInput label="Tariff (Per HH/Mo)" value={revenue.tariffHandpumpPerMonth || 0} onChange={(v) => setRevenue({...revenue, tariffHandpumpPerMonth: v})} unit="$" step={0.1} />
                             <CostInput label="Collection Efficiency" value={revenue.collectionEfficiencyHandpump} onChange={(v) => setRevenue({...revenue, collectionEfficiencyHandpump: v})} unit="%" />
                        </div>
                    </div>
                </div>

                {/* Results (Included in PDF) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div><h2 className="font-bold text-gray-900">Economic Analysis</h2><p className="text-sm text-gray-500">20-Year Lifecycle Cost Comparison</p></div>
                        <div className="flex gap-2">
                            <div className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600 flex items-center">Handpumps Needed: <strong className="ml-1 text-gray-900">{handpumpsNeeded}</strong></div>
                            <button onClick={() => generatePDF('report-content', `Feasibility_Report_${projectDetails.siteName || 'Site'}.pdf`)} disabled={isDownloadingPdf} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition shadow-sm disabled:opacity-75">
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
                                    <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Activity className="w-5 h-5"/> Sensitivity Analysis</h3>
                                    <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold" data-html2canvas-ignore="true">
                                        <button onClick={() => setSimMetric('economic')} className={`px-3 py-1 rounded ${simMetric === 'economic' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Economic</button>
                                        <button onClick={() => setSimMetric('financial')} className={`px-3 py-1 rounded ${simMetric === 'financial' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}>Financial</button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-4">Running 10,000 scenarios varying costs and benefits by ±20%. This simulates real-world uncertainty to determine the probability of the Solar System providing better value.</p>
                                <button onClick={runSimulation} disabled={isSimulating} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow transition flex justify-center items-center gap-2" data-html2canvas-ignore="true">{isSimulating ? <RotateCcw className="w-4 h-4 animate-spin"/> : <Zap className="w-4 h-4"/>}{isSimulating ? 'Simulating...' : 'Run Simulation'}</button>
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

                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

const SettingsIcon = ({className}: {className?: string}) => (<svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);

export default App;
