import re

# Read the file
with open(r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the map controls section - using exact match
old_pattern = r'{loadingElevation && <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-blue-600 flex items-center gap-2 z-\[400\]"><Activity className="w-3 h-3 animate-spin" /> Fetching Elevation\.\.\.</div>}\s*<div className="absolute top-4 right-4 bg-white rounded-lg shadow-md border border-gray-200 p-1 flex z-\[400\]">\s*<button onClick=\{\(\) => setMapStyle\(\'street\'\)\} className=\{`p-1\.5 rounded \$\{mapStyle === \'street\' \? \'bg-gray-200\' : \'hover:bg-gray-100\'\}`\} title="Street View"><MapIcon className="w-4 h-4 text-gray-700" /></button>\s*<button onClick=\{\(\) => setMapStyle\(\'satellite\'\)\} className=\{`p-1\.5 rounded \$\{mapStyle === \'satellite\' \? \'bg-gray-200\' : \'hover:bg-gray-100\'\}`\} title="Satellite View"><Layers className="w-4 h-4 text-gray-700" /></button>\s*<button onClick=\{\(\) => setMapStyle\(\'topo\'\)\} className=\{`p-1\.5 rounded \$\{mapStyle === \'topo\' \? \'bg-gray-200\' : \'hover:bg-gray-100\'\}`\} title="Terrain/Topography"><Mountain className="w-4 h-4 text-gray-700" /></button>\s*</div>'

new_controls = '''{loadingElevation && <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-blue-600 flex items-center gap-2 z-[400]"><Activity className="w-3 h-3 animate-spin" /> Fetching Elevation...</div>}
            {buildingsLoading && <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full shadow text-xs font-bold text-green-600 flex items-center gap-2 z-[400]"><Activity className="w-3 h-3 animate-spin" /> Loading Buildings...</div>}
            <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md border border-gray-200 p-1 flex flex-col gap-1 z-[400]">
                <div className="flex gap-1">
                    <button onClick={() => setShowOSMBuildings(!showOSMBuildings)} className={`p-1.5 rounded ${showOSMBuildings ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}`} title="OSM Buildings (Development)"><Home className="w-4 h-4" /></button>
                    <button onClick={() => setShowGoogleBuildings(!showGoogleBuildings)} className={`p-1.5 rounded ${showGoogleBuildings ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100 text-gray-700'}`} title="Google Buildings (Production Only)"><Box className="w-4 h-4" /></button>
                </div>
                <div className="w-full h-px bg-gray-300"></div>
                <div className="flex gap-1">
                    <button onClick={() => setMapStyle('street')} className={`p-1.5 rounded ${mapStyle === 'street' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Street View"><MapIcon className="w-4 h-4 text-gray-700" /></button>
                    <button onClick={() => setMapStyle('satellite')} className={`p-1.5 rounded ${mapStyle === 'satellite' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Satellite View"><Layers className="w-4 h-4 text-gray-700" /></button>
                    <button onClick={() => setMapStyle('topo')} className={`p-1.5 rounded ${mapStyle === 'topo' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} title="Terrain/Topography"><Mountain className="w-4 h-4 text-gray-700" /></button>
                </div>
            </div>'''

content = re.sub(old_pattern, new_controls, content, flags=re.DOTALL)

with open(r'c:\Users\jrobertson\Downloads\SPWS1\components\SiteMap.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Step 3/3 complete: Updated map controls UI with building buttons')
