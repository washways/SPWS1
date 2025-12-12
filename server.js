import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'analytics_data.json');

// Middleware
app.use(cors());
app.use(express.json());

// Initialize data file if it doesn't exist
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
        console.log('analytics_data.json already exists');
    } catch {
        const initialData = { reports: [], feedback: [] };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('Created analytics_data.json');
    }
}

// Read data from file
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading data:', error);
        return { reports: [], feedback: [] };
    }
}

// Write data to file
async function writeData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing data:', error);
        throw error;
    }
}

// API Routes

// Log a new report
app.post('/api/log_report', async (req, res) => {
    try {
        const reportData = req.body;
        const data = await readData();

        const newReport = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            ...reportData
        };

        data.reports.unshift(newReport);

        // Keep only last 500 reports to prevent file from growing too large
        if (data.reports.length > 500) {
            data.reports = data.reports.slice(0, 500);
        }

        await writeData(data);

        console.log(`✅ Report logged: ${newReport.siteName || 'Unnamed'} - ${newReport.winner}`);
        res.json({ success: true, id: newReport.id });
    } catch (error) {
        console.error('❌ Error logging report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit feedback
app.post('/api/feedback', async (req, res) => {
    try {
        const { message } = req.body;
        const data = await readData();

        const newFeedback = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            message
        };

        data.feedback.unshift(newFeedback);

        // Keep only last 100 feedback entries
        if (data.feedback.length > 100) {
            data.feedback = data.feedback.slice(0, 100);
        }

        await writeData(data);

        console.log('✅ Feedback received');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error saving feedback:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get dashboard statistics
app.get('/api/get_stats', async (req, res) => {
    try {
        const data = await readData();
        const reports = data.reports || [];

        // Return reports with mapped field names for frontend compatibility
        const mappedReports = reports.map(report => ({
            id: report.id,
            timestamp: report.timestamp,
            site_name: report.siteName,
            contract_number: report.contractNumber,
            population_initial: report.population,
            population_design: report.designPopulation,
            system_type: report.systemType,
            solar_capex: report.solarCapex,
            handpump_capex: report.handpumpCapex,
            solar_net_value: report.solarNetValue,
            handpump_net_value: report.handpumpNetValue,
            winner: report.winner,
            time_spent_seconds: report.timeSpentSeconds
        }));

        console.log(`📊 Stats requested: ${reports.length} reports`);
        res.json(mappedReports);
    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- GEE INTEGRATION ---
import ee from '@google/earthengine';

const KEY_FILE = path.join(__dirname, 'gee-key.json');
let geeInitialized = false;

async function initGEE() {
    try {
        // Check for Service Account Key
        try {
            await fs.access(KEY_FILE);
        } catch {
            console.warn('⚠️ GEE Key not found (gee-key.json). Geo-layers will not work.');
            return;
        }

        const privateKey = JSON.parse(await fs.readFile(KEY_FILE, 'utf8'));

        console.log('Authenticating with Google Earth Engine...');
        await new Promise((resolve, reject) => {
            ee.data.authenticateViaPrivateKey(privateKey, () => {
                ee.initialize(null, null, () => {
                    geeInitialized = true;
                    console.log('✅ Google Earth Engine Initialized');
                    resolve();
                }, (e) => reject(e));
            }, (e) => reject(e));
        });

    } catch (error) {
        console.error('❌ GEE Init Failed:', error);
    }
}

// Call init
initGEE();

// GEE Layer Endpoint
app.get('/api/get_gee_layer', async (req, res) => {
    if (!geeInitialized) {
        return res.status(503).json({ error: 'GEE not initialized. Backend missing gee-key.json.' });
    }

    const { type } = req.query; // dtw, gw, dem

    try {
        let image;
        let vizParams;

        // Use Malawi Geometry for clipping if possible, but here we just grab the asset
        if (type === 'dtw') {
            image = ee.Image('users/washways/DTW_estimated_depth_Malawi_v1_py').select(0);
            vizParams = {
                min: 5, max: 95,
                palette: ['#0015ff', '#00a4ff', '#00fff0', '#00ff00', '#ccff00', '#ff8800', '#ff0000']
            };
        } else if (type === 'gw') {
            image = ee.Image('users/washways/GW_Potential_Malawi_v1_py').select(0);
            vizParams = {
                min: 5, max: 95,
                palette: ['#8b0000', '#ff4500', '#ffd700', '#7fff00', '#006400']
            };
        } else if (type === 'dem') {
            image = ee.Image('projects/sat-io/open-datasets/FABDEM');
            vizParams = {
                min: 300, max: 2000,
                palette: ['#081d58', '#253494', '#225ea8', '#1d91c0', '#41b6c4', '#7fcdbb', '#c7e9b4', '#edf8b1']
            };
        } else {
            return res.status(400).json({ error: 'Unknown layer type' });
        }

        const mapId = await new Promise((resolve, reject) => {
            image.getMap(vizParams, (mapId) => resolve(mapId));
        });

        res.json({ success: true, urlFormat: mapId.urlFormat });

    } catch (e) {
        console.error('GEE Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
async function startServer() {
    await initDataFile();
    app.listen(PORT, () => {
        console.log(`\n🚀 Analytics server running on http://localhost:${PORT}`);
        console.log(`📁 Data file: ${DATA_FILE}`);
        console.log(`\n📡 Endpoints:`);
        console.log(`   POST /api/log_report`);
        console.log(`   POST /api/feedback`);
        console.log(`   GET  /api/get_stats`);
        console.log(`   GET  /api/health\n`);
    });
}

startServer().catch(console.error);
