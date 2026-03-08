
import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { Map as MapIcon, Navigation, Trash2, Settings, CheckCircle, Layers, Disc, Box, Spline, CircleDot, Activity, MousePointerClick, MousePointer2, User, Users, Eraser, Search, FileText, Hash, GraduationCap, School, Stethoscope, Sprout, Zap, Mountain, Home, Cylinder, Droplets } from 'lucide-react';
import { HydraulicInputs, SystemSpecs, BoQItem, PipelineProfile, SystemGeometry, ProjectDetails } from '../types';
import { DESIGN_COSTS, INSTITUTIONAL_DEMAND } from '../constants';
import { deserialize } from 'flatgeobuf/lib/mjs/geojson';
import { notifyApp } from '../utils/notifications';

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
type RasterLayerType = 'dtw' | 'gw' | 'dem' | 'hillshade';
type SearchResult = {
    lat: string;
    lon: string;
    display_name: string;
    boundingbox?: string[];
};

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
    const searchSelectionMarkerRef = useRef<L.CircleMarker | null>(null);
    const [mapReady, setMapReady] = useState(false);

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
    const [showLayerPanel, setShowLayerPanel] = useState(false);
    const [showToolPanel, setShowToolPanel] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentSegment, setCurrentSegment] = useState<L.LatLng[]>([]);
    const currentSegmentRef = useRef<L.LatLng[]>([]); // Ref for event listeners
    const downhillFilterWarnedRef = useRef(false);

    // GEE Layers State
    const [showDTW, setShowDTW] = useState(false);
    const [showGWPotential, setShowGWPotential] = useState(false);
    const [showFABDEM, setShowFABDEM] = useState(false);
    const [showHillshade, setShowHillshade] = useState(false);
    const [layerOpacity, setLayerOpacity] = useState({ dtw: 0.7, gw: 0.7, dem: 0.7, hillshade: 0.5 });
    const [layerLoading, setLayerLoading] = useState({ dtw: false, gw: false, dem: false, hillshade: false });
    const [layerRanges, setLayerRanges] = useState({
        dtw: { min: 0, max: 60 },
        gw: { min: 0, max: 0.5 },
        dem: { min: 0, max: 3000 },
        hillshade: { min: 0, max: 255 }
    });
    const geeLayersRef = useRef<{ dtw: any, gw: any, dem: any, hillshade: any }>({ dtw: null, gw: null, dem: null, hillshade: null });

    const [loadingElevation, setLoadingElevation] = useState(false);
    const [counts, setCounts] = useState({ taps: 0, mainLen: 0, risingLen: 0, distLen: 0, hasBh: false, hasTank: false, schools: 0, clinics: 0, gardens: 0, hasGrid: false });

    // Search State
    const [servedPop, setServedPop] = useState(0);
    const [unservedPop, setUnservedPop] = useState(0);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    // Building Footprints State
    const [showOSMBuildings, setShowOSMBuildings] = useState(false);
    const [showGoogleBuildings, setShowGoogleBuildings] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState('MWI'); // Default to Malawi
    const [buildingsLoading, setBuildingsLoading] = useState(false);
    const [analysisUpdateTrigger, setAnalysisUpdateTrigger] = useState(0); // Force re-run of analysis

    // Spatial Analysis State
    const [bufferDistance, setBufferDistance] = useState(50); // meters
    const [peoplePerBuilding, setPeoplePerBuilding] = useState(5);
    const [schemeExtentKm, setSchemeExtentKm] = useState<number | null>(null);

    const osmBuildingLayerRef = useRef<L.LayerGroup | null>(null);
    const visualBufferLayerRef = useRef<L.LayerGroup | null>(null);
    const googleBuildingLayerRef = useRef<L.LayerGroup | null>(null);
    const schemeGuideLayerRef = useRef<L.LayerGroup | null>(null);
    const tankGuideCircleRef = useRef<L.Circle | null>(null);

    // Create a global SVG renderer to prevent Canvas renderer usage
    const svgRenderer = useRef<L.SVG | null>(null);

    // Sync Ref
    useEffect(() => { currentSegmentRef.current = currentSegment; }, [currentSegment]);
    const selectedCountryRef = useRef(selectedCountry);
    useEffect(() => { selectedCountryRef.current = selectedCountry; }, [selectedCountry]);

    // Visualization Params Ref (Dynamic Contrast) - Match GEE export palettes
    const visParamsRef = useRef<Record<RasterLayerType, { min: number, max: number, palette: string[] }>>({
        dtw: { min: 0, max: 60, palette: ['#0015ff', '#00a4ff', '#00fff0', '#00ff00', '#ccff00', '#ff8800', '#ff0000'] },
        gw: { min: 0, max: 0.5, palette: ['#ff0000', '#ff8800', '#ccff00', '#00ff00', '#00fff0', '#00a4ff', '#0015ff'] },
        dem: { min: 0, max: 3000, palette: ['#1a472a', '#2d5a3d', '#4a7c59', '#73a373', '#a8d5a8', '#d4e7d4', '#f5f5dc', '#d2b48c', '#8b7355', '#654321', '#ffffff'] },
        hillshade: { min: 0, max: 255, palette: ['#000000', '#ffffff'] }
    });
    const viewportContrastTimeoutRef = useRef<number | null>(null);

    const getProjectionCode = (projection: unknown): number => {
        if (typeof projection === 'number') return projection;
        if (typeof projection === 'string') {
            const parsed = parseInt(projection.replace(/epsg:/i, ''), 10);
            return Number.isFinite(parsed) ? parsed : 4326;
        }
        return 4326;
    };

    const toLatLng = (x: number, y: number, projection: unknown) => {
        const projectionCode = getProjectionCode(projection);
        if (projectionCode === 3857 || projectionCode === 900913 || projectionCode === 102100 || projectionCode === 3785) {
            return L.CRS.EPSG3857.unproject(L.point(x, y));
        }
        return L.latLng(y, x);
    };

    const fromLatLng = (ll: L.LatLng, projection: unknown) => {
        const projectionCode = getProjectionCode(projection);
        if (projectionCode === 3857 || projectionCode === 900913 || projectionCode === 102100 || projectionCode === 3785) {
            const projected = L.CRS.EPSG3857.project(ll);
            return { x: projected.x, y: projected.y };
        }
        return { x: ll.lng, y: ll.lat };
    };

    const sampleDemElevationAt = (ll: L.LatLng): number | null => {
        const demGroup = geeLayersRef.current.dem;
        if (!demGroup) return null;

        let sampled: number | null = null;
        demGroup.eachLayer((layer: any) => {
            if (sampled !== null) return;
            const georaster = layer?.georaster;
            if (!georaster || !georaster.values) return;

            const width = georaster.width || 0;
            const height = georaster.height || 0;
            if (!width || !height) return;

            const { x, y } = fromLatLng(ll, georaster.projection);
            if (x < georaster.xmin || x > georaster.xmax || y < georaster.ymin || y > georaster.ymax) return;

            const pixelWidth = georaster.pixelWidth || ((georaster.xmax - georaster.xmin) / width);
            const pixelHeight = Math.abs(georaster.pixelHeight || ((georaster.ymax - georaster.ymin) / height));
            if (!pixelWidth || !pixelHeight) return;

            const col = Math.max(0, Math.min(width - 1, Math.floor((x - georaster.xmin) / pixelWidth)));
            const row = Math.max(0, Math.min(height - 1, Math.floor((georaster.ymax - y) / pixelHeight)));

            let band0 = georaster.values[0];
            if (!Array.isArray(band0)) band0 = georaster.values;
            if (!Array.isArray(band0)) return;

            const rowData = band0[row];
            if (!rowData) return;
            const value = rowData[col];
            if (value === -9999 || value === null || value === undefined || Number.isNaN(value)) return;
            sampled = value;
        });

        return sampled;
    };

    // Auto-Contrast Handler: can run globally or only on the current viewport.
    const applyAutoContrast = (type: RasterLayerType, layerGroup: any, visibleOnly = false) => {
        const values: number[] = [];
        const mapBounds = visibleOnly && mapInstanceRef.current ? mapInstanceRef.current.getBounds() : null;

        console.log(`[Auto-Contrast] Calculating stats for ${type} (${visibleOnly ? 'viewport' : 'full layer'})...`);

        // Sample pixel values from loaded raster parts.
        layerGroup.eachLayer((layer: any) => {
            if (layer.georaster && layer.georaster.values) {
                try {
                    let band0 = layer.georaster.values[0];

                    if (!Array.isArray(band0)) {
                        band0 = layer.georaster.values;
                    }

                    if (!Array.isArray(band0)) {
                        console.warn(`[Auto-Contrast] Unexpected raster data structure for ${type}`);
                        return;
                    }

                    const width = layer.georaster.width || 0;
                    const height = layer.georaster.height || 0;
                    if (!width || !height) return;

                    const targetSamples = visibleOnly ? 3500 : 2500;
                    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / targetSamples)));

                    const pixelWidth = layer.georaster.pixelWidth || ((layer.georaster.xmax - layer.georaster.xmin) / width);
                    const pixelHeight = Math.abs(layer.georaster.pixelHeight || ((layer.georaster.ymax - layer.georaster.ymin) / height));

                    for (let r = 0; r < height; r += step) {
                        const row = band0[r];
                        if (!row) continue;

                        for (let c = 0; c < width; c += step) {
                            const v = row[c];
                            if (v === -9999 || v === null || v === undefined || Number.isNaN(v)) continue;

                            if (mapBounds) {
                                const x = layer.georaster.xmin + ((c + 0.5) * pixelWidth);
                                const y = layer.georaster.ymax - ((r + 0.5) * pixelHeight);
                                const ll = toLatLng(x, y, layer.georaster.projection);
                                if (!mapBounds.contains(ll)) continue;
                            }

                            values.push(v);
                        }
                    }
                } catch (e) {
                    console.error(`[Auto-Contrast] Error sampling raster for ${type}:`, e);
                }
            }
        });

        console.log(`[Auto-Contrast] Collected ${values.length} samples for ${type}`);

        if (values.length === 0) {
            console.warn(`[Auto-Contrast] No values found for ${type}. Using defaults.`);
            return;
        }

        // Calculate 2nd and 98th percentiles for robust stretching.
        values.sort((a, b) => a - b);
        const lowIndex = Math.floor((values.length - 1) * 0.02);
        const highIndex = Math.floor((values.length - 1) * 0.98);
        let p2 = values[lowIndex];
        let p98 = values[highIndex];

        if (p98 <= p2) {
            const mid = p2;
            const epsilon = Math.max(Math.abs(mid) * 0.01, 0.01);
            p2 = mid - epsilon;
            p98 = mid + epsilon;
        }

        console.log(`[Auto-Contrast] ${type} - Min: ${p2.toFixed(2)}, Max: ${p98.toFixed(2)} (from ${values.length} samples)`);

        // Update visualization parameters.
        visParamsRef.current[type].min = p2;
        visParamsRef.current[type].max = p98;
        setLayerRanges(prev => ({
            ...prev,
            [type]: { min: p2, max: p98 }
        }));

        // Force layer redraw.
        layerGroup.eachLayer((layer: any) => {
            if (layer.redraw) layer.redraw();
        });
    };

    const scheduleViewportContrast = () => {
        if (viewportContrastTimeoutRef.current) {
            window.clearTimeout(viewportContrastTimeoutRef.current);
        }
        viewportContrastTimeoutRef.current = window.setTimeout(() => {
            const layerVisibility: Record<RasterLayerType, boolean> = {
                dtw: showDTW,
                gw: showGWPotential,
                dem: showFABDEM,
                hillshade: showHillshade
            };

            (Object.keys(layerVisibility) as RasterLayerType[]).forEach((type) => {
                if (!layerVisibility[type]) return;
                const layerGroup = geeLayersRef.current[type];
                if (!layerGroup) return;
                applyAutoContrast(type, layerGroup, true);
            });
        }, 180);
    };


    // GEE Layers Effect (Replaced with COG/GeoTIFF)
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        const handleCOGLayer = async (show: boolean, type: 'dtw' | 'gw' | 'dem' | 'hillshade', name: string) => {
            if (show) {
                if (!geeLayersRef.current[type]) {
                    console.log(`Loading COG Layer: ${name} (Split View)`);
                    setLayerLoading(prev => ({ ...prev, [type]: true }));

                    const layerGroup = L.layerGroup().addTo(mapInstanceRef.current!);
                    geeLayersRef.current[type] = layerGroup;

                    try {
                        // @ts-ignore
                        const proj4 = (await import('proj4')).default;
                        (window as any).proj4 = proj4;
                        // Add definitions for common projections just in case
                        proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");
                        proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs");
                        // 32767 is often used as "User Defined" by GEE/GDAL, essentially WGS84
                        proj4.defs("EPSG:32767", "+proj=longlat +datum=WGS84 +no_defs");

                        // @ts-ignore
                        const parse_georaster = (await import('georaster')).default;
                        // @ts-ignore
                        const GeoRasterLayer = (await import('georaster-layer-for-leaflet')).default;
                        // @ts-ignore
                        const chroma = (await import('chroma-js')).default;

                        const baseNameCandidates = type === 'dtw'
                            ? ['dtw_raw']
                            : type === 'gw'
                                ? ['gw_raw']
                                : type === 'hillshade'
                                    ? ['hillshade_raw']
                                    : ['elevation_10m_raw', 'elevation_hr_raw', 'elevation_raw'];

                        const resolveBaseName = async () => {
                            for (const candidate of baseNameCandidates) {
                                try {
                                    const probe = await fetch(`maps/${candidate}_1.tif`, { method: 'HEAD' });
                                    if (probe.ok) return candidate;
                                } catch (e) {
                                    // Continue to next candidate
                                }
                            }
                            return baseNameCandidates[baseNameCandidates.length - 1];
                        };

                        const selectedBaseName = await resolveBaseName();
                        console.log(`[Raster] ${name} using base source: ${selectedBaseName}`);

                        const renderResolution = type === 'dem' ? 256 : type === 'gw' ? 128 : 96;
                        const resampleMethod = type === 'dem' ? 'bilinear' : 'nearest';

                        const loadPart = async (i: number) => {
                            const url = `maps/${selectedBaseName}_${i}.tif`;
                            const response = await fetch(url);
                            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                            const arrayBuffer = await response.arrayBuffer();
                            const georaster = await parse_georaster(arrayBuffer);

                            console.log(`[DEBUG] Loaded part ${i} of ${name}`);
                            console.log('[DEBUG] Georaster Projection:', georaster.projection);
                            console.log('[DEBUG] Image Height/Width:', georaster.height, georaster.width);
                            console.log('[DEBUG] Bounds:', georaster.xmin, georaster.ymin, georaster.xmax, georaster.ymax);

                            // Explicitly check validity or weird GEE codes.
                            // The bounds (3 million+) confirm this is EPSG:3857 (Web Mercator), not 4326.
                            if (!georaster.projection || georaster.projection === 32767) {
                                georaster.projection = 3857;
                            }

                            const layer = new GeoRasterLayer({
                                georaster: georaster,
                                opacity: layerOpacity[type],
                                pixelValuesToColorFn: (values: any) => {
                                    const v = values[0];
                                    if (v === -9999 || v === null || isNaN(v)) return null;

                                    const { min, max, palette } = visParamsRef.current[type];
                                    const scale = chroma.scale(palette).domain([min, max]);
                                    return scale(v).hex();
                                },
                                resolution: renderResolution,
                                resampleMethod,
                                debugLevel: 0
                            });

                            layer.addTo(layerGroup);
                        };

                        const partResults = await Promise.allSettled([1, 2, 3, 4].map(loadPart));
                        const loadedCount = partResults.filter(r => r.status === 'fulfilled').length;

                        if (loadedCount === 0) {
                            throw new Error(`No COG parts loaded for ${name}`);
                        }

                        console.log(`Loaded ${loadedCount}/4 parts for ${name}`);
                        applyAutoContrast(type, layerGroup, false);
                        scheduleViewportContrast();
                    } catch (e) {
                        console.error(`Failed to init layer ${name}`, e);
                        if (geeLayersRef.current[type]) {
                            geeLayersRef.current[type].remove();
                            geeLayersRef.current[type] = null;
                        }
                    } finally {
                        setLayerLoading(prev => ({ ...prev, [type]: false }));
                    }
                }
            } else {
                if (geeLayersRef.current[type]) {
                    geeLayersRef.current[type].remove(); // This removes the LayerGroup
                    geeLayersRef.current[type] = null;
                }
            }
        };

        handleCOGLayer(showDTW, 'dtw', 'Depth to Water');
        handleCOGLayer(showGWPotential, 'gw', 'Groundwater Potential');
        handleCOGLayer(showFABDEM, 'dem', 'Elevation');
        handleCOGLayer(showHillshade, 'hillshade', 'Hillshade');

    }, [showDTW, showGWPotential, showFABDEM, showHillshade]);

    // Re-stretch active raster layers to the visible viewport after pan/zoom.
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current) return;

        const map = mapInstanceRef.current;
        const onViewportChange = () => scheduleViewportContrast();

        map.on('moveend', onViewportChange);
        map.on('zoomend', onViewportChange);

        // Run once after layer toggles change.
        scheduleViewportContrast();

        return () => {
            map.off('moveend', onViewportChange);
            map.off('zoomend', onViewportChange);
        };
    }, [mapReady, showDTW, showGWPotential, showFABDEM, showHillshade]);

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
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            if (data && data.address) {
                // Try to find the most relevant "village" name
                return data.address.village || data.address.town || data.address.city || data.address.suburb || data.name || null;
            }
            return null;
        } catch (e) {
            console.warn("Reverse geocoding failed", e);
            return null;
        }
    };

    // Search Handler
    const selectSearchResult = (result: SearchResult) => {
        if (!mapInstanceRef.current) return;
        const map = mapInstanceRef.current;
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        if (Array.isArray(result.boundingbox) && result.boundingbox.length === 4) {
            const south = parseFloat(result.boundingbox[0]);
            const north = parseFloat(result.boundingbox[1]);
            const west = parseFloat(result.boundingbox[2]);
            const east = parseFloat(result.boundingbox[3]);
            if ([south, north, west, east].every(v => Number.isFinite(v))) {
                const bounds = L.latLngBounds([south, west], [north, east]);
                map.fitBounds(bounds.pad(0.3), { maxZoom: 16 });
            } else {
                map.flyTo([lat, lon], 16, { duration: 1.5 });
            }
        } else {
            map.flyTo([lat, lon], 16, { duration: 1.5 });
        }

        if (searchSelectionMarkerRef.current) {
            searchSelectionMarkerRef.current.remove();
            searchSelectionMarkerRef.current = null;
        }
        searchSelectionMarkerRef.current = L.circleMarker([lat, lon], {
            radius: 10,
            color: '#1CABE2',
            weight: 2,
            fillColor: '#1CABE2',
            fillOpacity: 0.2
        }).addTo(map);

        const shortName = result.display_name.split(',')[0];
        setProjectDetails(prev => ({ ...prev, siteName: shortName }));
        setSearchQuery(shortName);
        setSearchResults([]);
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim() || !mapInstanceRef.current) return;

        setSearching(true);
        try {
            // Use a simple fetch without custom headers to avoid preflight CORS issues
            // If this still fails, we might need a proxy or a different service.
            const countryCode = selectedCountry.toLowerCase();
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=${countryCode}&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                setSearchResults(data as SearchResult[]);
            } else {
                setSearchResults([]);
                notifyApp({ type: "warning", message: "Location not found in the selected country. Try a nearby name." });
            }
        } catch (err) {
            console.error(err);
            notifyApp({ type: "error", message: "Search failed. Please check your internet connection." });
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {

        if (!mapContainerRef.current || mapInstanceRef.current) return;

        // Create global SVG renderer instance
        if (!svgRenderer.current) {
            svgRenderer.current = L.svg();
        }

        // Use preferCanvas: false and explicit renderer to fix clearRect error
        const map = L.map(mapContainerRef.current, {
            center: [-13.2543, 34.3015], // Malawi
            zoom: 7,
            zoomControl: false,
            preferCanvas: false,
            renderer: svgRenderer.current,
            doubleClickZoom: false // Disable double-click zoom to allow pipe completion
        });

        mapInstanceRef.current = map;
        setMapReady(true);
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

        // Initial layer based on state (street)
        const url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        L.tileLayer(url, {
            attribution: 'Map data',
            maxZoom: 22,
            crossOrigin: true
        }).addTo(map);

        // Initialize layers
        osmBuildingLayerRef.current = L.layerGroup().addTo(map);
        googleBuildingLayerRef.current = L.layerGroup().addTo(map);
        visualBufferLayerRef.current = L.layerGroup().addTo(map); // Initialize buffer layer here
        schemeGuideLayerRef.current = L.layerGroup().addTo(map);

        setTimeout(() => { map.invalidateSize(); }, 500);

        // EVENTS
        map.on('click', async (e) => {
            const tool = activeToolRef.current;
            const latlng = e.latlng;

            if (tool === 'select' || tool === 'delete') return;

            if (tool === 'borehole') {
                if (features.current.borehole?.marker) features.current.borehole.marker.remove();
                const m = L.marker(latlng, { icon: icons.current.bh, draggable: true }).addTo(map);
                m.on('click', () => { if (activeToolRef.current === 'delete') { m.remove(); features.current.borehole = null; setInputs(prev => ({ ...prev, boreholeElevation: undefined })); recalcAutoConnections(); setAnalysisUpdateTrigger(prev => prev + 1); } });

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
                m.on('click', () => { if (activeToolRef.current === 'delete') { m.remove(); features.current.tank = null; setInputs(prev => ({ ...prev, tankElevation: undefined })); recalcAutoConnections(); setAnalysisUpdateTrigger(prev => prev + 1); } });
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
                m.on('click', () => { if (activeToolRef.current === 'delete') { m.remove(); features.current.taps = features.current.taps.filter(t => t.id !== id); recalcAutoConnections(); setAnalysisUpdateTrigger(prev => prev + 1); } });
                m.on('dragend', async () => {
                    const ll = m.getLatLng();
                    const tap = features.current.taps.find(t => t.id === id);
                    if (tap) { tap.elev = await fetchElevation(ll.lat, ll.lng); }
                    recalcAutoConnections();
                    setAnalysisUpdateTrigger(prev => prev + 1);
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
                        setAnalysisUpdateTrigger(prev => prev + 1);
                    }
                });
                m.on('dragend', () => { recalcAutoConnections(); setAnalysisUpdateTrigger(prev => prev + 1); }); // Repositioning changes connections potentially

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
                    features.current.tempLine = L.polyline([lastPt, e.latlng], { color: '#ef4444', dashArray: '5, 10', renderer: svgRenderer.current! }).addTo(map);
                } else {
                    features.current.tempLine.setLatLngs([lastPt, e.latlng]);
                }
            }
        });

        map.on('dblclick', (e) => {
            if (activeToolRef.current === 'pipeMain' && currentSegmentRef.current.length > 0) {
                L.DomEvent.stop(e);
                console.log('Double-click detected, finishing pipe segment');
                finishSegment();
                return false;
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

        return () => {
            setMapReady(false);
            if (viewportContrastTimeoutRef.current) {
                window.clearTimeout(viewportContrastTimeoutRef.current);
                viewportContrastTimeoutRef.current = null;
            }
        };
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
        const map = mapInstanceRef.current;
        if (!showOSMBuildings) {
            if (osmBuildingLayerRef.current) {
                map.removeLayer(osmBuildingLayerRef.current);
                osmBuildingLayerRef.current = null;
            }
            return;
        }

        let cancelled = false;
        let debounceId: number | undefined;
        let warnedLimit = false;
        const MAX_FEATURES = 3000;

        if (!osmBuildingLayerRef.current) {
            osmBuildingLayerRef.current = L.geoJSON(null, {
                style: { color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.3 }
            }).addTo(map);
        }

        const loadFeatures = async () => {
            setBuildingsLoading(true);
            try {
                const bounds = map.getBounds();
                const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
                const query = `[out:json][timeout:25];(way["building"](${bbox}););out geom;`;
                const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

                const response = await fetch(url);
                const data = await response.json();

                let features = data.elements.map((element: any) => {
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

                if (features.length > MAX_FEATURES) {
                    features = features.slice(0, MAX_FEATURES);
                    if (!warnedLimit) {
                        warnedLimit = true;
                        notifyApp({ type: "warning", message: `OSM buildings limited to ${MAX_FEATURES.toLocaleString()} for performance. Zoom in for full detail.` });
                    }
                }

                if (cancelled || !osmBuildingLayerRef.current) return;
                osmBuildingLayerRef.current.clearLayers();
                osmBuildingLayerRef.current.addData({ type: 'FeatureCollection', features } as any);
                setAnalysisUpdateTrigger(prev => prev + 1);
                console.log(`Loaded ${features.length} OSM buildings`);
            } catch (error) {
                console.error('Error fetching OSM buildings:', error);
                notifyApp({ type: "error", message: "Failed to load OSM buildings. Try zooming in." });
            } finally {
                if (!cancelled) setBuildingsLoading(false);
            }
        };

        const debouncedLoad = () => {
            if (debounceId) window.clearTimeout(debounceId);
            debounceId = window.setTimeout(() => {
                loadFeatures();
            }, 250);
        };

        loadFeatures();
        map.on('moveend', debouncedLoad);

        return () => {
            cancelled = true;
            if (debounceId) window.clearTimeout(debounceId);
            map.off('moveend', debouncedLoad);
            if (osmBuildingLayerRef.current) {
                map.removeLayer(osmBuildingLayerRef.current);
                osmBuildingLayerRef.current = null;
            }
        };
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

                // Create a GeoJSON layer
                buildingsLayer = L.geoJSON(null, {
                    // renderer: L.svg(), // Removed invalid option, handled by map preference
                    style: {
                        fillColor: '#1CABE2',
                        fillOpacity: 0.6,
                        color: '#003E5E',
                        weight: 1
                    }
                });

                if (mapInstanceRef.current) {
                    buildingsLayer.addTo(mapInstanceRef.current);
                    googleBuildingLayerRef.current = buildingsLayer; // Store ref for analysis

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
                            // Use flatgeobuf to fetch features in bounds.
                            // `nocache=true` avoids browser cache issues seen with ranged requests.
                            const loadFeatures = async (url: string) => {
                                const iter = (deserialize as any)(url, rect, undefined, true);
                                let loadedCount = 0;
                                for await (const feature of iter) {
                                    buildingsLayer.addData(feature as any);
                                    loadedCount++;
                                }
                                return loadedCount;
                            };

                            let count = 0;
                            try {
                                count = await loadFeatures(fgbUrl);
                            } catch (primaryErr) {
                                // Retry once with a cache-busted URL for browsers that fail on cached range ops.
                                console.warn('Primary FGB fetch failed, retrying with cache-busted URL...', primaryErr);
                                const cacheBustedUrl = `${fgbUrl}?nocache=${Date.now()}`;
                                count = await loadFeatures(cacheBustedUrl);
                            }
                            console.log(`Loaded ${count} Google Buildings features`);

                            if (count === 0) {
                                console.log("No buildings found in this area (or FGB load failed silently).");
                            }
                            setAnalysisUpdateTrigger(prev => prev + 1); // Force analysis update
                        } catch (e) {
                            console.error('Error fetching FGB features:', e);
                            // Do not alert constantly on move
                        } finally {
                            setBuildingsLoading(false);
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
                notifyApp({ type: "error", message: `Google Buildings failed for ${selectedCountry}. Switching to OSM buildings.` });
                setShowGoogleBuildings(false);
                setShowOSMBuildings(true);
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
                googleBuildingLayerRef.current = null;
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
            // Use Google Maps hybrid (satellite + labels)
            url = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        }

        // Update TileLayer with crossOrigin for PDF export compatibility
        const tileLayer = L.tileLayer(url, {
            attribution: mapStyle === 'topo' ? 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)' : mapStyle === 'hybrid' ? 'Map data: © Google' : 'Map data',
            maxZoom: 22,
            crossOrigin: true
        }).addTo(mapInstanceRef.current);

        let labelsLayer: L.TileLayer | null = null;
        // Hybrid map now uses Google's built-in labels, no separate layer needed
        if (labelsUrl) {
            // Create a custom pane for labels if it doesn't exist
            if (!mapInstanceRef.current.getPane('labels')) {
                mapInstanceRef.current.createPane('labels');
                mapInstanceRef.current.getPane('labels')!.style.zIndex = '600';
                mapInstanceRef.current.getPane('labels')!.style.pointerEvents = 'none'; // Allow clicks to pass through
            }

            labelsLayer = L.tileLayer(labelsUrl, {
                maxZoom: 22,
                crossOrigin: true,
                pane: 'labels', // Use custom pane
                opacity: 1
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
            const poly = L.polyline(cleanSeg, { color: '#ef4444', weight: 4, renderer: svgRenderer.current! }).addTo(mapInstanceRef.current!);
            poly.on('click', (e) => {
                if (activeToolRef.current === 'delete') {
                    L.DomEvent.stopPropagation(e);
                    poly.remove();
                    features.current.mainLines = features.current.mainLines.filter(ml => ml.id !== id);
                    recalcAutoConnections();
                    setAnalysisUpdateTrigger(prev => prev + 1);
                }
            });
            features.current.mainLines.push({ poly, id });
        }

        setCurrentSegment([]);
        setIsDrawing(false);
        if (features.current.tempLine) { features.current.tempLine.remove(); features.current.tempLine = null; }
        recalcAutoConnections();
        setAnalysisUpdateTrigger(prev => prev + 1); // Force analysis update after pipe finish
    };

    const updateTankSchemeGuide = () => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (!schemeGuideLayerRef.current) {
            schemeGuideLayerRef.current = L.layerGroup().addTo(map);
        }

        schemeGuideLayerRef.current.clearLayers();
        tankGuideCircleRef.current = null;

        if (features.current.tank) {
            const tankLL = features.current.tank.marker.getLatLng();
            const circle = L.circle(tankLL, {
                radius: 2000,
                color: '#f59e0b',
                weight: 2,
                dashArray: '8, 6',
                fillColor: '#f59e0b',
                fillOpacity: 0.03,
                interactive: false
            }).addTo(schemeGuideLayerRef.current);
            tankGuideCircleRef.current = circle;
        }
    };

    const recalcAutoConnections = () => {
        const map = mapInstanceRef.current;
        if (!map) return;

        updateTankSchemeGuide();

        // Rising Main
        if (features.current.borehole && features.current.tank) {
            const bhLL = features.current.borehole.marker.getLatLng();
            const tankLL = features.current.tank.marker.getLatLng();
            if (features.current.risingMain) features.current.risingMain.remove();
            features.current.risingMain = L.polyline([bhLL, tankLL], { color: '#3b82f6', weight: 5, opacity: 0.8, renderer: svgRenderer.current! }).addTo(map);
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
                    const line = L.polyline([featLL, connectPt], { color: '#10b981', weight: 2, dashArray: '5, 5', renderer: svgRenderer.current! }).addTo(map);
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

        // Scheme sizing helper: farthest designed point from tank (target <= 2 km).
        let calculatedSchemeExtentKm: number | null = null;
        if (features.current.tank) {
            const tankLL = features.current.tank.marker.getLatLng();
            let maxDistanceM = 0;
            const extentCandidates: L.LatLng[] = [];

            if (features.current.borehole) extentCandidates.push(features.current.borehole.marker.getLatLng());
            features.current.taps.forEach(t => extentCandidates.push(t.marker.getLatLng()));
            features.current.institutions.forEach(i => extentCandidates.push(i.marker.getLatLng()));

            features.current.mainLines.forEach(ml => {
                const pts = ml.poly.getLatLngs() as L.LatLng[];
                const flatPts = (Array.isArray(pts[0]) && !('lat' in pts[0])) ? (pts as any).flat() : pts;
                flatPts.forEach(p => extentCandidates.push(p));
            });

            extentCandidates.forEach((pt) => {
                const d = tankLL.distanceTo(pt);
                if (d > maxDistanceM) maxDistanceM = d;
            });

            if (maxDistanceM > 0) {
                calculatedSchemeExtentKm = maxDistanceM / 1000;
            }
        }
        setSchemeExtentKm(calculatedSchemeExtentKm);

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


    // Immediate Buffer Drawing - Draw buffers as soon as point features are placed
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        // Initialize visual buffer layer if needed
        if (!visualBufferLayerRef.current) {
            visualBufferLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            console.log('Created visual buffer layer for immediate drawing');
        } else if (!mapInstanceRef.current.hasLayer(visualBufferLayerRef.current)) {
            visualBufferLayerRef.current.addTo(mapInstanceRef.current);
        }

        // Clear existing buffers
        visualBufferLayerRef.current.clearLayers();

        // Collect all point features (Taps, Schools, Clinics, Gardens)
        const pointFeatures: L.LatLng[] = [
            ...features.current.taps.map(t => t.marker.getLatLng()),
            ...features.current.institutions.map(i => i.marker.getLatLng())
        ];

        // Draw buffers around each point feature
        console.log(`Drawing ${pointFeatures.length} buffers immediately (radius: ${bufferDistance}m)`);
        pointFeatures.forEach((pt, idx) => {
            L.circle(pt, {
                radius: bufferDistance,
                color: '#22c55e',
                weight: 1,
                fillOpacity: 0.2,
                interactive: false
            }).addTo(visualBufferLayerRef.current!);
        });

    }, [bufferDistance, analysisUpdateTrigger]); // Redraw when buffer distance changes or features update


    // Spatial Analysis Logic
    useEffect(() => {
        console.log('Spatial Analysis Effect Running:', {
            hasOSMBuildings: !!osmBuildingLayerRef.current,
            hasGoogleBuildings: !!googleBuildingLayerRef.current,
            hasMap: !!mapInstanceRef.current,
            bufferDistance,
            peoplePerBuilding,
            analysisUpdateTrigger
        });

        // Check if we have a map and at least one building layer
        if (!mapInstanceRef.current) {
            console.log('No map instance, skipping analysis');
            return;
        }

        const hasBuildings = osmBuildingLayerRef.current || googleBuildingLayerRef.current;
        if (!hasBuildings) {
            console.log('No building layers available, skipping analysis');
            return;
        }

        // Initialize visual buffer layer if needed (safety check)
        if (!visualBufferLayerRef.current) {
            visualBufferLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
            console.log('Created visual buffer layer');
        } else if (!mapInstanceRef.current.hasLayer(visualBufferLayerRef.current)) {
            visualBufferLayerRef.current.addTo(mapInstanceRef.current);
            console.log('Added visual buffer layer to map');
        }
        visualBufferLayerRef.current.clearLayers();
        console.log('Cleared existing buffer layers');

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

        const activeBuildingLayer = showGoogleBuildings && googleBuildingLayerRef.current ? googleBuildingLayerRef.current : osmBuildingLayerRef.current;
        const tankLL = features.current.tank?.marker.getLatLng() || null;
        const tankElevation = features.current.tank?.elev ?? null;
        const catchmentRadiusM = 1500;

        // Keep only service points that are near the drawn distribution network.
        const connectionTolerance = Math.max(35, Math.min(120, bufferDistance));
        const connectedServicePoints = pointFeatures.filter((pt) => {
            if (tankLL && pt.distanceTo(tankLL) <= connectionTolerance) return true;

            for (const pipe of pipes) {
                const pts = pipe.getLatLngs() as L.LatLng[] | L.LatLng[][];
                const flatPts: L.LatLng[] = (Array.isArray(pts[0]) && !('lat' in (pts[0] as any))) ? (pts as any).flat() : (pts as L.LatLng[]);
                for (let i = 0; i < flatPts.length - 1; i++) {
                    if (getDistToSegmentMeters(pt, flatPts[i], flatPts[i + 1]) <= connectionTolerance) {
                        return true;
                    }
                }
            }
            return false;
        });

        const canEstimatePopulation = Boolean(
            showGoogleBuildings &&
            features.current.borehole &&
            features.current.tank &&
            features.current.mainLines.length > 0 &&
            connectedServicePoints.length > 0
        );

        if (!activeBuildingLayer) {
            console.log('No building layer available for service analysis');
        } else if (!canEstimatePopulation) {
            // Workflow not complete yet: keep buildings neutral and do not estimate population.
            activeBuildingLayer.eachLayer((layer: any) => {
                if (layer.setStyle) {
                    layer.setStyle({ color: '#64748b', fillColor: '#94a3b8', fillOpacity: 0.2, weight: 1 });
                }
            });
            servedCount = 0;
            unservedCount = 0;
        } else {
            if (!geeLayersRef.current.dem && !downhillFilterWarnedRef.current) {
                downhillFilterWarnedRef.current = true;
                notifyApp({
                    type: "warning",
                    message: "Turn on Elevation layer for more accurate downhill filtering from tank."
                });
            }

            // Draw visual buffers around connected service points only.
            if (visualBufferLayerRef.current) {
                connectedServicePoints.forEach(pt => {
                    L.circle(pt, {
                        radius: bufferDistance,
                        color: '#22c55e',
                        fillColor: '#22c55e',
                        fillOpacity: 0.1,
                        weight: 1,
                        dashArray: '5, 5'
                    }).addTo(visualBufferLayerRef.current!);
                });
            }

            console.log("Running service analysis on layer:", showGoogleBuildings ? "Google" : "OSM");
            activeBuildingLayer.eachLayer((layer: any) => {
                if (!(layer.feature && (layer.feature.geometry.type === 'Polygon' || layer.feature.geometry.type === 'MultiPolygon'))) return;

                const center = layer.getBounds().getCenter();

                // Eligibility for both served/unserved counts:
                // downhill from tank (when elevations available) and within 1.5km of tank.
                const withinRadius = tankLL ? center.distanceTo(tankLL) <= catchmentRadiusM : false;
                const buildingElevation = sampleDemElevationAt(center);
                const isDownhill = (tankElevation === null || buildingElevation === null) ? true : buildingElevation <= tankElevation + 1;
                const eligible = withinRadius && isDownhill;

                if (!eligible) {
                    if (layer.setStyle) {
                        layer.setStyle({ color: '#94a3b8', fillColor: '#cbd5e1', fillOpacity: 0.12, weight: 1 });
                    }
                    return;
                }

                let isServed = false;
                for (const pt of connectedServicePoints) {
                    if (center.distanceTo(pt) <= bufferDistance) {
                        isServed = true;
                        break;
                    }
                }

                if (isServed) {
                    layer.setStyle({ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.5, weight: 2 });
                    servedCount++;
                } else {
                    layer.setStyle({ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.3, weight: 1 });
                    unservedCount++;
                }
            });
        }

        console.log(`Analysis complete: ${servedCount} served buildings, ${unservedCount} unserved buildings`);
        console.log(`Population: ${servedCount * peoplePerBuilding} served, ${unservedCount * peoplePerBuilding} unserved`);
        setServedPop(servedCount * peoplePerBuilding);
        setUnservedPop(unservedCount * peoplePerBuilding);

    }, [bufferDistance, peoplePerBuilding, showOSMBuildings, showGoogleBuildings, showFABDEM, buildingsLoading, layerLoading.dem, analysisUpdateTrigger]);

    // Recalc when pipes change
    const activeRasterLoads = [
        layerLoading.dtw ? 'DTW' : null,
        layerLoading.gw ? 'GWP' : null,
        layerLoading.dem ? 'Elevation' : null,
        layerLoading.hillshade ? 'Hillshade' : null
    ].filter(Boolean) as string[];
    const layerLoadingText = [
        buildingsLoading ? 'Buildings' : null,
        ...activeRasterLoads
    ].filter(Boolean).join(', ');
    const buildingSourceLabel = showGoogleBuildings ? 'Google Buildings' : showOSMBuildings ? 'OSM Buildings' : 'No Building Layer';
    const canEstimatePopulationNow = showGoogleBuildings && counts.hasBh && counts.hasTank && counts.mainLen > 0 && (counts.taps + counts.schools + counts.clinics + counts.gardens) > 0;
    const schemeWithinTarget = schemeExtentKm === null ? null : schemeExtentKm <= 2;

    const fitMapToTankScheme = () => {
        const map = mapInstanceRef.current;
        const guide = tankGuideCircleRef.current;
        if (!map || !guide) return;
        map.fitBounds(guide.getBounds(), { padding: [40, 40], maxZoom: 14 });
    };

    return (
        <div className="flex flex-col gap-4 min-h-[calc(100vh-140px)] relative">

            {/* 0. SEARCH BAR */}
            <div className="order-0 w-full bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <form onSubmit={handleSearch} className="relative">
                    <input
                        type="text"
                        placeholder="Search village, town or place..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (!e.target.value.trim()) setSearchResults([]);
                        }}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1CABE2] outline-none shadow-sm"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                </form>
                <p className="text-[10px] text-gray-500 mt-2">Press Enter to search, then pick the correct result from the list.</p>
                {searching && <div className="text-xs text-blue-600 mt-2">Searching...</div>}
                {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-48 overflow-y-auto">
                        {searchResults.map((result) => (
                            <button
                                key={`${result.lat}-${result.lon}-${result.display_name}`}
                                type="button"
                                onClick={() => selectSearchResult(result)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                            >
                                {result.display_name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 1. ENGINEERING PANEL */}
            <div className="order-2 w-full flex flex-col gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="mb-2">
                    <h3 className="font-bold text-[#003E5E] flex items-center gap-2 border-b border-gray-200 pb-2"><Settings className="w-4 h-4" /> Design Parameters</h3>
                </div>
                <div className="space-y-4 text-sm">
                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <h4 className="font-bold text-slate-800 text-xs mb-2">Population Estimation Workflow</h4>
                        <div className="text-[10px] text-slate-700 space-y-1">
                            <p><strong>1)</strong> Load <strong>Google Buildings</strong>, then site the <strong>borehole</strong> in higher GWP areas and not too far from tank.</p>
                            <p><strong>2)</strong> Place the <strong>tank</strong> above most households in elevation where practical.</p>
                            <p><strong>3)</strong> Draw pipelines toward households downhill from tank, then add tapstands and institutions near main pipelines.</p>
                            <p><strong>4)</strong> Served/unserved only estimates after this workflow is complete.</p>
                            <p><strong>Sizing Target:</strong> Keep overall scheme footprint within <strong>2.0 km</strong> from tank when possible.</p>
                            <p><strong>Rule:</strong> Unserved = downhill population within <strong>1.5 km</strong> of tank and outside service buffers.</p>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-600">
                            Current building source: <strong>{buildingSourceLabel}</strong>
                        </div>
                        {counts.hasTank && (
                            <div className={`mt-2 text-[10px] font-medium ${schemeWithinTarget === false ? 'text-amber-700' : 'text-emerald-700'}`}>
                                Current scheme extent from tank: <strong>{schemeExtentKm ? schemeExtentKm.toFixed(2) : '0.00'} km</strong>
                                {schemeWithinTarget === false ? ' (above 2.0 km target)' : ' (within 2.0 km target)'}
                            </div>
                        )}
                        {counts.hasTank && (
                            <button
                                type="button"
                                onClick={fitMapToTankScheme}
                                className="mt-2 px-2 py-1 bg-amber-100 text-amber-800 rounded text-[10px] font-bold hover:bg-amber-200 transition"
                            >
                                Fit Map to 2 km Tank Zone
                            </button>
                        )}
                    </div>
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
                                <p className="text-[10px] text-gray-500 mt-1">Buildings within this distance of connected taps/institutions are served. Catchment is additionally limited to 1.5 km from tank.</p>
                            </div>
                            <div>
                                <label className="block text-gray-600 text-xs font-bold mb-1" title="Average people per household/building">People per Building</label>
                                <input
                                    type="number"
                                    value={peoplePerBuilding}
                                    onChange={e => setPeoplePerBuilding(Math.max(1, parseFloat(e.target.value) || 1))}
                                    className="w-full p-1.5 border rounded text-xs"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Default 5 works for many rural contexts; adjust to your local census norm.</p>
                            </div>
                            <div className="flex justify-between text-xs pt-1 border-t border-blue-200 mt-1">
                                <span className="text-green-700 font-bold">Served: {servedPop.toLocaleString()}</span>
                                <span className="text-red-700 font-bold">Unserved: {unservedPop.toLocaleString()}</span>
                            </div>
                            {!canEstimatePopulationNow && (
                                <p className="text-[10px] text-amber-700 mt-1">Complete borehole, tank, main pipeline, and service points to activate population estimates.</p>
                            )}
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
                                Use Served
                            </button>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 text-right">
                            Spatial Estimate: <strong>{servedPop.toLocaleString()}</strong>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">Use "Use Served" to copy the latest served-pop estimate into model population.</p>
                    </div>
                    <div>
                        <label className="block text-gray-600 text-xs font-bold mb-1">Borehole Depth (m)</label>
                        <input type="number" value={inputs.boreholeDepth} onChange={e => setInputs({ ...inputs, boreholeDepth: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded" />
                        <p className="text-[10px] text-gray-500 mt-1">Total drilled depth. Example: 40-90m in many Malawi settings.</p>
                    </div>
                    <div>
                        <label className="block text-gray-600 text-xs font-bold mb-1">Static Water Level (m)</label>
                        <input type="number" value={inputs.staticWaterLevel} onChange={e => setInputs({ ...inputs, staticWaterLevel: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded" />
                        <p className="text-[10px] text-gray-500 mt-1">Depth from ground to water table at rest (must be less than borehole depth).</p>
                    </div>
                    <div><label className="block text-gray-600 text-xs font-bold mb-1">Tank Stand Height (m)</label>
                        <select value={inputs.tankHeight} onChange={e => setInputs({ ...inputs, tankHeight: parseFloat(e.target.value) })} className="w-full p-2 border rounded"><option value={3}>3m</option><option value={6}>6m</option><option value={9}>9m</option></select>
                        <p className="text-[10px] text-gray-500 mt-1">Higher stands improve pressure but increase cost and structural demand.</p>
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
            <div className="order-1 w-full relative h-[70vh] min-h-[520px] bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300">
                <div ref={mapContainerRef} className="w-full h-full z-0" />
                {(loadingElevation || buildingsLoading || activeRasterLoads.length > 0) && (
                    <div className="absolute top-4 left-4 flex flex-col gap-2 z-[400]">
                        {loadingElevation && (
                            <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-blue-600 flex items-center gap-2">
                                <Activity className="w-3 h-3 animate-spin" /> Fetching Elevation...
                            </div>
                        )}
                        {(buildingsLoading || activeRasterLoads.length > 0) && (
                            <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-emerald-700 flex items-center gap-2">
                                <Activity className="w-3 h-3 animate-spin" /> Loading map data: {layerLoadingText}...
                            </div>
                        )}
                    </div>
                )}
                <div className="absolute top-4 right-4 z-[450] flex gap-2">
                    {counts.hasTank && (
                        <button
                            onClick={fitMapToTankScheme}
                            className="bg-amber-100/95 border border-amber-300 rounded-lg shadow px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-200"
                        >
                            Fit 2 km Zone
                        </button>
                    )}
                    <button
                        onClick={() => setShowLayerPanel(prev => !prev)}
                        className="bg-white/95 border border-gray-200 rounded-lg shadow px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        {showLayerPanel ? 'Hide Layers' : 'Show Layers'}
                    </button>
                    <button
                        onClick={() => setShowToolPanel(prev => !prev)}
                        className="bg-white/95 border border-gray-200 rounded-lg shadow px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        {showToolPanel ? 'Hide Tools' : 'Show Tools'}
                    </button>
                </div>

                {showLayerPanel && (
                <div className="absolute top-16 right-4 bg-white rounded-lg shadow-md border border-gray-200 p-2 flex flex-col gap-2 z-[400] max-h-[72vh] overflow-y-auto w-[250px]">
                    {/* Google Buildings Toggle */}
                    <button
                        onClick={() => {
                            console.log('Toggling Google Buildings');
                            const next = !showGoogleBuildings;
                            setShowGoogleBuildings(next);
                            if (next) setShowOSMBuildings(false);
                        }}
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${showGoogleBuildings ? 'bg-[#1CABE2] text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        <Box className="w-4 h-4" />
                        <span className="text-xs font-semibold">Google Buildings</span>
                        {buildingsLoading && showGoogleBuildings && (
                            <div className="ml-auto">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                        )}
                    </button>

                    <button
                        onClick={() => {
                            const next = !showOSMBuildings;
                            setShowOSMBuildings(next);
                            if (next) setShowGoogleBuildings(false);
                        }}
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${showOSMBuildings ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        <Home className="w-4 h-4" />
                        <span className="text-xs font-semibold">OSM Buildings</span>
                        {buildingsLoading && showOSMBuildings && (
                            <div className="ml-auto">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                        )}
                    </button>

                    <div className="w-full h-px bg-gray-300"></div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1">GEE Layers</div>
                    <div className="text-[9px] text-gray-500 px-1 -mt-1">
                        DTW + GWP help borehole siting. Elevation + Hillshade guide tank and pipe routing.
                    </div>

                    <button
                        onClick={() => setShowDTW(!showDTW)}
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${showDTW ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        <Droplets className="w-4 h-4" />
                        <span className="text-xs font-semibold">Depth to Water</span>
                        {layerLoading.dtw && (
                            <div className="ml-auto">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                        )}
                    </button>
                    {showDTW && (
                        <div className="px-2 py-1">
                            <label className="text-[10px] text-gray-600">Opacity: {Math.round(layerOpacity.dtw * 100)}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={layerOpacity.dtw * 100}
                                onChange={(e) => {
                                    const newOpacity = parseFloat(e.target.value) / 100;
                                    setLayerOpacity({ ...layerOpacity, dtw: newOpacity });
                                    if (geeLayersRef.current.dtw) {
                                        geeLayersRef.current.dtw.eachLayer((layer: any) => {
                                            if (layer.setOpacity) layer.setOpacity(newOpacity);
                                        });
                                    }
                                }}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="mt-1 text-[9px] text-gray-600">Use DTW to spot shallower water-table zones for easier drilling.</div>
                            {/* Legend */}
                            <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                                <div className="text-[9px] font-semibold text-gray-700 mb-1">Depth to Water (m)</div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[8px] text-gray-600">{layerRanges.dtw.min.toFixed(1)}</span>
                                    <div className="flex-1 h-3 rounded" style={{
                                        background: 'linear-gradient(to right, #0015ff, #00a4ff, #00fff0, #00ff00, #ccff00, #ff8800, #ff0000)'
                                    }}></div>
                                    <span className="text-[8px] text-gray-600">{layerRanges.dtw.max.toFixed(1)}</span>
                                </div>
                                <div className="mt-1 text-[8px] text-gray-500">Auto-stretched to current zoomed map view.</div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowGWPotential(!showGWPotential)}
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${showGWPotential ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        <CircleDot className="w-4 h-4" />
                        <span className="text-xs font-semibold">GW Potential</span>
                        {layerLoading.gw && (
                            <div className="ml-auto">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                        )}
                    </button>
                    {showGWPotential && (
                        <div className="px-2 py-1">
                            <label className="text-[10px] text-gray-600">Opacity: {Math.round(layerOpacity.gw * 100)}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={layerOpacity.gw * 100}
                                onChange={(e) => {
                                    const newOpacity = parseFloat(e.target.value) / 100;
                                    setLayerOpacity({ ...layerOpacity, gw: newOpacity });
                                    if (geeLayersRef.current.gw) {
                                        geeLayersRef.current.gw.eachLayer((layer: any) => {
                                            if (layer.setOpacity) layer.setOpacity(newOpacity);
                                        });
                                    }
                                }}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="mt-1 text-[9px] text-gray-600">Use GWP to prioritize zones with stronger groundwater likelihood.</div>
                            <div className="mt-1 text-[9px] text-gray-600">
                                View range: {layerRanges.gw.min.toFixed(3)} to {layerRanges.gw.max.toFixed(3)}
                            </div>
                            <div className="text-[8px] text-gray-500">Auto-stretched to current zoomed map view.</div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowFABDEM(!showFABDEM)}
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${showFABDEM ? 'bg-green-700 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        <Mountain className="w-4 h-4" />
                        <span className="text-xs font-semibold">Elevation</span>
                        {layerLoading.dem && (
                            <div className="ml-auto">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                        )}
                    </button>
                    {showFABDEM && (
                        <div className="px-2 py-1">
                            <label className="text-[10px] text-gray-600">Opacity: {Math.round(layerOpacity.dem * 100)}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={layerOpacity.dem * 100}
                                onChange={(e) => {
                                    const newOpacity = parseFloat(e.target.value) / 100;
                                    setLayerOpacity({ ...layerOpacity, dem: newOpacity });
                                    if (geeLayersRef.current.dem) {
                                        geeLayersRef.current.dem.eachLayer((layer: any) => {
                                            if (layer.setOpacity) layer.setOpacity(newOpacity);
                                        });
                                    }
                                }}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="mt-1 text-[9px] text-gray-600">Use elevation to reduce pumping head and identify practical tank points.</div>
                            <div className="text-[8px] text-gray-500">High-res DEM files are auto-used when available (`elevation_10m_raw_*`).</div>
                            <div className="mt-1 text-[9px] text-gray-600">
                                View range: {layerRanges.dem.min.toFixed(1)} m to {layerRanges.dem.max.toFixed(1)} m
                            </div>
                            <div className="text-[8px] text-gray-500">Auto-stretched to current zoomed map view.</div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowHillshade(!showHillshade)}
                        className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${showHillshade ? 'bg-slate-700 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        <Mountain className="w-4 h-4" />
                        <span className="text-xs font-semibold">Hillshade</span>
                        {layerLoading.hillshade && (
                            <div className="ml-auto">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            </div>
                        )}
                    </button>
                    {showHillshade && (
                        <div className="px-2 py-1">
                            <label className="text-[10px] text-gray-600">Opacity: {Math.round(layerOpacity.hillshade * 100)}%</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={layerOpacity.hillshade * 100}
                                onChange={(e) => {
                                    const newOpacity = parseFloat(e.target.value) / 100;
                                    setLayerOpacity({ ...layerOpacity, hillshade: newOpacity });
                                    if (geeLayersRef.current.hillshade) {
                                        geeLayersRef.current.hillshade.eachLayer((layer: any) => {
                                            if (layer.setOpacity) layer.setOpacity(newOpacity);
                                        });
                                    }
                                }}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    )}

                    <div className="w-full h-px bg-gray-300 mt-2"></div>

                    {/* Map Style Buttons */}
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={() => setMapStyle('street')}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${mapStyle === 'street' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            <MapIcon className="w-4 h-4" />
                            <span className="text-xs font-semibold">Street</span>
                        </button>
                        <button
                            onClick={() => setMapStyle('satellite')}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${mapStyle === 'satellite' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            <Layers className="w-4 h-4" />
                            <span className="text-xs font-semibold">Satellite</span>
                        </button>
                        <button
                            onClick={() => setMapStyle('hybrid')}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${mapStyle === 'hybrid' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            <Layers className="w-4 h-4" />
                            <span className="text-xs font-semibold">Hybrid</span>
                        </button>
                        <button
                            onClick={() => setMapStyle('topo')}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${mapStyle === 'topo' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'hover:bg-gray-100 text-gray-700'}`}
                        >
                            <Mountain className="w-4 h-4" />
                            <span className="text-xs font-semibold">Terrain</span>
                        </button>
                    </div>
                </div>
                )}

                {/* Map Controls */}
                {showToolPanel && (
                <div className="absolute top-16 left-4 z-[500] flex flex-col gap-2 max-h-[72vh] overflow-y-auto">
                    <div className="bg-white p-2 rounded-lg shadow-md border border-gray-200 flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                            <ToolButton tool="select" icon={MousePointer2} label="Select" />
                            <ToolButton tool="delete" icon={Trash2} label="Delete" />
                        </div>
                        <div className="h-px bg-gray-200 my-1" />
                        <p className="text-xs font-semibold text-gray-500 mb-1">Source</p>
                        <div className="grid grid-cols-2 gap-2">
                            <ToolButton tool="borehole" icon={CircleDot} label="Borehole" />
                            <ToolButton tool="tank" icon={Cylinder} label="Tank" />
                        </div>
                        <div className="h-px bg-gray-200 my-1" />
                        <p className="text-xs font-semibold text-gray-500 mb-1">Network</p>
                        <div className="grid grid-cols-2 gap-2">
                            <ToolButton tool="pipeMain" icon={Activity} label="Pipe" />
                            <ToolButton tool="tap" icon={Droplets} label="Tap" />
                        </div>
                        {isDrawing && (
                            <button
                                onClick={finishSegment}
                                className="mt-2 bg-green-600 text-white p-2 rounded text-xs font-bold hover:bg-green-700 transition-colors"
                            >
                                Finish Pipe
                            </button>
                        )}
                        <div className="h-px bg-gray-200 my-1" />
                        <p className="text-xs font-semibold text-gray-500 mb-1">Institutions</p>
                        <div className="grid grid-cols-2 gap-2">
                            <ToolButton tool="school" icon={School} label="School" />
                            <ToolButton tool="clinic" icon={Stethoscope} label="Clinic" />
                            <ToolButton tool="garden" icon={Sprout} label="Garden" />
                            <ToolButton tool="grid" icon={Zap} label="Grid" />
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};
