import { GlobalParams, HandpumpParams, SolarSystemParams, FinancialResult, ComparisonSummary, BenefitsParams, AdditionalBenefitsParams, RevenueParams, SystemSpecs, SimulationResult, MonteCarloStat } from '../types';

export const calculateNPV = (
    global: GlobalParams,
    solar: SolarSystemParams,
    handpump: HandpumpParams,
    revenue: RevenueParams,
    benefits: BenefitsParams,
    additionalBenefits: AdditionalBenefitsParams,
    layout: string,
    systemSpecs: SystemSpecs | null
): { yearlyData: FinancialResult[], summary: ComparisonSummary } => {
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
            if (systemSpecs.hasGrid) solarAddValue += additionalBenefits.valueEnergy;
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

    const calcNPVHelper = (val: number, yrs: number) => {
        let npv = 0;
        for (let y = 1; y <= yrs; y++) npv += val / Math.pow(1 + global.discountRate / 100, y);
        return npv;
    };

    // Calculate Total Carbon and Subsidy NPV for summary
    const totalCarbonNPV = calcNPVHelper(annualVolumeM3 * revenue.carbonCreditPricePerM3, global.projectLifespan);

    // Approximate average tariff revenue for subsidy calc (simplified)
    const avgPop = global.population * Math.pow(1 + global.populationGrowthRate / 100, global.projectLifespan / 2);
    const avgTariffRev = (avgPop / revenue.householdSize) * revenue.tariffSolarPerMonth * 12 * (revenue.collectionEfficiencySolar / 100);
    const totalSubsidyNPV = calcNPVHelper(avgTariffRev * (revenue.govtSubsidyFraction / 100), global.projectLifespan);

    const summary: ComparisonSummary = {
        layout: layout as any, // Type assertion needed if layout string doesn't perfectly match union type
        capexSolar: solarCapex,
        capexHandpump: handpumpCapex,
        opexSolarNPV: calcNPVHelper(solar.opexAnnual, global.projectLifespan),
        opexHandpumpNPV: calcNPVHelper(handpumpsNeeded * handpump.opexAnnualPerUnit, global.projectLifespan),
        revenueSolarNPV: calcNPVHelper(avgTariffRev + (annualVolumeM3 * revenue.carbonCreditPricePerM3) + (avgTariffRev * revenue.govtSubsidyFraction / 100), global.projectLifespan),
        revenueHandpumpNPV: calcNPVHelper((global.population / revenue.householdSize) * (revenue.tariffHandpumpPerMonth || 0) * 12 * (revenue.collectionEfficiencyHandpump / 100), global.projectLifespan),
        totalSolarFinNPV: results[results.length - 1].solarCumulativeCashflow,
        totalHandpumpFinNPV: results[results.length - 1].handpumpCumulativeCashflow,

        theftRiskNPV: calcNPVHelper(solarCapex * (solar.theftProbability / 100), global.projectLifespan),

        timeSavedSolarNPV: calcNPVHelper((global.population * (benefits.timeSpentBaseline - benefits.timeSpentSolar) / 60 * 365 * benefits.hourlyWage * 0.5), global.projectLifespan),
        timeSavedHandpumpNPV: calcNPVHelper((global.population * (benefits.timeSpentBaseline - benefits.timeSpentHandpump) / 60 * 365 * benefits.hourlyWage * 0.5), global.projectLifespan),

        healthBenefitSolarNPV: calcNPVHelper(global.population * benefits.healthPremiumSolar, global.projectLifespan),
        healthBenefitHandpumpNPV: calcNPVHelper(global.population * benefits.healthPremiumHandpump, global.projectLifespan),

        valueSchoolNPV: systemSpecs ? calcNPVHelper(systemSpecs.countSchools * additionalBenefits.valueSchool, global.projectLifespan) : 0,
        valueClinicNPV: systemSpecs ? calcNPVHelper(systemSpecs.countClinics * additionalBenefits.valueClinic, global.projectLifespan) : 0,
        valueGardenNPV: systemSpecs ? calcNPVHelper(systemSpecs.countGardens * additionalBenefits.valueGarden, global.projectLifespan) : 0,
        valueEnergyNPV: systemSpecs && systemSpecs.hasGrid ? calcNPVHelper(additionalBenefits.valueEnergy, global.projectLifespan) : 0,
        valueCarbonNPV: totalCarbonNPV + totalSubsidyNPV, // Combining external financial inflows here for the chart breakdown

        netEconomicValueSolar: results[results.length - 1].solarNetValue,
        netEconomicValueHandpump: results[results.length - 1].handpumpNetValue
    };

    return { yearlyData: results, summary };
};

export const runMonteCarloSimulation = (
    summary: ComparisonSummary,
    simMetric: 'economic' | 'financial'
): SimulationResult => {
    const iterations = 10000;
    const diffs: number[] = [];
    let sWins = 0;

    for (let i = 0; i < iterations; i++) {
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

    diffs.sort((a, b) => a - b);
    const bins = 40;
    const min = diffs[0];
    const max = diffs[diffs.length - 1];
    const range = max - min;
    const binSize = range / bins;

    const dist: MonteCarloStat[] = [];
    for (let b = 0; b < bins; b++) {
        const start = min + b * binSize;
        const end = start + binSize;
        const count = diffs.filter(d => d >= start && d < end).length;
        dist.push({ binStart: start, binEnd: end, count, label: `${(start / 1000).toFixed(0)}k` });
    }
    return { solarWins: sWins, handpumpWins: iterations - sWins, solarWinRate: (sWins / iterations) * 100, distribution: dist };
};
