import re

file_path = r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire useEffect block for Spatial Analysis
# We need to match the block we just inserted in the previous step
# The key changes are:
# 1. Exclude risingMain from 'pipes' array
# 2. Add 'getBufferPolygon' helper function
# 3. Draw polygons instead of circles/lines for visualization

start_marker = r'// Spatial Analysis Logic'
end_marker = r'return \('

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

        // Collect all pipe geometries (EXCLUDING Rising Main as requested)
        const pipes: L.Polyline[] = [
            // ...(features.current.risingMain ? [features.current.risingMain] : []), // Excluded
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

        // Helper: Generate buffer polygon around a segment
        const getBufferPolygon = (p1: L.LatLng, p2: L.LatLng, bufferMeters: number) => {
            // Calculate offset vectors
            const dx = p2.lng - p1.lng;
            const dy = p2.lat - p1.lat;
            const len = Math.sqrt(dx*dx + dy*dy);
            
            if (len === 0) return null;

            // Convert meters to approx degrees (rough approximation for visualization)
            // 1 deg lat ~ 111km, 1 deg lng ~ 111km * cos(lat)
            const metersPerDegLat = 111132.92;
            const metersPerDegLng = 111132.92 * Math.cos(p1.lat * (Math.PI / 180));
            
            const bufferDegLat = bufferMeters / metersPerDegLat;
            const bufferDegLng = bufferMeters / metersPerDegLng;

            // Perpendicular vector (-dy, dx) normalized
            const ux = -dy / len;
            const uy = dx / len;

            // Offset points
            const offX = ux * bufferDegLng;
            const offY = uy * bufferDegLat;

            return [
                [p1.lat + offY, p1.lng + offX],
                [p2.lat + offY, p2.lng + offX],
                [p2.lat - offY, p2.lng - offX],
                [p1.lat - offY, p1.lng - offX]
            ];
        };

        if (pipes.length === 0) {
            // No pipes, all unserved
            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.setStyle) layer.setStyle({ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 });
                unservedCount++;
            });
        } else {
            // Draw Visual Buffer (Polygons for segments + Circles for joints)
            pipes.forEach(pipe => {
                const latlngs = pipe.getLatLngs() as L.LatLng[];
                
                // Draw circles at vertices (joints)
                latlngs.forEach(ll => {
                    L.circle(ll, { radius: bufferDistance, color: '#22c55e', weight: 0, fillOpacity: 0.2 }).addTo(visualBufferLayerRef.current!);
                });

                // Draw buffer polygons for segments
                for (let i = 0; i < latlngs.length - 1; i++) {
                    const polyCoords = getBufferPolygon(latlngs[i], latlngs[i+1], bufferDistance);
                    if (polyCoords) {
                        L.polygon(polyCoords as any, { color: '#22c55e', weight: 0, fillOpacity: 0.2 }).addTo(visualBufferLayerRef.current!);
                    }
                }
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
pattern = r'// Spatial Analysis Logic\s*useEffect\(\(\) => \{[\s\S]*?\}, \[bufferDistance, peoplePerBuilding, showOSMBuildings, buildingsLoading, counts\]\);\s*'

content = re.sub(pattern, new_logic, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated buffer visualization (polygons) and excluded rising main!")
