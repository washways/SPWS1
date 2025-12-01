import re

file_path = r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add State Variables
# Look for the buildingsLoading state
state_pattern = r'(const \[buildingsLoading, setBuildingsLoading\] = useState\(false\);)'
new_state = r'''\1

    // Spatial Analysis State
    const [bufferDistance, setBufferDistance] = useState(50); // meters
    const [peoplePerBuilding, setPeoplePerBuilding] = useState(5);
    const [servedPop, setServedPop] = useState(0);
    const [unservedPop, setUnservedPop] = useState(0);'''

content = re.sub(state_pattern, new_state, content)

# 2. Add UI Inputs
# Insert before the "Target Population" input
ui_pattern = r'(<div className="space-y-4 text-sm">\s*<div><label className="block text-gray-600 text-xs font-bold mb-1">Target Population)'
new_ui = r'''<div className="space-y-4 text-sm">
                    {/* Spatial Analysis Inputs */}
                    <div className="p-2 bg-blue-50 rounded border border-blue-100 mb-2">
                        <h4 className="font-bold text-blue-800 text-xs mb-2">Service Coverage</h4>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-gray-600 text-xs font-bold mb-1" title="Distance from pipe to be considered served">Service Buffer (m)</label>
                                <input 
                                    type="number" 
                                    value={bufferDistance} 
                                    onChange={e => setBufferDistance(Math.max(0, parseFloat(e.target.value) || 0))} 
                                    className="w-full p-1.5 border rounded text-xs" 
                                />
                            </div>
                            <div>
                                <label className="block text-gray-600 text-xs font-bold mb-1" title="Average people per household/building">People per Building</label>
                                <input 
                                    type="number" 
                                    value={peoplePerBuilding} 
                                    onChange={e => setPeoplePerBuilding(Math.max(1, parseFloat(e.target.value) || 1))} 
                                    className="w-full p-1.5 border rounded text-xs" 
                                />
                            </div>
                            <div className="flex justify-between text-xs pt-1 border-t border-blue-200 mt-1">
                                <span className="text-green-700 font-bold">Served: {servedPop.toLocaleString()}</span>
                                <span className="text-red-700 font-bold">Unserved: {unservedPop.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div><label className="block text-gray-600 text-xs font-bold mb-1">Target Population'''

content = re.sub(ui_pattern, new_ui, content)

# 3. Add Analysis Logic
# Insert before the return statement
logic_pattern = r'(return \(\s*<div className="flex flex-col)'
analysis_logic = r'''
    // Spatial Analysis Logic
    useEffect(() => {
        if (!osmBuildingLayerRef.current || !mapInstanceRef.current) return;

        let servedCount = 0;
        let unservedCount = 0;

        // Collect all pipe geometries
        const pipes: L.Polyline[] = [
            ...(features.current.risingMain ? [features.current.risingMain] : []),
            ...features.current.mainLines.map(ml => ml.poly),
            ...features.current.distLines
        ];

        if (pipes.length === 0) {
            // No pipes, all unserved
            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.setStyle) {
                    layer.setStyle({ color: '#ef4444', fillColor: '#ef4444' }); // Red
                }
                unservedCount++;
            });
        } else {
            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.feature && layer.feature.geometry.type === 'Polygon') {
                    // Simple centroid check for performance
                    const bounds = layer.getBounds();
                    const center = bounds.getCenter();
                    
                    let isServed = false;
                    for (const pipe of pipes) {
                        const pipeLatLngs = pipe.getLatLngs() as L.LatLng[];
                        // Check distance to each segment of the pipe
                        for (let i = 0; i < pipeLatLngs.length - 1; i++) {
                            const p1 = pipeLatLngs[i];
                            const p2 = pipeLatLngs[i+1];
                            const dist = L.LineUtil.pointToSegmentDistance(
                                mapInstanceRef.current!.latLngToLayerPoint(center),
                                mapInstanceRef.current!.latLngToLayerPoint(p1),
                                mapInstanceRef.current!.latLngToLayerPoint(p2)
                            );
                            
                            // Convert pixel distance to meters (approximate)
                            const metersPerPixel = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, mapInstanceRef.current!.getZoom() + 8);
                            const distMeters = dist * metersPerPixel;

                            if (distMeters <= bufferDistance) {
                                isServed = true;
                                break;
                            }
                        }
                        if (isServed) break;
                    }

                    if (isServed) {
                        layer.setStyle({ color: '#22c55e', fillColor: '#22c55e' }); // Green
                        servedCount++;
                    } else {
                        layer.setStyle({ color: '#ef4444', fillColor: '#ef4444' }); // Red
                        unservedCount++;
                    }
                }
            });
        }

        setServedPop(servedCount * peoplePerBuilding);
        setUnservedPop(unservedCount * peoplePerBuilding);

    }, [bufferDistance, peoplePerBuilding, showOSMBuildings, buildingsLoading, counts]);

    \1'''

content = re.sub(logic_pattern, analysis_logic, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully restored spatial analysis features!")
