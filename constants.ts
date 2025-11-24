
import { AdditionalBenefitsParams, BenefitsParams, GlobalParams, HandpumpParams, RevenueParams, SolarSystemParams } from "./types";

// Defaults based on typical rural water supply projects in Malawi (Values in USD for stability)
export const DEFAULT_GLOBAL: GlobalParams = {
  population: 2000,
  populationGrowthRate: 2.5, // Typical rural growth rate
  projectLifespan: 20,
  discountRate: 10, // High discount rate typical for developing economies
  currency: "USD",
};

export const INSTITUTIONAL_DEMAND = {
    SCHOOL: 2500, // Liters per day (approx 5L/student * 500)
    CLINIC: 1000, // Liters per day
    GARDEN: 2000, // Liters per day (Irrigation)
};

// ENGINEERING COST DATABASE (For BoQ Generation)
export const DESIGN_COSTS = {
    DRILLING_BASE: 2500, // Mob/Demob + Siting
    DRILLING_PER_M: 60,  // Cost per meter drilled
    
    PIPE_HDPE_63MM: 6,   // $/m for pipe material (Main lines)
    PIPE_HDPE_32MM: 3,   // $/m for pipe material (Distribution lines)
    TRENCHING_PER_M: 2.5, // $/m for manual excavation & backfill
    
    TANK_STEEL_BASE: 2000, // 5000L Base cost
    TANK_PER_M3: 300,      // Cost per extra m3 volume
    TANK_STAND_6M: 3500,   // Concrete/Steel stand 6m
    
    PUMP_BASE: 1200,      // Controller + Cabling + Sensors
    PUMP_PER_KW: 800,     // Scaling for pump size
    
    PV_STRUCTURE_BASE: 500, 
    PV_PER_KW: 600,       // Panels + Rack + Install
    
    FENCE_CIVILS: 1500,   // Security fence + tap stands bases
    DISTRIBUTION_POINTS: 600, // Cost per tap stand (kiosk)
    
    // Connectors
    INSTITUTION_CONNECTION: 300 // Extra fittings/meter for school/clinic
};

// High Level Estimators (Fallback)
export const SOLAR_COST_FACTORS = {
    BOREHOLE_FIXED: 7000,      
    TANK_BASE: 3000,           
    TANK_COST_PER_PERSON: 8,   
    
    EQUIP_BASE: 3000,          
    EQUIP_COST_PER_PERSON: 11, 
    
    NETWORK_BASE: 1000,        
    NETWORK_COST_PER_PERSON: { 
        compact: 12,    
        linear: 20,     
        scattered: 35   
    }
};

export const DEFAULT_SOLAR: SolarSystemParams = {
  // These defaults will be overridden by the Auto-Scaler on load
  capexDrillingAndCivil: 51000, 
  capexEquip: 25000, 
  opexAnnual: 1500, // Guard/Operator salary ($50-70/mo) + minor maintenance + chlorination
  replacementCost: 4000, // Pump/Inverter replacement (Larger units)
  replacementInterval: 7, // Typical life of submersible pump/inverter
  theftProbability: 5, // 5% annual chance of major theft
};

export const DEFAULT_HANDPUMP: HandpumpParams = {
  usersPerPump: 250, // Gov of Malawi standard
  capexPerUnit: 6500, // Deep borehole + Afridev Pump + Platform
  opexAnnualPerUnit: 150, // Spares + Committee costs
  rehabCostPerUnit: 800, // Major rehab (rods, pipes)
  rehabInterval: 5,
};

export const DEFAULT_REVENUE: RevenueParams = {
  tariffSolarPerMonth: 0.50, // ~$0.50/month (approx 500 MWK) is typical for CBM/Kiosks
  tariffHandpumpPerMonth: 0, // Usually 0 or very small committee fee
  collectionEfficiencySolar: 85, // Solar kiosks often have better collection
  collectionEfficiencyHandpump: 40, // Handpump committees often struggle
  householdSize: 5,
  carbonCreditPricePerM3: 0.10, // $/m3 Volumetric (approx $0.10/m3)
  govtSubsidyFraction: 10 // % of tariff collected (e.g. 10% matching grant)
};

export const DEFAULT_BENEFITS: BenefitsParams = {
  hourlyWage: 0.10, // Approx MWK 175-200/hr. Very conservative rural opportunity cost.
  timeSpentBaseline: 120, // Minutes per person per day (Status Quo: distant river/scoop well)
  timeSpentHandpump: 60, // Minutes/person/day (Walking + Queuing at peak times)
  timeSpentSolar: 15, // Minutes/person/day (Taps usually located <200m)
  healthPremiumSolar: 2.50, // $/person/year. Increased slightly to reflect better hygiene impact.
  healthPremiumHandpump: 1.50, // $/person/year. Baseline safe water value, lower than piped due to transport contamination risk.
};

export const DEFAULT_ADDITIONAL_BENEFITS: AdditionalBenefitsParams = {
  // Values increased to reflect true institutional value (attendance, teacher retention, patient safety)
  valueSchool: 2500, // Annual value: ~$5/student/yr for 500 students
  valueClinic: 3500, // Annual value: Critical infection control & staff retention
  valueGarden: 1000,  // Annual value: Nutrition & sales for 10-20 households or communal plot
  valueEnergy: 500,  // Annual value: Phone charging revenues / lighting savings
};
