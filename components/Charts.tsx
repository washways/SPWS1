
import React from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Label
} from 'recharts';
import { ComparisonSummary, FinancialResult, SimulationResult } from '../types';

interface ChartsProps {
  yearlyData: FinancialResult[];
  summary: ComparisonSummary;
  currency: string;
  simulationResult: SimulationResult | null;
}

export const Charts: React.FC<ChartsProps> = ({ yearlyData, summary, currency, simulationResult }) => {
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(val);

  // 1. Net Lifetime Economic Value (Positive Logic)
  const solarNetValue = summary.netEconomicValueSolar;
  const handpumpNetValue = summary.netEconomicValueHandpump;

  const comparisonData = [
    {
        name: 'Handpumps',
        'Net Lifetime Value': handpumpNetValue,
        fill: handpumpNetValue > 0 ? '#10b981' : '#ef4444'
    },
    {
        name: 'Solar Piped',
        'Net Lifetime Value': solarNetValue,
        fill: solarNetValue > 0 ? '#3b82f6' : '#ef4444'
    }
  ];

  // 2. Benefit vs Cost Breakdown (Detailed)
  // UPDATED: High Contrast Color Palette
  const breakdownData = [
      {
          name: 'Handpumps',
          'Total Costs': -(summary.capexHandpump + summary.opexHandpumpNPV), // Negative for chart
          'Health Benefits': summary.healthBenefitHandpumpNPV,
          'Time Savings': summary.timeSavedHandpumpNPV, 
          'Education Value': 0,
          'Healthcare Value': 0,
          'Productive Use': 0,
          'Carbon & Subsidies': 0
      },
      {
          name: 'Solar Piped',
          'Total Costs': -(summary.capexSolar + summary.opexSolarNPV + summary.theftRiskNPV),
          'Health Benefits': summary.healthBenefitSolarNPV,
          'Time Savings': summary.timeSavedSolarNPV,
          'Education Value': summary.valueSchoolNPV,
          'Healthcare Value': summary.valueClinicNPV,
          'Productive Use': summary.valueGardenNPV + summary.valueEnergyNPV,
          'Carbon & Subsidies': summary.valueCarbonNPV // Includes Carbon + Subsidy
      }
  ];

  return (
    <div className="space-y-8 print:space-y-4">
      
      {/* 1. MAIN COMPARISON: NET LIFETIME VALUE */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:border print:shadow-none break-inside-avoid">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
           <div>
             <h3 className="text-lg font-bold text-gray-900">1. Net Economic Value Comparison</h3>
             <p className="text-sm text-gray-500">
               Total Value generated (Benefits - Costs) vs Status Quo (No Water)
             </p>
           </div>
           
           {/* Scorecard */}
           <div className="flex bg-gray-50 p-3 rounded-lg border border-gray-100 gap-6 mt-4 md:mt-0 print:hidden">
                <div className="text-right">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Winner</div>
                    <div className={`text-xl font-bold ${solarNetValue > handpumpNetValue ? 'text-blue-600' : 'text-emerald-600'}`}>
                        {solarNetValue > handpumpNetValue ? 'Solar System' : 'Handpumps'}
                    </div>
                </div>
                <div className="w-px bg-gray-200 self-stretch"></div>
                <div className="text-right">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Net Gain</div>
                    <div className="text-xl font-bold text-gray-900">
                        {formatCurrency(Math.abs(solarNetValue - handpumpNetValue))}
                    </div>
                </div>
           </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontWeight: 'bold' }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                cursor={{ fill: '#f9fafb' }}
              />
              <ReferenceLine x={0} stroke="#000" />
              <Bar dataKey="Net Lifetime Value" barSize={40} isAnimationActive={false}>
                {comparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-400 mt-2 italic text-center">
            *Net Value = (Health Benefits + Time Savings + Revenue + External Value) - (Capital Cost + Maintenance + Risk)
        </p>
      </div>

      {/* 2. COST BENEFIT BREAKDOWN */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:border print:shadow-none break-inside-avoid">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">2. Detailed Benefit Breakdown</h3>
            <p className="text-sm text-gray-500">Components of value generation</p>
          </div>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={breakdownData}
                    stackOffset="sign"
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 14, fontWeight: 600 }} />
                    <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                    <ReferenceLine y={0} stroke="#000" />
                    <Tooltip 
                        formatter={(value: number) => formatCurrency(Math.abs(value))} 
                        cursor={{ fill: '#f9fafb' }}
                    />
                    <Legend />
                    {/* UPDATED COLORS: Distinct palette for readability */}
                    <Bar dataKey="Health Benefits" stackId="a" fill="#16a34a" name="Health (Green)" isAnimationActive={false} />
                    <Bar dataKey="Time Savings" stackId="a" fill="#2563eb" name="Time (Blue)" isAnimationActive={false} />
                    <Bar dataKey="Education Value" stackId="a" fill="#7c3aed" name="Education (Purple)" isAnimationActive={false} />
                    <Bar dataKey="Healthcare Value" stackId="a" fill="#db2777" name="Clinic (Pink)" isAnimationActive={false} />
                    <Bar dataKey="Productive Use" stackId="a" fill="#ea580c" name="Productive (Orange)" isAnimationActive={false} />
                    <Bar dataKey="Carbon & Subsidies" stackId="a" fill="#0891b2" name="Carbon/Subsidy (Cyan)" isAnimationActive={false} />
                    <Bar dataKey="Total Costs" stackId="a" fill="#dc2626" name="Costs (Red)" isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* 3. CASHFLOW */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:border print:shadow-none break-inside-avoid">
            <div className="flex justify-between mb-4 items-start">
               <div>
                   <h3 className="text-lg font-bold text-gray-900">3. Operational Cash Flow (Bank Balance)</h3>
                   <p className="text-sm text-gray-500 max-w-lg">
                       This tracks the <strong>Operator's Bank Balance</strong> over time.
                       <br/>
                       <span className="text-xs italic mt-1 inline-block text-gray-400">
                           Assumes CapEx is donor-funded. Tracks Revenue (Tariffs + Subsidy + Carbon) minus OpEx.
                       </span>
                   </p>
               </div>
            </div>
            <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyData} margin={{ right: 20, top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10 }} label={{ value: 'Year', position: 'bottom', offset: 0 }}/>
                <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" label={{ value: 'Break-Even', position: 'insideTopRight', fill: '#6b7280', fontSize: 10 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(l) => `Year ${l}`} contentStyle={{ color: '#111827' }}/>
                <Legend wrapperStyle={{ fontSize: '12px' }}/>
                <Line type="monotone" dataKey="solarCumulativeCashflow" name="Solar Bank Balance" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="handpumpCumulativeCashflow" name="Handpump Bank Balance" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-center text-gray-500 bg-gray-50 p-2 rounded">
                Positive values indicate operational sustainability and reserve accumulation.
            </div>
        </div>

      {/* 4. MONTE CARLO */}
      {simulationResult ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 print:border print:shadow-none break-inside-avoid">
          <div className="mb-2 border-b border-gray-100 pb-2">
            <h3 className="text-lg font-bold text-indigo-900">4. Sensitivity Analysis (Risk Profile)</h3>
            <div className="flex items-center mt-1 space-x-4 text-xs">
                <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    <span className="font-medium">Solar Wins: {simulationResult.solarWinRate.toFixed(1)}%</span>
                </div>
                <div className="flex items-center">
                     <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2"></span>
                     <span className="font-medium">Handpump Wins: {(100 - simulationResult.solarWinRate).toFixed(1)}%</span>
                </div>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={simulationResult.distribution} barCategoryGap={1} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 9 }} 
                    interval={2}
                >
                    <Label value="Net Present Value Differential ($)" offset={0} position="bottom" fontSize={12} fill="#6b7280" />
                </XAxis>
                <YAxis hide />
                <Tooltip 
                    cursor={{fill: 'transparent'}}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const isHandpumpCheaper = data.binEnd < 0;
                        return (
                            <div className="bg-white p-2 border border-gray-200 shadow-lg rounded text-xs text-gray-900">
                                <p className="font-bold text-sm mb-1">{isHandpumpCheaper ? "Handpumps Better" : "Solar Better"}</p>
                                <p className="text-gray-500">Advantage: {data.label}</p>
                                <p className="font-semibold">{data.count} scenarios</p>
                            </div>
                        );
                        }
                        return null;
                    }}
                />
                <ReferenceLine x="0" stroke="#000" />
                <Bar dataKey="count" isAnimationActive={false}>
                    {
                        simulationResult.distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.binEnd < 0 ? '#10b981' : '#3b82f6'} />
                        ))
                    }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-xs text-center text-gray-400 mt-2 italic">
               Monte Carlo Simulation (10,000 runs) varying input costs & benefits by ±20%.
          </div>
        </div>
        ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-gray-400 text-sm p-6 print:hidden">
                Run simulation to see risk profile
            </div>
        )}
    </div>
  );
};
