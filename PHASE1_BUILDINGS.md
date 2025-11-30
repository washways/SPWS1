# Phase 1: Building Overlay - Implementation

## Goal
Add a toggleable layer showing building footprints from the VIDA dataset on the map.

## What Phase 1 Includes
- ✅ PMTiles layer integration
- ✅ Building footprints visible on map
- ✅ Toggle control to show/hide buildings
- ✅ Basic styling (all buildings same color)
- ✅ Loading indicator

## What Phase 1 Does NOT Include
- ❌ Spatial analysis (150m buffer)
- ❌ Building classification (served/unserved)
- ❌ Population calculation
- ❌ Different colors for served/unserved

These will come in Phase 2 and Phase 3.

## Technical Implementation

### Dependencies
- `pmtiles`: Read PMTiles archives
- `@turf/turf`: Geospatial utilities (for future phases)

### Changes to SiteMap.tsx
1. Import PMTiles library
2. Add "Show Buildings" toggle button
3. Initialize PMTiles source with VIDA URL
4. Create Leaflet layer for buildings
5. Add/remove layer when toggled
6. Style buildings as semi-transparent polygons

## Testing
1. Open Design Map
2. Click "Show Buildings" toggle
3. Buildings should appear as overlay
4. Toggle off - buildings disappear
5. Zoom in/out - buildings load at appropriate detail

## Next Steps (Phase 2)
- Add service buffer calculation
- Classify buildings as served/unserved
- Color-code buildings
- Add building count display
