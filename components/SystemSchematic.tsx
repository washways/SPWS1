

import React, { useEffect, useRef, useMemo, useState } from 'react';
import * as L from 'leaflet';
import { BoQItem, HydraulicInputs, SystemSpecs, PipelineProfile, SystemGeometry, ProjectDetails } from '../types';
import { FileText, Activity, AlertTriangle, Map as MapIcon, ClipboardCheck, Droplets, Download } from 'lucide-react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart, ReferenceLine, Legend, Bar } from 'recharts';

interface SystemSchematicProps {
    inputs: HydraulicInputs;
    specs: SystemSpecs | null;
    boq: BoQItem[];
    profiles: PipelineProfile[];
    currency: string;
    onUpdateRate: (id: string, newRate: number) => void;
    geometry: SystemGeometry | null;
    projectDetails: ProjectDetails;
    printMode?: boolean; 
    population?: number;
    designPopulation?: number;
}

export const SystemSchematic: React.FC<SystemSchematicProps> = ({ inputs, specs, boq, profiles, currency, onUpdateRate, geometry, projectDetails, printMode = false, population, designPopulation }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const downloadPDF = async () => {
        setIsDownloading(true);
        // Small delay to allow UI to update (e.g. show "Generating..." spinner)
        setTimeout(async () => {
            const element = document.getElementById('technical-report');
            if (!element) { 
                alert("Report element not found.");
                setIsDownloading(false); 
                return; 
            }

            const opt = {
                margin: [5, 5, 5, 5], 
                filename: `Technical_Design_${projectDetails.siteName || 'Site'}.pdf`,
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
                    alert("PDF Generator library not loaded. Please refresh and try again.");
                }
            } catch (e) {
                console.error("PDF Generation Error:", e);
                alert("Failed to generate PDF. Please check console for details.");
            } finally {
                setIsDownloading(false);
            }
        }, 100);
    };

    // --- MAP INITIALIZATION ---
    useEffect(() => {
        if (!geometry || !mapRef.current) return;
        if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }

        // Use preferCanvas: true for better compatibility with html2canvas during PDF generation
        const map = L.map(mapRef.current, {
            center: [geometry.center.lat, geometry.center.lng], 
            zoom: geometry.zoom, 
            zoomControl: false, 
            dragging: false, 
            scrollWheelZoom: false, 
            doubleClickZoom: false, 
            boxZoom: false, 
            attributionControl: false,
            preferCanvas: true 
        });
        mapInstance.current = map;

        // CRITICAL FIX: crossOrigin: true is required for html2canvas to capture map tiles
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
            attribution: 'Tiles &copy; Esri', 
            maxZoom: 19,
            crossOrigin: true 
        }).addTo(map);

        const bhIcon = L.divIcon({ className: 'bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[8px] font-bold', html: 'BH', iconSize: [20, 20] });
        const tankIcon = L.divIcon({ className: 'bg-cyan-500 border-2 border-white rounded flex items-center justify-center text-white text-[8px] font-bold', html: 'T', iconSize: [20, 20] });
        const tapIcon = L.divIcon({ className: 'bg-emerald-500 border border-white rounded-full', iconSize: [10, 10] });
        
        // Institutional Icons
        const instIcon = (type: string) => L.divIcon({
             className: `border border-white rounded shadow flex items-center justify-center text-white text-[8px] font-bold ${type === 'school' ? 'bg-purple-600' : type === 'clinic' ? 'bg-red-500' : type === 'garden' ? 'bg-green-600' : 'bg-amber-500'}`,
             html: type.charAt(0).toUpperCase(),
             iconSize: [20, 20]
        });

        if(geometry.borehole) L.marker([geometry.borehole.lat, geometry.borehole.lng], { icon: bhIcon }).addTo(map).bindTooltip("Borehole", { permanent: true, direction: 'top', offset: [0, -10], className: 'bg-white px-1 py-0 text-[10px] border border-gray-300 rounded shadow-sm font-bold' });
        if(geometry.tank) L.marker([geometry.tank.lat, geometry.tank.lng], { icon: tankIcon }).addTo(map).bindTooltip("Tank", { permanent: true, direction: 'top', offset: [0, -10], className: 'bg-white px-1 py-0 text-[10px] border border-gray-300 rounded shadow-sm font-bold' });
        geometry.taps.forEach(tap => { L.marker([tap.lat, tap.lng], { icon: tapIcon }).addTo(map).bindTooltip(tap.label, { permanent: true, direction: 'right', offset: [10, 0], className: 'bg-white/90 px-1 py-0 text-[9px] border border-gray-200 rounded shadow-sm' }); });
        
        // Render Institutions
        if (geometry.institutions) {
            geometry.institutions.forEach(inst => {
                 L.marker([inst.lat, inst.lng], { icon: instIcon(inst.type || 'school') }).addTo(map).bindTooltip(inst.label, { permanent: true, direction: 'right', offset: [10, 0], className: 'bg-white/90 px-1 py-0 text-[9px] border border-gray-200 rounded shadow-sm' });
            });
        }

        geometry.lines.forEach(line => {
            const color = line.type === 'rising' ? '#3b82f6' : (line.type === 'main' ? '#ef4444' : '#10b981');
            const weight = line.type === 'dist' ? 2 : 4;
            const dash = line.type === 'dist' ? '4, 4' : undefined;
            const poly = L.polyline(line.path, { color, weight, dashArray: dash }).addTo(map);
            if (line.type !== 'dist') poly.bindTooltip(line.label, { permanent: true, sticky: true, className: 'bg-white/80 text-[9px] px-1 rounded border border-gray-200', direction: 'center' });
        });

        const group = new L.FeatureGroup();
        if(geometry.borehole) group.addLayer(L.marker([geometry.borehole.lat, geometry.borehole.lng]));
        if(geometry.tank) group.addLayer(L.marker([geometry.tank.lat, geometry.tank.lng]));
        geometry.taps.forEach(t => group.addLayer(L.marker([t.lat, t.lng])));
        geometry.lines.forEach(l => group.addLayer(L.polyline(l.path)));
        if (geometry.institutions) geometry.institutions.forEach(i => group.addLayer(L.marker([i.lat, i.lng])));
        
        if(group.getLayers().length > 0) map.fitBounds(group.getBounds(), { padding: [50, 50] });
        
        // Initial invalidation
        setTimeout(() => map.invalidateSize(), 200);

    }, [geometry]);

    // Force Redraw when Print Mode Changes
    useEffect(() => {
        if (printMode && mapInstance.current) {
            // Immediate invalidation to handle visibility change from hidden to block
            mapInstance.current.invalidateSize();
            // Delayed invalidation to ensure container dimensions are settled
            setTimeout(() => {
                if (mapInstance.current) {
                    mapInstance.current.invalidateSize();
                    // Refit bounds to ensure map is centered correctly in the print view
                    if (geometry) {
                         const group = new L.FeatureGroup();
                         if(geometry.borehole) group.addLayer(L.marker([geometry.borehole.lat, geometry.borehole.lng]));
                         if(geometry.tank) group.addLayer(L.marker([geometry.tank.lat, geometry.tank.lng]));
                         geometry.taps.forEach(t => group.addLayer(L.marker([t.lat, t.lng])));
                         if(group.getLayers().length > 0) mapInstance.current.fitBounds(group.getBounds(), { padding: [50, 50] });
                    }
                }
            }, 500);
        }
    }, [printMode, geometry]);

    useEffect(() => {
        if (!mapRef.current || !mapInstance.current) return;
        const resizeObserver = new ResizeObserver(() => { mapInstance.current?.invalidateSize(); });
        resizeObserver.observe(mapRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const tankSimulationData = useMemo(() => {
        if (!specs) return [];
        const tankCapacity = Math.ceil(specs.dailyDemandM3); 
        const startLevel = tankCapacity * 0.4;
        const data = [];
        let currentLevel = startLevel;
        const hourlyDemandPattern = [ 0.01, 0.01, 0.01, 0.01, 0.02, 0.08, 0.12, 0.10, 0.08, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05, 0.06, 0.08, 0.10, 0.08, 0.04, 0.03, 0.02, 0.01, 0.01 ];
        const patternSum = hourlyDemandPattern.reduce((a, b) => a + b, 0);
        const sunStart = 8; const sunEnd = 16;
        for (let i = 0; i < 24; i++) {
            const demandM3 = (hourlyDemandPattern[i] / patternSum) * specs.dailyDemandM3;
            let pumpM3 = 0;
            if (i >= sunStart && i <= sunEnd) {
                const hourInSun = i - sunStart;
                const totalSunHours = sunEnd - sunStart;
                const radian = (hourInSun / totalSunHours) * Math.PI;
                const efficiency = Math.sin(radian);
                pumpM3 = specs.flowRateM3H * efficiency; 
            }
            const netChange = pumpM3 - demandM3;
            currentLevel += netChange;
            if (currentLevel > tankCapacity) currentLevel = tankCapacity;
            if (currentLevel < 0) currentLevel = 0;
            data.push({ hour: `${i}:00`, demand: demandM3, pump: pumpM3, level: currentLevel, capacity: tankCapacity });
        }
        return data;
    }, [specs]);

    if (!specs || boq.length === 0) return <div className="flex flex-col items-center justify-center h-96 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300"><Activity className="w-12 h-12 mb-4 opacity-50" /><p>No design data available.</p><p className="text-sm">Please complete a design in the "Design Map" tab first.</p></div>;

    const totalCost = boq.reduce((sum, item) => sum + item.amount, 0);
    const civilsTotal = boq.filter(i => i.category === 'Civils').reduce((sum, i) => sum + i.amount, 0);
    const networkTotal = boq.filter(i => i.category === 'Network').reduce((sum, i) => sum + i.amount, 0);
    const mepTotal = boq.filter(i => ['Mechanical', 'Electrical'].includes(i.category)).reduce((sum, i) => sum + i.amount, 0);

    return (
        <div id="technical-report" className="max-w-5xl mx-auto space-y-8 pb-12 print:space-y-4 print:pb-0 print:max-w-none">
            
            <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center print:border-b-4 print:border-gray-900 print:shadow-none print:p-4 ${printMode ? 'hidden' : ''}`}>
                <div className="w-full">
                    <div className="flex justify-between items-start w-full">
                        <div><h2 className="text-2xl font-bold text-gray-900 print:text-xl">System Schematic & BoQ</h2><p className="text-gray-500 print:hidden">Contractor-ready technical output</p></div>
                         <button onClick={downloadPDF} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition disabled:opacity-50" data-html2canvas-ignore="true">
                            {isDownloading ? <Activity className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                            {isDownloading ? 'Generating...' : 'Download Technical PDF'}
                         </button>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-4 border-t pt-4 w-full text-sm print:mt-2 print:pt-2">
                        <div><span className="text-xs font-bold text-gray-500 uppercase">Site Name</span><div className="font-bold text-lg text-gray-900">{projectDetails.siteName || "Unspecified Site"}</div></div>
                        <div><span className="text-xs font-bold text-gray-500 uppercase">Contract Number</span><div className="font-bold text-lg text-gray-900">{projectDetails.contractNumber || "N/A"}</div></div>
                        <div><span className="text-xs font-bold text-gray-500 uppercase">Date Generated</span><div className="font-bold text-lg text-gray-900">{new Date().toLocaleDateString()}</div></div>
                    </div>
                </div>
            </div>

            {/* 1. Technical Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 break-inside-avoid print:grid-cols-3 print:gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:p-4 print:border">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 print:mb-2">Design Duty Point</h3>
                    <div className="space-y-3 print:space-y-1 print:text-xs">
                        {population && <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Initial Population</span><span className="font-bold">{population.toLocaleString()}</span></div>}
                        {designPopulation && <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Design Pop. (Year 20)</span><span className="font-bold">{designPopulation.toLocaleString()}</span></div>}
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Total Demand</span><span className="font-bold">{specs.dailyDemandM3.toFixed(1)} m³/day</span></div>
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Total Dynamic Head</span><span className="font-bold text-emerald-600">{specs.totalDynamicHead.toFixed(1)} m</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Req. Flow Rate</span><span className="font-bold text-blue-600">{specs.flowRateM3H.toFixed(1)} m³/h</span></div>
                    </div>
                </div>

                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:p-4 print:border">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 print:mb-2">Infrastructure Specs</h3>
                    <div className="space-y-3 print:space-y-1 print:text-xs">
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Pump Power</span><span className="font-bold">{specs.pumpPowerKW.toFixed(2)} kW</span></div>
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Solar Generator</span><span className="font-bold text-yellow-600">{specs.pvArrayKW.toFixed(2)} kWp</span></div>
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Tank Capacity</span><span className="font-bold text-cyan-600">{Math.ceil(specs.dailyDemandM3)} m³</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Main Pipeline</span><span className="font-bold">HDPE {specs.pipeDiameterMM}mm</span></div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 print:p-4 print:border">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4 print:mb-2">Cost Estimate</h3>
                    <div className="space-y-3 print:space-y-1 print:text-xs">
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Civil Works</span><span className="font-bold">${Math.round(civilsTotal).toLocaleString()}</span></div>
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">Pipe Network</span><span className="font-bold">${Math.round(networkTotal).toLocaleString()}</span></div>
                        <div className="flex justify-between border-b border-gray-50 pb-2 print:pb-1"><span className="text-gray-600">M&E Equip</span><span className="font-bold">${Math.round(mepTotal).toLocaleString()}</span></div>
                        <div className="flex justify-between pt-1"><span className="text-gray-900 font-bold">TOTAL CAPEX</span><span className="font-bold text-xl text-emerald-600">${Math.round(totalCost).toLocaleString()}</span></div>
                    </div>
                </div>
            </div>

            {/* 2. Design Layout Map */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid print:p-0 print:border-0">
                <div className="mb-4 flex items-center justify-between print:mb-2">
                    <div><h3 className="text-lg font-bold text-gray-900 print:text-base">Design Layout Map</h3><p className="text-sm text-gray-500 print:hidden">Labeled network schematic</p></div>
                    <MapIcon className="w-5 h-5 text-gray-400"/>
                </div>
                <div className="h-[400px] w-full bg-slate-100 rounded-lg border border-gray-300 overflow-hidden relative z-0 print:border-2 print:border-gray-800 print:h-[500px]">
                    <div ref={mapRef} className="w-full h-full z-0" />
                </div>
            </div>

             {/* 3. Storage & Demand Simulation */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid print:p-0 print:shadow-none print:border-0">
                <div className="mb-6 print:mb-2 flex items-center justify-between">
                    <div><h3 className="text-lg font-bold text-gray-900 print:text-base">Storage & Demand Simulation</h3><p className="text-sm text-gray-500 print:text-xs">Hourly balance of Solar Pumping vs Community Water Demand</p></div>
                    <Droplets className="w-5 h-5 text-blue-500"/>
                </div>
                <div className="h-64 w-full print:h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={tankSimulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="hour" tick={{fontSize:10}} interval={2} />
                            <YAxis yAxisId="left" unit="m³" tick={{fontSize:10}} label={{value: 'Volume (m³)', angle: -90, position: 'insideLeft', fontSize: 10}} />
                            <YAxis yAxisId="right" orientation="right" unit="m³" tick={{fontSize:10}} hide />
                            <Tooltip contentStyle={{fontSize: 12}} formatter={(value: number, name: string) => [value.toFixed(2) + ' m³', name]}/>
                            <Legend verticalAlign="top" height={36}/>
                            <Bar yAxisId="left" dataKey="pump" name="Solar Pump Input" fill="#fbbf24" radius={[2, 2, 0, 0]} barSize={20} fillOpacity={0.6}/>
                            <Area yAxisId="left" type="monotone" dataKey="demand" name="Community Demand" fill="#94a3b8" stroke="#64748b" fillOpacity={0.3} />
                            <Line yAxisId="left" type="monotone" dataKey="level" name="Tank Storage Level" stroke="#0ea5e9" strokeWidth={3} dot={false} />
                            <ReferenceLine yAxisId="left" y={tankSimulationData[0]?.capacity} label={{ position: 'top', value: 'Tank Capacity', fontSize: 10, fill: '#ef4444' }} stroke="#ef4444" strokeDasharray="3 3" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 4. Hydraulic Profiles */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 break-inside-avoid print:p-0 print:shadow-none print:border-0">
                <div className="mb-6 print:mb-2"><h3 className="text-lg font-bold text-gray-900 print:text-base">Hydraulic Profiles</h3></div>
                {profiles.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8 print:gap-4">
                        {profiles.map(profile => {
                            const hasHighPressure = profile.data.some(d => d.risk === 'high_pressure');
                            const hasNegativePressure = profile.data.some(d => d.risk === 'negative_pressure');
                            return (
                                <div key={profile.id} className="p-4 border rounded-lg bg-slate-50 break-inside-avoid print:bg-white print:border-gray-300 print:p-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-sm font-bold text-gray-700">{profile.name}</h4>
                                        <div className="flex gap-2 text-xs">
                                            {hasHighPressure && <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> High Pressure (&gt; 100m)</span>}
                                            {hasNegativePressure && <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Air-Lock Risk (Neg Pressure)</span>}
                                        </div>
                                    </div>
                                    <div className="h-64 w-full print:h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={profile.data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="dist" unit="m" tick={{fontSize:10}} label={{value: 'Distance (m)', position: 'bottom', offset: 0, fontSize: 10}} />
                                                <YAxis unit="m" domain={['auto', 'auto']} tick={{fontSize:10}} label={{value: 'Elev (m)', angle: -90, position: 'insideLeft', fontSize: 10}} />
                                                <Tooltip contentStyle={{fontSize: 12}} formatter={(value: number, name: string) => [value.toFixed(1) + 'm', name === 'hgl' ? 'Hydraulic Grade' : name === 'elevation' ? 'Ground Elev' : name]} labelFormatter={(l) => `Dist: ${Math.round(l)}m`}/>
                                                <Legend verticalAlign="top" height={36}/>
                                                <Area type="monotone" dataKey="elevation" name="Ground Elevation" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.4} strokeWidth={2} />
                                                <Line type="monotone" dataKey="hgl" name="Hydraulic Grade Line" stroke="#ef4444" strokeWidth={2} dot={false} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-2 grid grid-cols-4 text-[10px] text-gray-500 border-t pt-2 print:text-[9px]">
                                        <div>Start Elev: {profile.data[0]?.elevation.toFixed(1)}m</div>
                                        <div>End Elev: {profile.data[profile.data.length-1]?.elevation.toFixed(1)}m</div>
                                        <div>Max Pressure: {Math.max(...profile.data.map(d=>d.pressure)).toFixed(1)}m</div>
                                        <div>Min Pressure: {Math.min(...profile.data.map(d=>d.pressure)).toFixed(1)}m</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : <p className="text-gray-400 text-sm italic">No pipeline profiles generated.</p>}
            </div>

            {/* 5. Bill of Quantities Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden break-before-page print:border print:shadow-none">
                <div className="p-6 border-b border-gray-200 bg-gray-50 print:p-2 print:bg-gray-100"><h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 print:text-base"><FileText className="w-5 h-5"/> Bill of Quantities (BoQ)</h3></div>
                <div className="overflow-x-auto print:overflow-x-visible">
                    <table className="w-full text-sm text-left print:text-xs">
                        <thead className="bg-gray-100 text-gray-600 font-medium uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3 print:px-2 print:py-1">Category</th>
                                <th className="px-6 py-3 print:px-2 print:py-1">Item Description</th>
                                <th className="px-6 py-3 text-center print:px-1 print:py-1">Unit</th>
                                <th className="px-6 py-3 text-right print:px-1 print:py-1">Qty</th>
                                <th className="px-6 py-3 text-right w-32 print:w-16 print:px-1 print:py-1">Rate ($)</th>
                                <th className="px-6 py-3 text-right print:px-2 print:py-1">Amount ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {boq.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 group print:hover:bg-transparent">
                                    <td className="px-6 py-3 text-gray-500 font-medium print:px-2 print:py-1">{item.category}</td>
                                    <td className="px-6 py-3 text-gray-900 print:px-2 print:py-1">{item.item}</td>
                                    <td className="px-6 py-3 text-center text-gray-500 print:px-1 print:py-1">{item.unit}</td>
                                    <td className="px-6 py-3 text-right text-gray-900 print:px-1 print:py-1">{item.qty.toLocaleString()}</td>
                                    <td className="px-6 py-3 text-right print:px-1 print:py-1">
                                        <input type="number" value={item.rate} onChange={(e) => onUpdateRate(item.id, parseFloat(e.target.value)||0)} className="w-24 text-right p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded bg-transparent focus:bg-white outline-none transition print:border-none print:w-full print:p-0"/>
                                    </td>
                                    <td className="px-6 py-3 text-right font-bold text-gray-900 print:px-2 print:py-1">{Math.round(item.amount).toLocaleString()}</td>
                                </tr>
                            ))}
                            <tr className="bg-slate-50 font-bold print:bg-gray-200"><td colSpan={5} className="px-6 py-4 text-right text-gray-900 uppercase print:px-2 print:py-2">Total Estimated Cost</td><td className="px-6 py-4 text-right text-emerald-600 text-lg print:px-2 print:py-2 print:text-sm">${Math.round(totalCost).toLocaleString()}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. Contractor Guidance & Disclaimers */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 break-inside-avoid print:p-4 print:bg-white print:border-gray-300">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4 print:text-sm print:mb-2"><ClipboardCheck className="w-5 h-5 text-slate-600"/> Contractor Guidance & Notes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600 print:grid-cols-2 print:gap-4">
                    <div><h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wide">Design Assumptions</h4><ul className="list-disc list-inside space-y-1"><li>Pump Efficiency assumed at {(inputs.pumpEfficiency * 100).toFixed(0)}%.</li><li>Solar sizing factor: 1.5x Pump Power.</li><li>Friction losses calculated using Hazen-Williams C=140 (HDPE).</li></ul></div>
                    <div><h4 className="font-bold text-gray-900 mb-2 uppercase tracking-wide">General Disclaimers</h4><ul className="list-disc list-inside space-y-1"><li>Preliminary design for estimation only.</li><li>All elevations derived from satellite data.</li><li>Quantities in BoQ are provisional.</li></ul></div>
                </div>
            </div>
        </div>
    );
};
