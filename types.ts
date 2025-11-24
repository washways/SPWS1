

export interface GlobalParams {
  population: number;
  populationGrowthRate: number; // New: Annual % growth
  projectLifespan: number;
  discountRate: number;
  currency: string;
}

export interface ProjectDetails {
  siteName: string;
  contractNumber: string;
}

export type VillageLayout = 'compact' | 'linear' | 'scattered';

// New Engineering Types
export interface HydraulicInputs {
  boreholeDepth: number; // meters
  staticWaterLevel: number; // meters
  elevationDifference: number; // meters (Borehole to Tank base)
  tankHeight: number; // meters (Stand height)
  pipeLength: number; // meters (from map)
  dailyDemandPerCapita: number; // Liters/person/day
  peakSunHours: number; // hrs/day
  pumpEfficiency: number; // 0.1 - 1.0
  frictionLossFactor: number; // % (e.g. 0.08 for 10%)
  // Real Data
  boreholeElevation?: number;
  tankElevation?: number;
}

export interface PipelineProfile {
    id: string;
    name: string;
    data: { 
        dist: number; 
        elevation: number; 
        hgl: number; 
        pressure: number; 
        label?: string;
        risk?: 'high_pressure' | 'negative_pressure' | null;
    }[];
}

export interface MapItem {
    lat: number;
    lng: number;
    id: string;
    label: string;
    type?: 'school' | 'clinic' | 'garden' | 'grid';
}

export interface SystemGeometry {
    center: { lat: number, lng: number };
    zoom: number;
    borehole: { lat: number, lng: number } | null;
    tank: { lat: number, lng: number } | null;
    taps: MapItem[];
    institutions: MapItem[]; // New: Schools, Clinics, etc.
    lines: { path: { lat: number, lng: number }[], type: 'rising' | 'main' | 'dist', label: string }[];
}

export interface SystemSpecs {
  dailyDemandM3: number;
  domesticDemandM3: number; // New
  institutionalDemandM3: number; // New
  totalDynamicHead: number;
  flowRateM3H: number;
  pumpPowerKW: number;
  pvArrayKW: number;
  pipeDiameterMM: number;
  // Institutional Counts
  countSchools: number;
  countClinics: number;
  countGardens: number;
  hasGrid: boolean;
}

export interface BoQItem {
  id: string;
  category: 'Civils' | 'Network' | 'Mechanical' | 'Electrical' | 'Other';
  item: string;
  unit: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface SolarSystemParams {
  capexDrillingAndCivil: number; // Borehole, tank base, trenching
  capexEquip: number; // Pump, panels, inverter, piping
  opexAnnual: number; // Operator salary, chlorine, minor repairs
  replacementCost: number; // Inverter/Pump replacement
  replacementInterval: number; // Years
  theftProbability: number; // Annual % chance of major theft
}

export interface HandpumpParams {
  usersPerPump: number; // Norm is often 250 in Malawi
  capexPerUnit: number; // Drilling + Afridev pump
  opexAnnualPerUnit: number; // Fast moving spares, area mechanic
  rehabCostPerUnit: number; // Major rehab (rods, pipes)
  rehabInterval: number; // Years
}

export interface RevenueParams {
  tariffSolarPerMonth: number; // Monthly fee in USD for Solar
  tariffHandpumpPerMonth: number; // Monthly fee in USD for Handpumps
  collectionEfficiencySolar: number; // %
  collectionEfficiencyHandpump: number; // %
  householdSize: number; // Avg people per HH (usually 5)
  // Subsidies (Updated)
  carbonCreditPricePerM3: number; // $/m3 (Volumetric)
  govtSubsidyFraction: number; // % of tariff collected (Proportional)
}

export interface BenefitsParams {
  hourlyWage: number; // Value of time in USD/hr
  timeSpentBaseline: number; // Minutes per person per day (Status Quo / No Water)
  timeSpentHandpump: number; // Minutes per person per day (walking + queuing)
  timeSpentSolar: number; // Minutes per person per day (taps usually closer)
  healthPremiumSolar: number; // Added economic value of safe piped water ($/person/year)
  healthPremiumHandpump: number; // Added economic value of safe point source ($/person/year)
}

export interface AdditionalBenefitsParams {
  // Counts are now derived from Map, values remain here
  valueSchool: number; // Annual value ($) per school
  valueClinic: number; // Annual value ($) per clinic
  valueGarden: number; // Annual value ($) per garden
  valueEnergy: number; // Annual value ($) if grid present
}

export interface FinancialResult {
  year: number;
  // Financial
  solarCost: number;
  solarRevenue: number;
  solarCumulativeCashflow: number; // Costs - Revenue
  handpumpCost: number;
  handpumpRevenue: number;
  handpumpCumulativeCashflow: number; 
  // Economic
  solarNetValue: number; 
  handpumpNetValue: number;
}

export interface ComparisonSummary {
  layout: VillageLayout;
  // Financial Only
  capexSolar: number;
  capexHandpump: number;
  opexSolarNPV: number;
  opexHandpumpNPV: number;
  revenueSolarNPV: number;
  revenueHandpumpNPV: number;
  totalSolarFinNPV: number; // Net Financial Cost (Costs - Revenue)
  totalHandpumpFinNPV: number;
  
  // Economic Breakdown
  theftRiskNPV: number;
  timeSavedSolarNPV: number; // Absolute value of time saved vs baseline
  timeSavedHandpumpNPV: number; // Absolute value of time saved vs baseline
  healthBenefitSolarNPV: number;
  healthBenefitHandpumpNPV: number; 
  
  // Detailed Additional Breakdown
  valueSchoolNPV: number;
  valueClinicNPV: number;
  valueGardenNPV: number;
  valueEnergyNPV: number;
  valueCarbonNPV: number; // Included in economic benefit

  // Net Totals (Net Economic Value)
  netEconomicValueSolar: number; 
  netEconomicValueHandpump: number; 
}

export interface MonteCarloStat {
  binStart: number;
  binEnd: number;
  count: number;
  label: string;
}

export interface SimulationResult {
  solarWins: number;
  handpumpWins: number;
  solarWinRate: number;
  distribution: MonteCarloStat[];
}

// --- ANALYTICS & DASHBOARD TYPES ---

export interface ReportLog {
  id: string; // generated on frontend for key
  timestamp: string; // ISO Date
  timeSpentSeconds: number; // Duration user was on app before generating
  
  // User/Site Info
  siteName: string;
  contractNumber: string;
  location?: { lat: number, lng: number };
  
  // Technical Stats
  population: number;
  designPopulation: number;
  systemType: 'Solar Piped' | 'Handpumps' | 'Mixed'; 
  
  // Economic Stats
  solarCapex: number;
  handpumpCapex: number;
  solarNetValue: number;
  handpumpNetValue: number;
  winner: 'Solar' | 'Handpump';
}

export interface DashboardStats {
  totalReports: number;
  totalPopulationServed: number;
  totalCapexEstimated: number;
  avgTimeSpentSeconds: number;
  solarWinRate: number; // %
  recentLogs: ReportLog[];
}