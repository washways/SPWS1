import re

# Read the file
with open(r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and add OSM useEffects after activeToolRef useEffect
insert_marker = 'useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);'

osm_code = """

    // OSM Buildings Layer
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        const fetchAndDisplayOSMBuildings = async () => {
            if (showOSMBuildings && !osmBuildingLayerRef.current) {
                setBuildingsLoading(true);
                try {
                    const bounds = mapInstanceRef.current!.getBounds();
                    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
                    const query = `[out:json][timeout:25];(way["building"](${bbox}););out geom;`;
                    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

                    const response = await fetch(url);
                    const data = await response.json();

                    const features = data.elements.map((element: any) => {
                        if (element.type === 'way' && element.geometry) {
                            return {
                                type: 'Feature',
                                properties: { building: element.tags?.building || 'yes' },
                                geometry: {
                                    type: 'Polygon',
                                    coordinates: [element.geometry.map((node: any) => [node.lon, node.lat])]
                                }
                            };
                        }
                        return null;
                    }).filter(Boolean);

                    const geojson = { type: 'FeatureCollection', features: features };

                    const layer = L.geoJSON(geojson as any, {
                        style: { color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.3 }
                    });

                    osmBuildingLayerRef.current = L.layerGroup([layer]).addTo(mapInstanceRef.current!);
                    console.log(`Loaded ${features.length} OSM buildings`);
                } catch (error) {
                    console.error('Error fetching OSM buildings:', error);
                    alert('Failed to load OSM buildings. Try zooming in to a smaller area.');
                } finally {
                    setBuildingsLoading(false);
                }
            } else if (!showOSMBuildings && osmBuildingLayerRef.current) {
                osmBuildingLayerRef.current.remove();
                osmBuildingLayerRef.current = null;
            }
        };

        fetchAndDisplayOSMBuildings();
    }, [showOSMBuildings]);

    // Google Buildings Layer (Production placeholder)
    useEffect(() => {
        if (showGoogleBuildings) {
            alert('Google Buildings layer is available in production deployment only.\\n\\nFor local development, use OSM Buildings instead.\\n\\nSee deployment notes for upgrading to Google Open Buildings PMTiles.');
            setShowGoogleBuildings(false);
        }
    }, [showGoogleBuildings]);"""

content = content.replace(insert_marker, insert_marker + osm_code)

with open(r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 2/3 complete: Added OSM useEffect hooks')
