
import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { Map as MapIcon, Navigation, Trash2, Settings, CheckCircle, Layers, Disc, Box, Spline, CircleDot, Activity, MousePointerClick, User, Users, Eraser, Search, FileText, Hash, GraduationCap, Stethoscope, Sprout, Zap, Mountain, Home } from 'lucide-react';
import { HydraulicInputs, SystemSpecs, BoQItem, PipelineProfile, SystemGeometry, ProjectDetails } from '../types';
import { DESIGN_COSTS, INSTITUTIONAL_DEMAND } from '../constants';
import { deserialize } from 'flatgeobuf/lib/mjs/geojson';

interface SiteMapProps {
    population: number;
    setPopulation: (pop: number) => void;
    projectDetails: ProjectDetails;
    setProjectDetails: React.Dispatch<React.SetStateAction<ProjectDetails>>;
    inputs: HydraulicInputs;
    setInputs: React.Dispatch<React.SetStateAction<HydraulicInputs>>;
    onUpdateCalc: (specs: SystemSpecs, boq: BoQItem[], profiles: PipelineProfile[], geometry: SystemGeometry) => void;
    onApplyDesign: (civilCost: number, equipCost: number, pipeLength: number) => void;
}

type ToolType = 'select' | 'borehole' | 'tank' | 'tap' | 'pipeMain' | 'delete' | 'school' | 'clinic' | 'garden' | 'grid';
type MapStyle = 'street' | 'satellite' | 'topo' | 'hybrid';

// --- Helper: Country from Bounds ---
function getCountryFromBounds(lat: number, lng: number): string {
    if (lat >= -17.1 && lat <= -9.4 && lng >= 32.7 && lng <= 36.0) return 'MWI';
    if (lat >= -18.0 && lat <= -8.2 && lng >= 22.0 && lng <= 33.7) return 'ZMB';
    if (lat >= -11.7 && lat <= -1.0 && lng >= 29.3 && lng <= 40.5) return 'TZA';
    if (lat >= -26.9 && lat <= -10.5 && lng >= 30.2 && lng <= 41.0) return 'MOZ';
    if (lat >= -1.5 && lat <= 4.2 && lng >= 29.5 && lng <= 35.0) return 'UGA';
    if (lat >= -4.7 && lat <= 5.5 && lng >= 33.9 && lng <= 41.9) return 'KEN';
    if (lat >= -2.9 && lat <= -1.0 && lng >= 28.8 && lng <= 30.9) return 'RWA';
    if (lat >= -22.4 && lat <= -15.6 && lng >= 25.2 && lng <= 33.1) return 'ZWE';
    return 'MWI'; // Default
}

// --- Helper: Closest Point on Segment ---
function getClosestPointOnSegment(p: L.LatLng, a: L.LatLng, b: L.LatLng) {
    const x = p.lat;
    const y = p.lng;
    const x1 = a.lat;
    const y1 = a.lng;
    const x2 = b.lat;
    const y2 = b.lng;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    return new L.LatLng(xx, yy);
}

