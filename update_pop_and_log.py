import re

# File Paths
sitemap_path = r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx'
app_path = r'c:\Users\jrobertson\Downloads\SPWS1\App.tsx'

# --- 1. Update SiteMap.tsx: Add Sync Button ---
with open(sitemap_path, 'r', encoding='utf-8') as f:
    sitemap_content = f.read()

# Find the Target Population input
# We want to replace the div containing the label and input with a more complex one
target_pop_pattern = r'(<div><label className="block text-gray-600 text-xs font-bold mb-1">Target Population</label><input type="number" value={population} onChange={e => setPopulation\(parseFloat\(e.target.value\) \|\| 0\)} className="w-full p-2 border rounded" /></div>)'

new_target_pop = r'''<div>
                        <label className="block text-gray-600 text-xs font-bold mb-1">Target Population</label>
                        <div className="flex gap-2">
                            <input type="number" value={population} onChange={e => setPopulation(parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded" />
                            <button 
                                onClick={() => setPopulation(servedPop)} 
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200 transition"
                                title={`Sync with Spatial Analysis (Currently Served: ${servedPop.toLocaleString()})`}
                            >
                                Sync
                            </button>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 text-right">
                            Spatial Estimate: <strong>{servedPop.toLocaleString()}</strong>
                        </div>
                    </div>'''

sitemap_content = sitemap_content.replace(
    '<div><label className="block text-gray-600 text-xs font-bold mb-1">Target Population</label><input type="number" value={population} onChange={e => setPopulation(parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded" /></div>',
    new_target_pop
)

with open(sitemap_path, 'w', encoding='utf-8') as f:
    f.write(sitemap_content)

print("Updated SiteMap.tsx with Sync Button.")

# --- 2. Update App.tsx: Enhance Logging ---
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

# Find the AnalyticsService.logReport call
# We will replace the entire object passed to logReport
log_pattern = r'AnalyticsService\.logReport\(\{[\s\S]*?\}\);'

new_log_call = r'''AnalyticsService.logReport({
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
            winner: summary.netEconomicValueSolar > summary.netEconomicValueHandpump ? 'Solar' : 'Handpump',
            // Extended Data
            hydraulicInputs: hydraulicInputs,
            systemSpecs: systemSpecs,
            boqTotal: generatedBoQ.reduce((sum, item) => sum + item.amount, 0),
            pipelineStats: {
                risingMain: counts.risingLen,
                mainLines: counts.mainLen,
                distribution: counts.distLen
            },
            financialParams: {
                discountRate: global.discountRate,
                projectLifespan: global.projectLifespan,
                solarOpex: solar.opexAnnual,
                handpumpCapexUnit: handpump.capexPerUnit
            }
        });'''

app_content = re.sub(log_pattern, new_log_call, app_content)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Updated App.tsx with enhanced logging.")
