import re

file_path = r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add visualBufferLayerRef
ref_pattern = r'(const osmBuildingLayerRef = useRef<L.LayerGroup \| null>\(null\);)'
new_ref = r'\1\n    const visualBufferLayerRef = useRef<L.LayerGroup | null>(null);'
content = re.sub(ref_pattern, new_ref, content)

# 2. Replace the Analysis Logic with robust LatLng math and visual buffer
logic_start = r'// Spatial Analysis Logic'
logic_end = r'return \('

# New robust logic
new_logic = r'''// Spatial Analysis Logic
    useEffect(() => {
        if (!osmBuildingLayerRef.current || !mapInstanceRef.current) return;

        // Initialize visual buffer layer if needed
        if (!visualBufferLayerRef.current) {
            visualBufferLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        } else {
            visualBufferLayerRef.current.clearLayers();
        }

        let servedCount = 0;
        let unservedCount = 0;

        // Collect all pipe geometries
        const pipes: L.Polyline[] = [
            ...(features.current.risingMain ? [features.current.risingMain] : []),
            ...features.current.mainLines.map(ml => ml.poly),
            ...features.current.distLines
        ];

        // Helper: Distance from point P to segment AB in meters
        const getDistToSegmentMeters = (p: L.LatLng, a: L.LatLng, b: L.LatLng) => {
            const pLat = p.lat; const pLng = p.lng;
            const aLat = a.lat; const aLng = a.lng;
            const bLat = b.lat; const bLng = b.lng;

            let t = ((pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)) /
                    ((bLat - aLat) ** 2 + (bLng - aLng) ** 2);

            t = Math.max(0, Math.min(1, t));

            const closestLat = aLat + t * (bLat - aLat);
            const closestLng = aLng + t * (bLng - aLng);
            const closest = new L.LatLng(closestLat, closestLng);

            return p.distanceTo(closest);
        };

        if (pipes.length === 0) {
            // No pipes, all unserved
            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.setStyle) layer.setStyle({ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 });
                unservedCount++;
            });
        } else {
            // Draw Visual Buffer (Circles at vertices for feedback)
            pipes.forEach(pipe => {
                const latlngs = pipe.getLatLngs() as L.LatLng[];
                // Draw circles at vertices
                latlngs.forEach(ll => {
                    L.circle(ll, { radius: bufferDistance, color: '#22c55e', weight: 1, fillOpacity: 0.1, dashArray: '5, 5' }).addTo(visualBufferLayerRef.current!);
                });
                // Draw simplified buffer lines (thick transparent lines)
                // Note: Leaflet weight is pixels, so this is just a visual aid, not accurate to scale
                L.polyline(latlngs, { color: '#22c55e', weight: 20, opacity: 0.2 }).addTo(visualBufferLayerRef.current!);
            });

            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.feature && layer.feature.geometry.type === 'Polygon') {
                    const bounds = layer.getBounds();
                    const center = bounds.getCenter();
                    
                    let isServed = false;
                    for (const pipe of pipes) {
                        const pipeLatLngs = pipe.getLatLngs() as L.LatLng[];
                        for (let i = 0; i < pipeLatLngs.length - 1; i++) {
                            const dist = getDistToSegmentMeters(center, pipeLatLngs[i], pipeLatLngs[i+1]);
                            if (dist <= bufferDistance) {
                                isServed = true;
                                break;
                            }
                        }
                        if (isServed) break;
                    }

                    if (isServed) {
                        layer.setStyle({ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.5, weight: 2 }); // Green, thicker
                        servedCount++;
                    } else {
                        layer.setStyle({ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 }); // Red
                        unservedCount++;
                    }
                }
            });
        }

        setServedPop(servedCount * peoplePerBuilding);
        setUnservedPop(unservedCount * peoplePerBuilding);

    }, [bufferDistance, peoplePerBuilding, showOSMBuildings, buildingsLoading, counts]); // Recalc when pipes change

    '''

# Use regex to replace the old logic block
# We look for the start of the useEffect and replace until the end of the block
# This is tricky with regex, so we'll match the start and assume the structure
pattern = r'// Spatial Analysis Logic\s*useEffect\(\(\) => \{[\s\S]*?\}, \[bufferDistance, peoplePerBuilding, showOSMBuildings, buildingsLoading, counts\]\);\s*'

content = re.sub(pattern, new_logic, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated spatial analysis logic and added visual buffer!")
