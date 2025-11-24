import { GlobalParams, HandpumpParams, SolarSystemParams, ComparisonSummary, AdditionalBenefitsParams } from "../types";

export const getAiAnalysis = async (
  globalParams: GlobalParams,
  solar: SolarSystemParams,
  handpump: HandpumpParams,
  additionalBenefits: AdditionalBenefitsParams,
  results: ComparisonSummary
): Promise<string> => {
  
  // Deterministic Analysis Generator (Replaces AI Dependency)
  
  const solarWins = results.netEconomicValueSolar > results.netEconomicValueHandpump;
  const netGain = Math.abs(results.netEconomicValueSolar - results.netEconomicValueHandpump);
  const winSystem = solarWins ? "Solar Piped System" : "Handpump System";
  const loseSystem = solarWins ? "Handpumps" : "Solar Piped System";

  const solarHealth = results.healthBenefitSolarNPV;
  const hpHealth = results.healthBenefitHandpumpNPV;
  const solarTime = results.timeSavedSolarNPV;
  const hpTime = results.timeSavedHandpumpNPV;

  // Determine Drivers
  const drivers: string[] = [];
  
  // 1. Health
  if (Math.abs(solarHealth - hpHealth) > 1000) {
      const healthWinner = solarHealth > hpHealth ? "Solar" : "Handpumps";
      drivers.push(`**Health Impact**: ${healthWinner} provides significantly better health outcomes (Value: $${Math.max(solarHealth, hpHealth).toLocaleString()}).`);
  }

  // 2. Time
  if (Math.abs(solarTime - hpTime) > 1000) {
      const timeWinner = solarTime > hpTime ? "Solar" : "Handpumps";
      drivers.push(`**Time Savings**: ${timeWinner} offers superior time savings for the community (Value: $${Math.max(solarTime, hpTime).toLocaleString()}).`);
  }

  // 3. Opex
  const solarOpex = results.opexSolarNPV;
  const hpOpex = results.opexHandpumpNPV;
  const opexWinner = solarOpex < hpOpex ? "Solar" : "Handpumps";
  drivers.push(`**Operational Cost**: ${opexWinner} has a lower 20-year operational cost burden.`);

  // 4. CapEx (Fallback if list is short)
  if (drivers.length < 3) {
      const capexDiff = results.capexSolar - results.capexHandpump;
      if (capexDiff > 0) {
        drivers.push(`**Capital Investment**: Solar requires $${capexDiff.toLocaleString()} more upfront but delivers higher value.`);
      } else {
        drivers.push(`**Capital Efficiency**: Solar is cheaper to build by $${Math.abs(capexDiff).toLocaleString()}.`);
      }
  }

  const analysis = `
### Recommendation
The **${winSystem}** is the recommended solution, providing a Net Economic Value advantage of **$${netGain.toLocaleString()}** over ${loseSystem}.

### Key Drivers
- ${drivers[0] || "Economic efficiency."}
- ${drivers[1] || "Improved service levels."}
- ${drivers[2] || "Long-term sustainability."}

### Risk Assessment
- **Solar Risks**: Theft of panels and pump (Risk Value: $${results.theftRiskNPV.toLocaleString()}). Requires skilled maintenance.
- **Handpump Risks**: Frequent minor breakdowns, long collection times, and groundwater contamination potential.
  `;

  return analysis;
};