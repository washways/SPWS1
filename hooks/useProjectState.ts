import { useState, useMemo, useEffect, useCallback } from 'react';
import { DEFAULT_GLOBAL, DEFAULT_HANDPUMP, DEFAULT_SOLAR, DEFAULT_BENEFITS, DEFAULT_ADDITIONAL_BENEFITS, DEFAULT_REVENUE } from '../constants';
import { GlobalParams, HandpumpParams, SolarSystemParams, BenefitsParams, VillageLayout, SimulationResult, AdditionalBenefitsParams, RevenueParams, HydraulicInputs, SystemSpecs, BoQItem, PipelineProfile, SystemGeometry, ProjectDetails } from '../types';
import { AnalyticsService } from '../services/analyticsService';
import { calculateNPV, runMonteCarloSimulation } from '../utils/calculations';

export const useProjectState = () => {
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
        if (autoScaleSolar) { setSolar(prev => ({ ...prev, capexDrillingAndCivil: civils, capexEquip: equip })); }
    };

    const handleFeedbackSubmit = async () => {
        if (!feedbackText.trim()) return;
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

    const { yearlyData, summary } = useMemo(() => calculateNPV(
        global, solar, handpump, revenue, benefits, additionalBenefits, layout, systemSpecs
    ), [global, solar, handpump, revenue, benefits, additionalBenefits, layout, systemSpecs]);

    const handpumpsNeeded = Math.ceil(global.population / handpump.usersPerPump);

    const runSimulation = () => {
        setIsSimulating(true);
        setTimeout(() => {
            const result = runMonteCarloSimulation(summary, simMetric);
            setSimulationResult(result);
            setIsSimulating(false);
        }, 100);
    };

    return {
        activeTab, setActiveTab,
        mapResetKey, setMapResetKey,
        showSplash, setShowSplash,
        showFeedback, setShowFeedback,
        feedbackText, setFeedbackText,
        isSubmittingFeedback, setIsSubmittingFeedback,
        projectDetails, setProjectDetails,
        global, setGlobal,
        solar, setSolar,
        handpump, setHandpump,
        revenue, setRevenue,
        benefits, setBenefits,
        additionalBenefits, setAdditionalBenefits,
        layout, setLayout,
        autoScaleSolar, setAutoScaleSolar,
        designApplied, setDesignApplied,
        hydraulicInputs, setHydraulicInputs,
        systemSpecs, setSystemSpecs,
        generatedBoQ, setGeneratedBoQ,
        pipelineProfiles, setPipelineProfiles,
        systemGeometry, setSystemGeometry,
        simMetric, setSimMetric,
        simulationResult, setSimulationResult,
        isSimulating, setIsSimulating,
        isDownloadingPdf, setIsDownloadingPdf,
        handleApplyDesign,
        handleUpdateCalc,
        updateBoQRate,
        handleFeedbackSubmit,
        finalDesignPopulation,
        yearlyData,
        summary,
        handpumpsNeeded,
        runSimulation
    };
};