export const SiteMap: React.FC<SiteMapProps> = ({ population, setPopulation, projectDetails, setProjectDetails, inputs, setInputs, onUpdateCalc, onApplyDesign }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);

    const activeToolRef = useRef<ToolType>('select');
    const [activeTool, setActiveTool] = useState<ToolType>('select');

    const features = useRef<{
        borehole: { marker: L.Marker, elev: number | null } | null;
        tank: { marker: L.Marker, elev: number | null } | null;
        taps: { marker: L.Marker, elev: number | null, id: string }[];
        institutions: { marker: L.Marker, type: 'school' | 'clinic' | 'garden' | 'grid', id: string }[];
        mainLines: { poly: L.Polyline, id: string }[];
        risingMain: L.Polyline | null;
        distLines: L.Polyline[];
        tempLine: L.Polyline | null;
    }>({
        borehole: null,
        tank: null,
        taps: [],
        institutions: [],
        mainLines: [],
        risingMain: null,
        distLines: [],
        tempLine: null
    });

    // Default to street view
    const [mapStyle, setMapStyle] = useState<MapStyle>('street');
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentSegment, setCurrentSegment] = useState<L.LatLng[]>([]);
    const currentSegmentRef = useRef<L.LatLng[]>([]); // Ref for event listeners

    const [loadingElevation, setLoadingElevation] = useState(false);
    const [counts, setCounts] = useState({ taps: 0, mainLen: 0, risingLen: 0, distLen: 0, hasBh: false, hasTank: false, schools: 0, clinics: 0, gardens: 0, hasGrid: false });

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);

    // Building Footprints State
    const [showOSMBuildings, setShowOSMBuildings] = useState(false);
    const [showGoogleBuildings, setShowGoogleBuildings] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('MWI'); // Default to Malawi
    const [buildingsLoading, setBuildingsLoading] = useState(false);

    // Spatial Analysis State
    const [bufferDistance, setBufferDistance] = useState(50); // meters
    const [peoplePerBuilding, setPeoplePerBuilding] = useState(5);
    const [servedPop, setServedPop] = useState(0);
    const [unservedPop, setUnservedPop] = useState(0);
    const osmBuildingLayerRef = useRef<L.LayerGroup | null>(null);
    const visualBufferLayerRef = useRef<L.LayerGroup | null>(null);
    const googleBuildingLayerRef = useRef<L.LayerGroup | null>(null);

    // Sync Ref
    useEffect(() => { currentSegmentRef.current = currentSegment; }, [currentSegment]);
    const selectedCountryRef = useRef(selectedCountry);
    useEffect(() => { selectedCountryRef.current = selectedCountry; }, [selectedCountry]);

    // -- Icons --
    const icons = useRef({
        bh: L.divIcon({
            className: 'bg-blue-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white font-bold text-[10px]',
            html: 'BH', iconSize: [30, 30], iconAnchor: [15, 15]
        }),
        tank: L.divIcon({
            className: 'bg-cyan-500 border-2 border-white rounded shadow-lg flex items-center justify-center text-white font-bold text-[10px]',
            html: 'T', iconSize: [28, 28], iconAnchor: [14, 14]
        }),
        tap: L.divIcon({
            className: 'bg-emerald-500 border-2 border-white rounded-full shadow-md',
            iconSize: [16, 16], iconAnchor: [8, 8]
        }),
        school: L.divIcon({
            className: 'bg-purple-600 border-2 border-white rounded shadow-md flex items-center justify-center',
            html: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        }),
        clinic: L.divIcon({
            className: 'bg-red-500 border-2 border-white rounded-full shadow-md flex items-center justify-center',
            html: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        }),
        garden: L.divIcon({
            className: 'bg-green-600 border-2 border-white rounded shadow-md flex items-center justify-center',
            html: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        }),
        grid: L.divIcon({
            className: 'bg-amber-500 border-2 border-white rounded-full shadow-md flex items-center justify-center',
            html: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            iconSize: [32, 32], iconAnchor: [16, 16]
        })
    });

    const fetchElevation = async (lat: number, lng: number): Promise<number | null> => {
        try {
            setLoadingElevation(true);
            const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
            const data = await res.json();
            setLoadingElevation(false);
            if (data.elevation && data.elevation.length > 0) return data.elevation[0];
            return null;
        } catch (e) {
            console.error("Elevation fetch failed", e);
            setLoadingElevation(false);
            return null;
        }
    };

    const fetchPathElevations = async (points: L.LatLng[]): Promise<number[]> => {
        if (points.length === 0) return [];
        const lats = points.map(p => p.lat).join(',');
        const lngs = points.map(p => p.lng).join(',');
        try {
            setLoadingElevation(true);
            const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
            const data = await res.json();
            setLoadingElevation(false);
            return data.elevation || [];
        } catch (e) {
            console.error("Bulk elevation fetch failed", e);
            setLoadingElevation(false);
            return points.map(() => 0); // Fallback
        }
    };

    const fetchLocationName = async (lat: number, lng: number) => {
        try {
            // Reverse Geocoding to get Village/Town name
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            const address = data.address;
            if (address) {
                // Prioritize village, hamlet, town, etc.
                const name = address.village || address.hamlet || address.town || address.suburb || address.city || address.locality || "Unknown Site";
                return name;
            }
            return null;
        } catch (e) {
            console.error("Reverse geocoding failed", e);
            return null;
        }
    };

    // Search Handler
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim() || !mapInstanceRef.current) return;

        setSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`, {
                headers: {
                    'User-Agent': 'WaterSupplyComparisonTool/1.0',
                    'Referer': 'https://github.com/your-repo' // Optional but good practice
                }
            });
            const data = await res.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                mapInstanceRef.current.flyTo([parseFloat(lat), parseFloat(lon)], 15, { duration: 1.5 });
            } else {
                alert("Location not found");
            }
        } catch (err) {
            console.error(err);
            alert("Error searching for location. Please check your internet connection.");
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Use preferCanvas: true for better PDF rendering
        // Changed initial view to Malawi Country Level (Zoom 7)
        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
            doubleClickZoom: false,
            preferCanvas: true
        }).setView([-13.25, 34.3], 7);

        mapInstanceRef.current = map;
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

        // Initial layer based on state (street)
        const url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        L.tileLayer(url, {
            attribution: 'Map data',
            maxZoom: 22,
            crossOrigin: true
        }).addTo(map);

        setTimeout(() => { map.invalidateSize(); }, 500);

        // EVENTS
        map.on('click', async (e) => {
            const tool = activeToolRef.current;
            const latlng = e.latlng;

            if (tool === 'select' || tool === 'delete') return;

            if (tool === 'borehole') {
                if (features.current.borehole?.marker) features.current.borehole.marker.remove();
                const m = L.marker(latlng, { icon: icons.current.bh, draggable: true }).addTo(map);
                m.on('click', () => { if (activeToolRef.current === 'delete') { m.remove(); features.current.borehole = null; setInputs(prev => ({ ...prev, boreholeElevation: undefined })); recalcAutoConnections(); } });

                // Helper for handling placement and reverse geocoding
                const handleBoreholeUpdate = async (lat: number, lng: number) => {
                    const elev = await fetchElevation(lat, lng);
                    if (features.current.borehole) features.current.borehole.elev = elev;
                    if (elev !== null) setInputs(prev => ({ ...prev, boreholeElevation: elev }));

                    // Auto-name site if empty using Reverse Geocoding
                    setProjectDetails(current => {
                        if (!current.siteName) {
                            fetchLocationName(lat, lng).then(name => {
                                if (name) setProjectDetails(prev => ({ ...prev, siteName: name }));
                            });
                        }
                        return current;
                    });

                    recalcAutoConnections();
                };

                m.on('dragend', async () => {
                    const ll = m.getLatLng();
                    await handleBoreholeUpdate(ll.lat, ll.lng);
                });

                const elev = await fetchElevation(latlng.lat, latlng.lng);
                features.current.borehole = { marker: m, elev };
                await handleBoreholeUpdate(latlng.lat, latlng.lng); // Handle initial placement logic (elev + naming)
            }
            else if (tool === 'tank') {
                if (features.current.tank?.marker) features.current.tank.marker.remove();
                const m = L.marker(latlng, { icon: icons.current.tank, draggable: true }).addTo(map);
                m.on('click', () => { if (activeToolRef.current === 'delete') { m.remove(); features.current.tank = null; setInputs(prev => ({ ...prev, tankElevation: undefined })); recalcAutoConnections(); } });
                m.on('dragend', async () => {
                    const ll = m.getLatLng();
                    const elev = await fetchElevation(ll.lat, ll.lng);
                    if (features.current.tank) features.current.tank.elev = elev;
                    if (elev !== null) setInputs(prev => ({ ...prev, tankElevation: elev }));
                    recalcAutoConnections();
                });
                const elev = await fetchElevation(latlng.lat, latlng.lng);
                features.current.tank = { marker: m, elev };
                if (elev !== null) setInputs(prev => ({ ...prev, tankElevation: elev }));
                recalcAutoConnections();
            }
            else if (tool === 'tap') {
                const m = L.marker(latlng, { icon: icons.current.tap, draggable: true }).addTo(map);
                const id = Math.random().toString(36).substr(2, 9);
                m.on('click', () => { if (activeToolRef.current === 'delete') { m.remove(); features.current.taps = features.current.taps.filter(t => t.id !== id); recalcAutoConnections(); } });
                m.on('dragend', async () => {
                    const ll = m.getLatLng();
                    const tap = features.current.taps.find(t => t.id === id);
                    if (tap) { tap.elev = await fetchElevation(ll.lat, ll.lng); }
                    recalcAutoConnections();
                });
                const elev = await fetchElevation(latlng.lat, latlng.lng);
                features.current.taps.push({ marker: m, elev, id });
                recalcAutoConnections();
            }
            else if (['school', 'clinic', 'garden', 'grid'].includes(tool)) {
                const icon = tool === 'school' ? icons.current.school : tool === 'clinic' ? icons.current.clinic : tool === 'garden' ? icons.current.garden : icons.current.grid;
                const m = L.marker(latlng, { icon: icon, draggable: true }).addTo(map);
                const id = Math.random().toString(36).substr(2, 9);

                m.on('click', () => {
                    if (activeToolRef.current === 'delete') {
                        m.remove();
                        features.current.institutions = features.current.institutions.filter(t => t.id !== id);
                        recalcAutoConnections();
                    }
                });
                m.on('dragend', () => recalcAutoConnections()); // Repositioning changes connections potentially

                features.current.institutions.push({ marker: m, type: tool as any, id });
                recalcAutoConnections();
            }
            else if (tool === 'pipeMain') {
                let point = latlng;
                let newSeg = [...currentSegmentRef.current];
                if (newSeg.length === 0 && features.current.tank) {
                    const tankLL = features.current.tank.marker.getLatLng();
                    newSeg.push(tankLL);
                }
                newSeg.push(point);
                setCurrentSegment(newSeg);
                setIsDrawing(true);
            }
        });

        map.on('mousemove', (e) => {
            if (currentSegmentRef.current.length > 0 && activeToolRef.current === 'pipeMain') {
                const lastPt = currentSegmentRef.current[currentSegmentRef.current.length - 1];
                if (!features.current.tempLine) {
                    features.current.tempLine = L.polyline([lastPt, e.latlng], { color: '#ef4444', dashArray: '5, 10' }).addTo(map);
                } else {
                    features.current.tempLine.setLatLngs([lastPt, e.latlng]);
                }
            }
        });

        map.on('dblclick', (e) => {
            if (activeToolRef.current === 'pipeMain') {
                L.DomEvent.stopPropagation(e);
                finishSegment();
            }
        });

        // Auto-select country on move
        map.on('moveend', () => {
            const center = map.getCenter();
            const newCountry = getCountryFromBounds(center.lat, center.lng);

            if (newCountry !== selectedCountryRef.current) {
                // Update state if country changes based on map center
                setSelectedCountry(newCountry);
            }
        });

        return () => { };
    }, []);

    useEffect(() => {
        if (!mapContainerRef.current || !mapInstanceRef.current) return;
        const resizeObserver = new ResizeObserver(() => {
            mapInstanceRef.current?.invalidateSize();
        });
        resizeObserver.observe(mapContainerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

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

                    osmBuildingLayerRef.current = layer.addTo(mapInstanceRef.current!);
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

    // Google Buildings Layer (FlatGeobuf)
    useEffect(() => {
        console.log('Google Buildings Effect Triggered. Show:', showGoogleBuildings, 'Map:', !!mapInstanceRef.current);
        if (!mapInstanceRef.current || !showGoogleBuildings) return;

        let buildingsLayer: any = null;

        const loadGoogleBuildings = async () => {
            try {
                const fgbUrl = `https://data.source.coop/vida/google-microsoft-open-buildings/flatgeobuf/by_country/country_iso=${selectedCountry}/${selectedCountry}.fgb`;
                console.log(`Loading Google Buildings (FGB) for ${selectedCountry}: ${fgbUrl}`);

                // Check if resource is reachable before trying to deserialize
                try {
                    const headRes = await fetch(fgbUrl, { method: 'HEAD' });
                    if (!headRes.ok) {
                        throw new Error(`FGB URL not reachable: ${headRes.status} ${headRes.statusText}`);
                    }
                } catch (netErr) {
                    console.warn("Network check failed for FGB, trying to proceed anyway...", netErr);
                }

                // Create a GeoJSON layer
                buildingsLayer = L.geoJSON(null, {
                    style: {
                        fillColor: '#1CABE2',
                        fillOpacity: 0.6,
                        color: '#003E5E',
                        weight: 1
                    }
                });

                if (mapInstanceRef.current) {
                    buildingsLayer.addTo(mapInstanceRef.current);

                    // Function to update features based on bounds
                    const updateFeatures = async () => {
                        if (!mapInstanceRef.current) return;
                        const bounds = mapInstanceRef.current.getBounds();
                        const rect = {
                            minX: bounds.getWest(),
                            minY: bounds.getSouth(),
                            maxX: bounds.getEast(),
                            maxY: bounds.getNorth()
                        };

                        // Clear existing layers to avoid duplicates/memory issues
                        buildingsLayer.clearLayers();

                        try {
                            // Use flatgeobuf to fetch features in bounds
                            // Note: deserialize uses fetch internally with Range headers
                            const iter = deserialize(fgbUrl, rect);
                            let count = 0;
                            for await (const feature of iter) {
                                buildingsLayer.addData(feature as any);
                                count++;
                            }
                            console.log(`Loaded ${count} Google Buildings features`);

                            if (count === 0) {
                                console.log("No buildings found in this area (or FGB load failed silently).");
                            }
                        } catch (e) {
                            console.error('Error fetching FGB features:', e);
                            // Do not alert constantly on move
                        }
                    };

                    // Initial load
                    updateFeatures();

                    // Add event listener for map movement
                    mapInstanceRef.current.on('moveend', updateFeatures);

                    // Store reference for cleanup
                    (buildingsLayer as any)._updateFeatures = updateFeatures;
                }
            } catch (error) {
                console.error('Failed to load Google Buildings:', error);
                alert(`Google Buildings failed to load for ${selectedCountry}. Please check your internet connection or try OSM Buildings.`);
                setShowGoogleBuildings(false);
                setShowOSMBuildings(true);
            } finally {
                setBuildingsLoading(false);
            }
        };

        setBuildingsLoading(true);
        loadGoogleBuildings();

        return () => {
            if (buildingsLayer) {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.removeLayer(buildingsLayer);
                    if ((buildingsLayer as any)._updateFeatures) {
                        mapInstanceRef.current.off('moveend', (buildingsLayer as any)._updateFeatures);
                    }
                }
                buildingsLayer = null;
            }
        };
    }, [showGoogleBuildings, selectedCountry]);

    // Map Style Layer
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        let url = '';
        let labelsUrl = '';

        if (mapStyle === 'street') {
            url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        } else if (mapStyle === 'satellite') {
            url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        } else if (mapStyle === 'topo') {
            // OpenTopoMap for hydraulic planning
            url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
        } else if (mapStyle === 'hybrid') {
            url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            labelsUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
        }

        // Update TileLayer with crossOrigin for PDF export compatibility
        const tileLayer = L.tileLayer(url, {
            attribution: mapStyle === 'topo' ? 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)' : 'Map data',
            maxZoom: 22,
            crossOrigin: true
        }).addTo(mapInstanceRef.current);

        let labelsLayer: L.TileLayer | null = null;
        if (labelsUrl) {
            labelsLayer = L.tileLayer(labelsUrl, {
                maxZoom: 22,
                crossOrigin: true,
                zIndex: 1000 // Ensure labels are on top
            }).addTo(mapInstanceRef.current);
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(tileLayer);
                if (labelsLayer) mapInstanceRef.current.removeLayer(labelsLayer);
            }
        };
    }, [mapStyle]);

    useEffect(() => { recalcAutoConnections(); }, [inputs, population]);

    const finishSegment = () => {
        const seg = currentSegmentRef.current;
        if (seg.length < 2) return;
        const cleanSeg = seg.filter((p, i) => i === 0 || p.distanceTo(seg[i - 1]) > 0.1);

        if (cleanSeg.length > 1) {
            const id = Math.random().toString(36).substr(2, 9);
            const poly = L.polyline(cleanSeg, { color: '#ef4444', weight: 4 }).addTo(mapInstanceRef.current!);
            poly.on('click', (e) => {
                if (activeToolRef.current === 'delete') {
                    L.DomEvent.stopPropagation(e);
                    poly.remove();
                    features.current.mainLines = features.current.mainLines.filter(ml => ml.id !== id);
                    recalcAutoConnections();
                }
            });
            features.current.mainLines.push({ poly, id });
        }

        setCurrentSegment([]);
        setIsDrawing(false);
        if (features.current.tempLine) { features.current.tempLine.remove(); features.current.tempLine = null; }
        recalcAutoConnections();
    };

    const recalcAutoConnections = () => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Rising Main
        if (features.current.borehole && features.current.tank) {
            const bhLL = features.current.borehole.marker.getLatLng();
            const tankLL = features.current.tank.marker.getLatLng();
            if (features.current.risingMain) features.current.risingMain.remove();
            features.current.risingMain = L.polyline([bhLL, tankLL], { color: '#3b82f6', weight: 5, opacity: 0.8 }).addTo(map);
        } else {
            if (features.current.risingMain) { features.current.risingMain.remove(); features.current.risingMain = null; }
        }

        // Distribution Lines
        features.current.distLines.forEach(l => l.remove());
        features.current.distLines = [];

        const connectableFeatures = [...features.current.taps, ...features.current.institutions.filter(i => i.type !== 'grid')];

        if (features.current.mainLines.length > 0 || features.current.tank) {
            connectableFeatures.forEach(feature => {
                const featLL = feature.marker.getLatLng();
                let minDist = Infinity;
                let connectPt: L.LatLng | null = null;

                features.current.mainLines.forEach(ml => {
                    const pts = ml.poly.getLatLngs() as L.LatLng[];
                    const flatPts: L.LatLng[] = Array.isArray(pts[0]) ? (pts as any).flat() : pts;
                    if (flatPts.length > 0 && 'lat' in flatPts[0]) {
                        for (let i = 0; i < flatPts.length - 1; i++) {
                            const closest = getClosestPointOnSegment(featLL, flatPts[i], flatPts[i + 1]);
                            const dist = featLL.distanceTo(closest);
                            if (dist < minDist) { minDist = dist; connectPt = closest; }
                        }
                    }
                });

                if (features.current.tank) {
                    const tLoc = features.current.tank.marker.getLatLng();
                    const dist = featLL.distanceTo(tLoc);
                    if (dist < minDist) { minDist = dist; connectPt = tLoc; }
                }

                if (connectPt) {
                    const line = L.polyline([featLL, connectPt], { color: '#10b981', weight: 2, dashArray: '5, 5' }).addTo(map);
                    features.current.distLines.push(line);
                }
            });
        }

        performCalculations();
    };

    const calculateHeadLoss = (lengthM: number, flowRateM3H: number, diameterMM: number) => {
        const Q = flowRateM3H / 3600; // m3/s
        const D = diameterMM / 1000; // m
        const C = 140; // HDPE Roughness
        if (Q === 0 || D === 0) return 0;
        return 10.67 * lengthM * Math.pow(Q, 1.852) * Math.pow(C, -1.852) * Math.pow(D, -4.87);
    };

    const generateProfiles = async (flowRateM3H: number): Promise<PipelineProfile[]> => {
        const profiles: PipelineProfile[] = [];
        // 1. Rising Main
        if (features.current.borehole && features.current.tank && features.current.risingMain) {
            const pts = features.current.risingMain.getLatLngs() as L.LatLng[];
            const elevs = await fetchPathElevations(pts);
            const dists: number[] = [];
            let totalDist = 0;
            pts.forEach((p, i) => {
                if (i > 0) totalDist += p.distanceTo(pts[i - 1]);
                dists.push(totalDist);
            });
            const totalHeadLoss = calculateHeadLoss(totalDist, flowRateM3H, 63);
            const startHGL = (features.current.tank.elev || 0) + inputs.tankHeight + totalHeadLoss;
            const data = pts.map((p, i) => {
                const currentHGL = startHGL - ((dists[i] / totalDist) * totalHeadLoss);
                const groundElev = (elevs[i] || 0);
                return {
                    dist: dists[i],
                    elevation: groundElev,
                    hgl: currentHGL,
                    pressure: currentHGL - (groundElev - 1),
                    risk: (currentHGL - (groundElev - 1) < 0 ? 'negative_pressure' : (currentHGL - (groundElev - 1) > 100 ? 'high_pressure' : null)) as 'high_pressure' | 'negative_pressure' | null
                };
            });
            profiles.push({ id: 'rising', name: 'Rising Main', data });
        }
        // 2. Main Lines
        for (let i = 0; i < features.current.mainLines.length; i++) {
            const ml = features.current.mainLines[i];
            const pts = ml.poly.getLatLngs() as L.LatLng[];
            const flatPts = (Array.isArray(pts[0]) && !('lat' in pts[0])) ? (pts as any).flat() : pts;
            const elevs = await fetchPathElevations(flatPts);
            const startHGL = (features.current.tank?.elev || 0) + inputs.tankHeight;
            let cumDist = 0;
            const data = flatPts.map((p: L.LatLng, idx: number) => {
                if (idx > 0) cumDist += p.distanceTo(flatPts[idx - 1]);
                const headLoss = calculateHeadLoss(cumDist, flowRateM3H, 63);
                const currentHGL = startHGL - headLoss;
                const groundElev = elevs[idx] || 0;
                return {
                    dist: cumDist,
                    elevation: groundElev,
                    hgl: currentHGL,
                    pressure: currentHGL - (groundElev - 1),
                    risk: (currentHGL - (groundElev - 1) < 0 ? 'negative_pressure' : (currentHGL - (groundElev - 1) > 100 ? 'high_pressure' : null)) as 'high_pressure' | 'negative_pressure' | null
                };
            });
            profiles.push({ id: ml.id, name: `Main Line ${i + 1}`, data });
        }
        return profiles;
    }

    const performCalculations = (generatedProfiles: PipelineProfile[] = []) => {
        // Lengths
        let rLen = 0;
        if (features.current.risingMain) {
            const pts = features.current.risingMain.getLatLngs() as L.LatLng[];
            rLen = pts[0].distanceTo(pts[1]);
        }

        let mLen = 0;
        features.current.mainLines.forEach(ml => {
            const pts = ml.poly.getLatLngs() as L.LatLng[];
            const flatPts = (Array.isArray(pts[0]) && !('lat' in pts[0])) ? (pts as any).flat() : pts;
            for (let i = 0; i < flatPts.length - 1; i++) mLen += flatPts[i].distanceTo(flatPts[i + 1]);
        });

        let dLen = 0;
        features.current.distLines.forEach(dl => {
            const pts = dl.getLatLngs() as L.LatLng[];
            dLen += pts[0].distanceTo(pts[1]);
        });

        const totalPipeLen = rLen + mLen + dLen;

        // Institutional Counts & Demand
        const countSchools = features.current.institutions.filter(i => i.type === 'school').length;
        const countClinics = features.current.institutions.filter(i => i.type === 'clinic').length;
        const countGardens = features.current.institutions.filter(i => i.type === 'garden').length;
        const hasGrid = features.current.institutions.some(i => i.type === 'grid');

        const domesticDemandM3 = (population * inputs.dailyDemandPerCapita) / 1000;
        const institutionalDemandM3 = (
            (countSchools * INSTITUTIONAL_DEMAND.SCHOOL) +
            (countClinics * INSTITUTIONAL_DEMAND.CLINIC) +
            (countGardens * INSTITUTIONAL_DEMAND.GARDEN)
        ) / 1000;

        const dailyDemandM3 = domesticDemandM3 + institutionalDemandM3;
        const flowRateM3H = dailyDemandM3 / inputs.peakSunHours;

        setCounts({
            taps: features.current.taps.length,
            risingLen: Math.round(rLen),
            mainLen: Math.round(mLen),
            distLen: Math.round(dLen),
            hasBh: !!features.current.borehole,
            hasTank: !!features.current.tank,
            schools: countSchools,
            clinics: countClinics,
            gardens: countGardens,
            hasGrid: hasGrid
        });

        // Extract Geometry
        const geometry: SystemGeometry = {
            center: mapInstanceRef.current ? mapInstanceRef.current.getCenter() : { lat: -13.2543, lng: 34.3015 },
            zoom: mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 7,
            borehole: features.current.borehole ? features.current.borehole.marker.getLatLng() : null,
            tank: features.current.tank ? features.current.tank.marker.getLatLng() : null,
            taps: features.current.taps.map((t, i) => ({ ...t.marker.getLatLng(), id: t.id, label: `Tap ${i + 1}` })),
            institutions: features.current.institutions.map((inst, i) => ({
                ...inst.marker.getLatLng(),
                id: inst.id,
                label: inst.type.charAt(0).toUpperCase() + inst.type.slice(1),
                type: inst.type
            })),
            lines: []
        };

        if (features.current.risingMain) {
            const pts = features.current.risingMain.getLatLngs() as L.LatLng[];
            geometry.lines.push({
                path: pts.map(p => ({ lat: p.lat, lng: p.lng })),
                type: 'rising',
                label: `Rising Main (${Math.round(rLen)}m)`
            });
        }
        features.current.mainLines.forEach((ml, i) => {
            const pts = ml.poly.getLatLngs() as L.LatLng[];
            const flatPts = (Array.isArray(pts[0]) && !('lat' in pts[0])) ? (pts as any).flat() : pts;
            let segLen = 0;
            for (let k = 0; k < flatPts.length - 1; k++) segLen += flatPts[k].distanceTo(flatPts[k + 1]);
            geometry.lines.push({
                path: flatPts.map(p => ({ lat: p.lat, lng: p.lng })),
                type: 'main',
                label: `Main Line ${i + 1} (${Math.round(segLen)}m)`
            });
        });
        features.current.distLines.forEach((dl) => {
            const pts = dl.getLatLngs() as L.LatLng[];
            geometry.lines.push({ path: pts.map(p => ({ lat: p.lat, lng: p.lng })), type: 'dist', label: 'Distribution' });
        });

        // Engineering
        let staticHead = inputs.staticWaterLevel + inputs.tankHeight;
        let elevDiff = inputs.elevationDifference;
        if (features.current.borehole?.elev && features.current.tank?.elev) {
            elevDiff = Math.max(0, features.current.tank.elev - features.current.borehole.elev);
            staticHead = inputs.staticWaterLevel + elevDiff + inputs.tankHeight;
        }
        const frictionHead = totalPipeLen * inputs.frictionLossFactor;
        const totalDynamicHead = staticHead + frictionHead;
        const hydraulicPowerKW = (flowRateM3H * totalDynamicHead * 9.81) / (3600 * inputs.pumpEfficiency);
        const pumpPowerKW = hydraulicPowerKW * 1.2;
        const pvArrayKW = pumpPowerKW * 1.5;

        const specs: SystemSpecs = {
            dailyDemandM3, domesticDemandM3, institutionalDemandM3, totalDynamicHead, flowRateM3H, pumpPowerKW, pvArrayKW, pipeDiameterMM: 63,
            countSchools, countClinics, countGardens, hasGrid
        };

        // Generate BoQ
        const boq: BoQItem[] = [];
        // Civils
        boq.push({ id: 'c1', category: 'Civils', item: 'Borehole Drilling & Construction', unit: 'm', qty: inputs.boreholeDepth, rate: DESIGN_COSTS.DRILLING_PER_M, amount: Math.round(inputs.boreholeDepth * DESIGN_COSTS.DRILLING_PER_M) });
        boq.push({ id: 'c2', category: 'Civils', item: 'Borehole Siting & Mob/Demob', unit: 'LS', qty: 1, rate: DESIGN_COSTS.DRILLING_BASE, amount: Math.round(DESIGN_COSTS.DRILLING_BASE) });
        boq.push({ id: 'c3', category: 'Civils', item: `Tank Stand (${inputs.tankHeight}m) & Base`, unit: 'Sum', qty: 1, rate: DESIGN_COSTS.TANK_STAND_6M, amount: Math.round(DESIGN_COSTS.TANK_STAND_6M) });
        boq.push({ id: 'c4', category: 'Civils', item: 'Fencing & Site Works', unit: 'Sum', qty: 1, rate: DESIGN_COSTS.FENCE_CIVILS, amount: Math.round(DESIGN_COSTS.FENCE_CIVILS) });
        boq.push({ id: 'c5', category: 'Civils', item: 'Tap Stand Construction', unit: 'No', qty: counts.taps, rate: DESIGN_COSTS.DISTRIBUTION_POINTS, amount: Math.round(counts.taps * DESIGN_COSTS.DISTRIBUTION_POINTS) });

        // Network
        boq.push({ id: 'n1', category: 'Network', item: 'Trenching & Backfill', unit: 'm', qty: Math.round(totalPipeLen), rate: DESIGN_COSTS.TRENCHING_PER_M, amount: Math.round(totalPipeLen * DESIGN_COSTS.TRENCHING_PER_M) });
        if (rLen > 0) boq.push({ id: 'n2', category: 'Network', item: 'Rising Main (HDPE 63mm)', unit: 'm', qty: Math.round(rLen), rate: DESIGN_COSTS.PIPE_HDPE_63MM, amount: Math.round(Math.round(rLen) * DESIGN_COSTS.PIPE_HDPE_63MM) });
        if (mLen > 0) boq.push({ id: 'n3', category: 'Network', item: 'Main Line (HDPE 63mm)', unit: 'm', qty: Math.round(mLen), rate: DESIGN_COSTS.PIPE_HDPE_63MM, amount: Math.round(Math.round(mLen) * DESIGN_COSTS.PIPE_HDPE_63MM) });
        if (dLen > 0) boq.push({ id: 'n4', category: 'Network', item: 'Distribution (HDPE 32mm)', unit: 'm', qty: Math.round(dLen), rate: DESIGN_COSTS.PIPE_HDPE_32MM, amount: Math.round(Math.round(dLen) * DESIGN_COSTS.PIPE_HDPE_32MM) });

        // Institutional connections
        const instCount = countSchools + countClinics + countGardens;
        if (instCount > 0) {
            boq.push({ id: 'n5', category: 'Network', item: 'Institution Connections (Fittings/Meter)', unit: 'No', qty: instCount, rate: DESIGN_COSTS.INSTITUTION_CONNECTION, amount: instCount * DESIGN_COSTS.INSTITUTION_CONNECTION });
        }

        // Mechanical
        const tankCost = DESIGN_COSTS.TANK_STEEL_BASE + (dailyDemandM3 * DESIGN_COSTS.TANK_PER_M3);
        boq.push({ id: 'm1', category: 'Mechanical', item: `Steel Tank (${Math.ceil(dailyDemandM3)}m3)`, unit: 'No', qty: 1, rate: Math.round(tankCost), amount: Math.round(tankCost) });
        const pumpCost = DESIGN_COSTS.PUMP_BASE + (pumpPowerKW * DESIGN_COSTS.PUMP_PER_KW);
        boq.push({ id: 'm2', category: 'Mechanical', item: `Submersible Pump (${pumpPowerKW.toFixed(1)}kW)`, unit: 'No', qty: 1, rate: Math.round(pumpCost), amount: Math.round(pumpCost) });

        // Electrical
        const pvCost = DESIGN_COSTS.PV_STRUCTURE_BASE + (pvArrayKW * DESIGN_COSTS.PV_PER_KW);
        boq.push({ id: 'e1', category: 'Electrical', item: `Solar Array (${pvArrayKW.toFixed(2)}kWp) & Structure`, unit: 'kW', qty: Math.ceil(pvArrayKW), rate: DESIGN_COSTS.PV_PER_KW, amount: Math.round(pvCost) });
        boq.push({ id: 'e2', category: 'Electrical', item: 'Solar Pump Inverter/Controller', unit: 'No', qty: 1, rate: 1500, amount: 1500 });
        if (hasGrid) {
            boq.push({ id: 'e3', category: 'Electrical', item: 'Mini-Grid Kiosk / Charging Station', unit: 'Sum', qty: 1, rate: 4500, amount: 4500 });
        }

        generateProfiles(flowRateM3H).then(profiles => {
            onUpdateCalc(specs, boq, profiles, geometry);
        });
    };

    const handleApply = () => {
        performCalculations();
        const civils = (inputs.boreholeDepth * DESIGN_COSTS.DRILLING_PER_M) + DESIGN_COSTS.DRILLING_BASE + DESIGN_COSTS.TANK_STAND_6M + DESIGN_COSTS.FENCE_CIVILS + (counts.taps * DESIGN_COSTS.DISTRIBUTION_POINTS) + ((counts.risingLen + counts.mainLen + counts.distLen) * DESIGN_COSTS.TRENCHING_PER_M);
        const equip = 25000;
        onApplyDesign(civils, equip, counts.risingLen + counts.mainLen + counts.distLen);
    };

    // Tool Button Component
    const ToolButton = ({ tool, icon: Icon, label }: { tool: ToolType, icon: any, label: string }) => (
        <button
            onClick={() => {
                setActiveTool(tool);
                setIsDrawing(false);
                setCurrentSegment([]);
                if (features.current.tempLine) { features.current.tempLine.remove(); features.current.tempLine = null; }
            }}
            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all w-full md:w-auto min-w-[60px] ${activeTool === tool ? 'bg-blue-600 text-white shadow-md transform scale-105' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            title={label}
        >
            <Icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
        </button>
    );


    // Spatial Analysis Logic
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

        // Collect all point features (Taps, Schools, Clinics, Gardens)
        const pointFeatures: L.LatLng[] = [
            ...features.current.taps.map(t => t.marker.getLatLng()),
            ...features.current.institutions.map(i => i.marker.getLatLng())
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
            const len = Math.sqrt(dx * dx + dy * dy);

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

        if (pipes.length === 0 && pointFeatures.length === 0) {
            // No pipes or points, all unserved
            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.setStyle) layer.setStyle({ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 });
                unservedCount++;
            });
        } else {
            // Draw Visual Buffer for Point Features
            pointFeatures.forEach(pt => {
                L.circle(pt, { radius: bufferDistance, color: '#22c55e', weight: 0, fillOpacity: 0.2, interactive: false }).addTo(visualBufferLayerRef.current!);
            });

            // Draw Visual Buffer (Polygons for segments + Circles for joints)
            pipes.forEach(pipe => {
                const latlngs = pipe.getLatLngs() as L.LatLng[];

                // Draw circles at vertices (joints)
                latlngs.forEach(ll => {
                    L.circle(ll, { radius: bufferDistance, color: '#22c55e', weight: 0, fillOpacity: 0.2, interactive: false }).addTo(visualBufferLayerRef.current!);
                });

                // Draw buffer polygons for segments
                for (let i = 0; i < latlngs.length - 1; i++) {
                    const polyCoords = getBufferPolygon(latlngs[i], latlngs[i + 1], bufferDistance);
                    if (polyCoords) {
                        L.polygon(polyCoords as any, { color: '#22c55e', weight: 0, fillOpacity: 0.2, interactive: false }).addTo(visualBufferLayerRef.current!);
                    }
                }
            });

            osmBuildingLayerRef.current.eachLayer((layer: any) => {
                if (layer.feature && layer.feature.geometry.type === 'Polygon') {
                    const bounds = layer.getBounds();
                    const center = bounds.getCenter();

                    let isServed = false;

                    // Check distance to pipes
                    for (const pipe of pipes) {
                        const pipeLatLngs = pipe.getLatLngs() as L.LatLng[];
                        for (let i = 0; i < pipeLatLngs.length - 1; i++) {
                            const dist = getDistToSegmentMeters(center, pipeLatLngs[i], pipeLatLngs[i + 1]);
                            if (dist <= bufferDistance) {
                                isServed = true;
                                break;
                            }
                        }
                        if (isServed) break;
                    }

                    // Check distance to point features (if not already served)
                    if (!isServed) {
                        for (const pt of pointFeatures) {
                            if (center.distanceTo(pt) <= bufferDistance) {
                                isServed = true;
                                break;
                            }
                        }
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

    // Recalc when pipes change

    return (
        <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-140px)] relative">

            {/* 1. ENGINEERING PANEL */}
            <div className="order-2 md:order-1 w-full md:w-80 flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-y-auto max-h-[40%] md:max-h-full">
                <div className="mb-2">
                    <form onSubmit={handleSearch} className="relative mb-2">
                        <input type="text" placeholder="Search Location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1CABE2] outline-none shadow-sm" />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    </form>
                    <h3 className="font-bold text-[#003E5E] flex items-center gap-2 border-b border-gray-200 pb-2"><Settings className="w-4 h-4" /> Design Parameters</h3>
                </div>
                <div className="space-y-4 text-sm">
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
                    <div>
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
                    </div>
                    <div><label className="block text-gray-600 text-xs font-bold mb-1">Borehole Depth (m)</label><input type="number" value={inputs.boreholeDepth} onChange={e => setInputs({ ...inputs, boreholeDepth: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded" /></div>
                    <div><label className="block text-gray-600 text-xs font-bold mb-1">Static Water Level (m)</label><input type="number" value={inputs.staticWaterLevel} onChange={e => setInputs({ ...inputs, staticWaterLevel: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded" /></div>
                    <div><label className="block text-gray-600 text-xs font-bold mb-1">Tank Stand Height (m)</label>
                        <select value={inputs.tankHeight} onChange={e => setInputs({ ...inputs, tankHeight: parseFloat(e.target.value) })} className="w-full p-2 border rounded"><option value={3}>3m</option><option value={6}>6m</option><option value={9}>9m</option></select>
                    </div>
                </div>
                <div className="mt-auto bg-slate-800 text-white p-4 rounded-lg text-xs space-y-2">
                    <div className="flex justify-between"><span>Borehole:</span><span className={counts.hasBh ? "text-emerald-400 font-bold" : "text-gray-500"}>{counts.hasBh ? "Set" : "Missing"}</span></div>
                    <div className="flex justify-between"><span>Tank:</span><span className={counts.hasTank ? "text-emerald-400 font-bold" : "text-gray-500"}>{counts.hasTank ? "Set" : "Missing"}</span></div>
                    <div className="flex justify-between"><span>Taps:</span><span className="font-bold">{counts.taps}</span></div>
                    <div className="flex justify-between"><span>Institutions:</span><span className="font-bold">{counts.schools + counts.clinics + counts.gardens}</span></div>
                    <div className="flex justify-between border-t border-slate-600 pt-2"><span>Total Pipe:</span><span className="font-bold">{(counts.risingLen + counts.mainLen + counts.distLen).toLocaleString()} m</span></div>
                </div>
                <button onClick={handleApply} disabled={!counts.hasBh || !counts.hasTank} className="w-full py-3 bg-[#1CABE2] hover:bg-[#003E5E] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Apply Design</button>
            </div>

            {/* 2. MAP AREA */}
            <div className="order-1 md:order-2 flex-1 relative min-h-[400px] md:h-full bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300">
                <div ref={mapContainerRef} className="w-full h-full z-0 min-h-[400px]" style={{ minHeight: '400px' }} />
                {loadingElevation && <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-blue-600 flex items-center gap-2 z-[400]"><Activity className="w-3 h-3 animate-spin" /> Fetching Elevation...</div>}
                {buildingsLoading && <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-green-600 flex items-center gap-2 z-[400]"><Activity className="w-3 h-3 animate-spin" /> Loading Buildings...</div>}
                <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md border border-gray-200 p-1 flex flex-col gap-1 z-[400]">
                    <div className="flex gap-1">
                        <button onClick={() => { console.log('Toggling OSM Buildings'); setShowOSMBuildings(!showOSMBuildings); }} className={`p-1.5 rounded ${showOSMBuildings ? 'bg-[#1CABE2]/20 text-[#003E5E]' : 'hover:bg-gray-100 text-gray-700'}`} title="OSM Buildings (Development)"><Home className="w-4 h-4" /></button>
                        <button onClick={() => { console.log('Toggling Google Buildings'); setShowGoogleBuildings(!showGoogleBuildings); if (!showGoogleBuildings) setShowOSMBuildings(false); }} className={`p-1.5 rounded ${showGoogleBuildings ? 'bg-[#1CABE2]/20 text-[#003E5E]' : 'hover:bg-gray-100 text-gray-700'}`} title="Google Buildings (Production Only)"><Box className="w-4 h-4" /></button>
                    </div>
                    <div className="w-full h-px bg-gray-300"></div>
                    <div className="flex gap-1">
                        <button onClick={() => setMapStyle('street')} className={`p-1.5 rounded ${mapStyle === 'street' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Street View"><MapIcon className="w-4 h-4 text-gray-700" /></button>
                        <button onClick={() => setMapStyle('satellite')} className={`p-1.5 rounded ${mapStyle === 'satellite' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Satellite View"><Layers className="w-4 h-4 text-gray-700" /></button>
                        <button onClick={() => setMapStyle('hybrid')} className={`p-1.5 rounded ${mapStyle === 'hybrid' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Hybrid View"><Layers className="w-4 h-4 text-blue-600" /></button>
                        <button onClick={() => setMapStyle('topo')} className={`p-1.5 rounded ${mapStyle === 'topo' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Terrain/Topography"><Mountain className="w-4 h-4 text-gray-700" /></button>
                    </div>
                </div>
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/95 backdrop-blur shadow-xl border border-gray-200 rounded-2xl p-2 flex gap-2 z-[400] max-w-[95%] overflow-x-auto">
                    <ToolButton tool="select" icon={MousePointerClick} label="Select" />
                    <div className="w-px bg-gray-300 mx-1"></div>
                    <ToolButton tool="borehole" icon={Disc} label="Borehole" />
                    <ToolButton tool="tank" icon={Box} label="Tank" />
                    <ToolButton tool="pipeMain" icon={Spline} label="Pipe" />
                    <ToolButton tool="tap" icon={CircleDot} label="Tap" />
                    <div className="w-px bg-gray-300 mx-1"></div>
                    <ToolButton tool="school" icon={GraduationCap} label="School" />
                    <ToolButton tool="clinic" icon={Stethoscope} label="Clinic" />
                    <ToolButton tool="garden" icon={Sprout} label="Garden" />
                    <ToolButton tool="grid" icon={Zap} label="Grid" />
                    <div className="w-px bg-gray-300 mx-1"></div>
                    <ToolButton tool="delete" icon={Eraser} label="Delete" />
                </div>
            </div>
        </div>
    );
};
