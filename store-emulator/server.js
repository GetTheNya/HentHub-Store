const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const STORE_ROOT = path.join(__dirname, 'mock_github'); 

app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 

// Upload endpoint
app.post('/upload', (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        
        if (!filePath || !content) {
            return res.status(400).json({ error: 'Missing path or content' });
        }

        const fullPath = path.join(STORE_ROOT, filePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            console.log(`[DIR] Creating directory: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }

        const buffer = Buffer.from(content, 'base64');
        if (buffer.length === 0) {
            throw new Error('Empty file content received');
        }

        fs.writeFileSync(fullPath, buffer);

        console.log(`[SAVED] ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
        res.json({ success: true });
    } catch (err) {
        console.error(`[ERROR] Save failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Update manifest endpoint (simplified for local)
app.post('/update-manifest', (req, res) => {
    const { path: filePath, content } = req.body;
    const fullPath = path.join(STORE_ROOT, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
    console.log(`[MANIFEST UPDATED] ${filePath}`);
    res.json({ success: true });
});

// Deletion endpoint
app.post('/delete-app', (req, res) => {
    const { appId } = req.body;
    const manifestPath = path.join(STORE_ROOT, 'manifests', 'store-manifest.json');

    if (!fs.existsSync(manifestPath)) {
        return res.status(404).json({ error: 'Manifest not found' });
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const initialCount = manifest.apps.length;
        manifest.apps = manifest.apps.filter(app => app.appId.toUpperCase() !== appId.toUpperCase());
        
        if (manifest.apps.length === initialCount) {
            return res.status(404).json({ error: 'App not found in manifest' });
        }

        manifest.lastUpdated = new Date().toISOString();
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        
        console.log(`[DELETED] App ID: ${appId}`);
        res.json({ success: true });
    } catch (err) {
        console.error(`[ERROR] Deletion failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Reset endpoint to clear all mock data
app.post('/reset', (req, res) => {
    try {
        const dirs = ['packages', 'assets', 'manifests'];
        dirs.forEach(d => {
            const fullPath = path.join(STORE_ROOT, d);
            if (fs.existsSync(fullPath)) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            }
            fs.mkdirSync(fullPath, { recursive: true });
        });
        
        // Re-initialize manifest
        const manifestPath = path.join(STORE_ROOT, 'manifests', 'store-manifest.json');
        fs.writeFileSync(manifestPath, JSON.stringify({ apps: [], lastUpdated: "" }, null, 2));

        console.log('[RESET] All mock data cleared.');
        res.json({ success: true });
    } catch (err) {
        console.error(`[ERROR] Reset failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Serve Store Website
const STORE_WEB_ROOT = path.join(__dirname, '..', 'store');
app.use('/store', express.static(STORE_WEB_ROOT));

// Download endpoint for packages
app.use('/', express.static(STORE_ROOT));

app.listen(PORT, () => {
    console.log(`🚀 HentHub Store Emulator running at http://localhost:${PORT}/store`);
    console.log(`🌍 Access Store: http://localhost:${PORT}/store/upload.html`);
    console.log(`📂 Files land in: ${STORE_ROOT}`);
});
