import re

file_path = r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix Delete Button: Set interactive: false on buffer layers
# We need to find the L.circle and L.polygon calls in the spatial analysis useEffect
# and add interactive: false

# Replace L.circle options
content = content.replace(
    "L.circle(ll, { radius: bufferDistance, color: '#22c55e', weight: 0, fillOpacity: 0.2 })",
    "L.circle(ll, { radius: bufferDistance, color: '#22c55e', weight: 0, fillOpacity: 0.2, interactive: false })"
)

# Replace L.polygon options
content = content.replace(
    "L.polygon(polyCoords as any, { color: '#22c55e', weight: 0, fillOpacity: 0.2 })",
    "L.polygon(polyCoords as any, { color: '#22c55e', weight: 0, fillOpacity: 0.2, interactive: false })"
)

# 2. Add Logging to debug Service Coverage
# Find the start of the useEffect logic
log_insert_point = "let servedCount = 0;"
new_log = "console.log('Running Spatial Analysis...');\n        let servedCount = 0;"
content = content.replace(log_insert_point, new_log)

# Log the result
result_log_point = "setServedPop(servedCount * peoplePerBuilding);"
new_result_log = "console.log(`Served: ${servedCount}, Unserved: ${unservedCount}, Total Pop: ${servedCount * peoplePerBuilding}`);\n        setServedPop(servedCount * peoplePerBuilding);"
content = content.replace(result_log_point, new_result_log)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully applied fixes: interactive: false for buffer, and added debug logs.")
