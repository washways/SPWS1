# Next Session Plan: Building Footprints Integration

## Current Status
- **Branch:** `feature/building-footprints`
- **Dependencies:** Installed (`pmtiles`, `@turf/turf`)
- **SiteMap.tsx:** Clean state (previous edits reverted to avoid corruption)

## Goal
Implement Phase 1: Building Footprints Overlay

## Action Items for Next Session
1. **Resume Work on Branch:**
   ```powershell
   git checkout feature/building-footprints
   ```

2. **Implement SiteMap.tsx Changes:**
   - Add imports: `import { PMTiles, Protocol } from 'pmtiles';`
   - Add state: `showBuildings`, `buildingsLoading`
   - Add `useEffect` for layer initialization (use `mapInstanceRef`)
   - Add toggle button in the UI

3. **Technical Note:**
   - The file `components/SiteMap.tsx` is large (~800 lines).
   - **Crucial:** When editing, use `replace_file_content` on smaller chunks or use `multi_replace_file_content` with extreme care to avoid file corruption.
   - Do not try to replace the entire file.

4. **Testing:**
   - Verify map loads without errors
   - Toggle "Show Buildings"
   - Confirm PMTiles layer loads (check console logs)

## Future Phases
- **Phase 2:** Spatial Analysis (150m buffer)
- **Phase 3:** Population Calculation
