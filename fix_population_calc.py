import re

file_path = r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: Unwrap the L.geoJSON layer so it's assigned directly to the ref
# Old: osmBuildingLayerRef.current = L.layerGroup([layer]).addTo(mapInstanceRef.current!);
# New: osmBuildingLayerRef.current = layer.addTo(mapInstanceRef.current!);

# We need to find the specific line in the fetchAndDisplayOSMBuildings function
pattern = r'osmBuildingLayerRef\.current = L\.layerGroup\(\[layer\]\)\.addTo\(mapInstanceRef\.current!\);'
replacement = r'osmBuildingLayerRef.current = layer.addTo(mapInstanceRef.current!);'

new_content = re.sub(pattern, replacement, content)

if new_content == content:
    print("Warning: Regex didn't match. Checking for alternative formatting...")
    # Try a looser match if exact match failed
    pattern = r'osmBuildingLayerRef\.current\s*=\s*L\.layerGroup\(\[layer\]\)\.addTo\(mapInstanceRef\.current!\);'
    new_content = re.sub(pattern, replacement, content)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully unwrapped GeoJSON layer. Service population should now calculate correctly.")
else:
    print("Error: Could not find the line to replace.")
