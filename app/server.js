import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();
const PORT = 3001;

// ---------- PATHS ----------
const ROOT = process.cwd();
const MODELS_DIR = path.join(ROOT, 'models');
const FRONTEND_DIST = path.join(ROOT, 'frontendGaleria', 'dist');
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // matches client_max_body_size in nginx.conf

// Accepts only a plain "<name>.glb" file name and returns its absolute path
// inside MODELS_DIR. Returns null for anything else (e.g. "../server.js").
function resolveModelPath(name) {
    if (typeof name !== 'string') return null;
    const base = path.basename(name);
    if (base !== name || !/^[\w\-. ]+\.glb$/i.test(base)) return null;
    const fullPath = path.resolve(MODELS_DIR, base);
    if (!fullPath.startsWith(MODELS_DIR + path.sep)) return null;
    return fullPath;
}

// ---------- DB ----------
const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ---------- INIT ----------
if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR);
}

async function initDatabase() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS models (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      size INTEGER NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `);

    const files = fs
        .readdirSync(MODELS_DIR)
        .filter(f => f.endsWith('.glb'));

    for (const file of files) {
        const filePath = path.join(MODELS_DIR, file);
        const stats = fs.statSync(filePath);

        await pool.query(
            `INSERT INTO models (filename, size)
       VALUES ($1, $2)
       ON CONFLICT (filename) DO NOTHING`,
            [file, stats.size]
        );
    }

    console.log('DB initialized from models folder');
}

initDatabase().catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});


// ---------- MIDDLEWARE ----------
app.use(express.json({ limit: '100kb' }));
app.use('/models', express.static(MODELS_DIR));
app.use(express.static(FRONTEND_DIST));

// ---------- UPLOAD ----------
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, MODELS_DIR),
    filename: (_, file, cb) => cb(null, path.basename(file.originalname)),
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_, file, cb) => {
        if (resolveModelPath(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('Only .glb files with a simple file name are allowed'));
        }
    },
});

app.post('/api/upload', upload.single('model'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'no file uploaded' });
    }

    try {
        const { filename, size } = req.file;

        await pool.query(
            `INSERT INTO models (filename, size)
         VALUES ($1, $2)
         ON CONFLICT (filename) DO NOTHING`,
            [filename, size]
        );

        res.json({ filename });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'upload failed' });
    }
});


// ---------- LIST ----------
app.get('/api/models', async (_, res) => {
    try {
        const result = await pool.query(`
            SELECT filename, size, uploaded_at
            FROM models
            ORDER BY uploaded_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json([]);
    }
});


// ---------- DELETE ----------
app.delete('/api/models/:name', async (req, res) => {
    try {
        const filename = req.params.name;
        const filePath = resolveModelPath(filename);
        if (!filePath) {
            return res.status(400).json({ error: 'invalid file name' });
        }

        await pool.query(
            `DELETE FROM models WHERE filename = $1`,
            [filename]
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'delete failed' });
    }
});

// ---------- ERRORS ----------
// eslint-disable-next-line no-unused-vars
app.use('/api', (err, req, res, next) => {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    res.status(status).json({ error: err.message });
});

// ---------- SPA ----------
app.get('*', (_, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
    console.log('APP running on port', PORT);
});






