

import React from 'react';
import { GlobalParams, SolarSystemParams, HandpumpParams, BenefitsParams, RevenueParams, AdditionalBenefitsParams } from '../types';

interface ReportAssumptionsProps {
  global: GlobalParams;
  solar: SolarSystemParams;
  handpump: HandpumpParams;
  benefits: BenefitsParams;
  revenue: RevenueParams;
  additional: AdditionalBenefitsParams;
}

export const ReportAssumptions: React.FC<ReportAssumptionsProps> = ({ global, solar, handpump, benefits, revenue, additional }) => {
  const finalDesignPopulation = Math.round(global.population * Math.pow(1 + global.populationGrowthRate / 100, global.projectLifespan));

  return (
    <div className="space-y-6 font-sans text-sm">
      <div className="border-b pb-2 mb-4">
        <h3 className="text-xl font-bold text-gray-900">Appendix: Model Assumptions & Parameters</h3>
        <p className="text-gray-500">Full list of input variables used in this feasibility analysis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* GLOBAL & FINANCIAL */}
        <div>
          <h4 className="font-bold text-gray-800 bg-gray-100 p-2 rounded mb-2">Global Parameters</h4>
          <table className="w-full text-left">
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Population (Initial)</td><td className="py-1 font-medium">{global.population.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Growth Rate</td><td className="py-1 font-medium">{global.populationGrowthRate}%</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Project Lifespan</td><td className="py-1 font-medium">{global.projectLifespan} Years</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Final Design Population</td><td className="py-1 font-medium text-blue-600 font-bold">{finalDesignPopulation.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Discount Rate</td><td className="py-1 font-medium">{global.discountRate}%</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Hourly Wage (Opp. Cost)</td><td className="py-1 font-medium">${benefits.hourlyWage.toFixed(2)}/hr</td></tr>
            </tbody>
          </table>
        </div>

        {/* REVENUE */}
        <div>
          <h4 className="font-bold text-gray-800 bg-gray-100 p-2 rounded mb-2">Revenue & Subsidies</h4>
          <table className="w-full text-left">
             <thead>
                <tr className="text-xs text-gray-500 uppercase"><th className="font-normal">Parameter</th><th className="font-normal">Solar</th><th className="font-normal">Handpump</th></tr>
             </thead>
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Tariff (per HH/mo)</td><td className="py-1 font-medium">${revenue.tariffSolarPerMonth.toFixed(2)}</td><td className="py-1 font-medium">${(revenue.tariffHandpumpPerMonth||0).toFixed(2)}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Collection Efficiency</td><td className="py-1 font-medium">{revenue.collectionEfficiencySolar}%</td><td className="py-1 font-medium">{revenue.collectionEfficiencyHandpump}%</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Carbon Price</td><td className="py-1 font-medium">${revenue.carbonCreditPricePerM3.toFixed(3)}/m³</td><td className="py-1 font-medium">-</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Govt Subsidy</td><td className="py-1 font-medium">{revenue.govtSubsidyFraction}% of Tariff</td><td className="py-1 font-medium">-</td></tr>
            </tbody>
          </table>
        </div>

        {/* SOLAR SPECS */}
        <div>
          <h4 className="font-bold text-gray-800 bg-gray-100 p-2 rounded mb-2">Solar System Costs</h4>
          <table className="w-full text-left">
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">CapEx (Civil + Drill)</td><td className="py-1 font-medium">${solar.capexDrillingAndCivil.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">CapEx (Equipment)</td><td className="py-1 font-medium">${solar.capexEquip.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Annual OpEx</td><td className="py-1 font-medium">${solar.opexAnnual.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Major Replacement Cost</td><td className="py-1 font-medium">${solar.replacementCost.toLocaleString()} (Every {solar.replacementInterval} yrs)</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Theft Probability</td><td className="py-1 font-medium">{solar.theftProbability}% / yr</td></tr>
            </tbody>
          </table>
        </div>

         {/* HANDPUMP SPECS */}
         <div>
          <h4 className="font-bold text-gray-800 bg-gray-100 p-2 rounded mb-2">Handpump Costs</h4>
          <table className="w-full text-left">
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Users Per Pump</td><td className="py-1 font-medium">{handpump.usersPerPump}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">CapEx (Per Unit)</td><td className="py-1 font-medium">${handpump.capexPerUnit.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">OpEx (Per Unit/Yr)</td><td className="py-1 font-medium">${handpump.opexAnnualPerUnit.toLocaleString()}</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Rehab Cost</td><td className="py-1 font-medium">${handpump.rehabCostPerUnit.toLocaleString()} (Every {handpump.rehabInterval} yrs)</td></tr>
            </tbody>
          </table>
        </div>

        {/* TIME & HEALTH */}
        <div>
          <h4 className="font-bold text-gray-800 bg-gray-100 p-2 rounded mb-2">Economic Benefit Inputs</h4>
          <table className="w-full text-left">
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Baseline Time (No Water)</td><td className="py-1 font-medium">{benefits.timeSpentBaseline} min/day</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Solar Collection Time</td><td className="py-1 font-medium">{benefits.timeSpentSolar} min/day</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Handpump Collection Time</td><td className="py-1 font-medium">{benefits.timeSpentHandpump} min/day</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Solar Health Value</td><td className="py-1 font-medium">${benefits.healthPremiumSolar}/person/yr</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Handpump Health Value</td><td className="py-1 font-medium">${benefits.healthPremiumHandpump}/person/yr</td></tr>
            </tbody>
          </table>
        </div>

        {/* ADDITIONAL */}
        <div>
          <h4 className="font-bold text-gray-800 bg-gray-100 p-2 rounded mb-2">Institutional Values</h4>
          <table className="w-full text-left">
            <tbody>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Value per School</td><td className="py-1 font-medium">${additional.valueSchool.toLocaleString()}/yr</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Value per Clinic</td><td className="py-1 font-medium">${additional.valueClinic.toLocaleString()}/yr</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Value per Garden</td><td className="py-1 font-medium">${additional.valueGarden.toLocaleString()}/yr</td></tr>
              <tr className="border-b border-gray-100"><td className="py-1 text-gray-600">Grid Energy Income</td><td className="py-1 font-medium">${additional.valueEnergy.toLocaleString()}/yr</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
