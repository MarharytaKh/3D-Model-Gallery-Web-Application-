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

initDatabase();


// ---------- MIDDLEWARE ----------
app.use(express.json());
app.use('/models', express.static(MODELS_DIR));
app.use(express.static(FRONTEND_DIST));

// ---------- UPLOAD ----------
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, MODELS_DIR),
    filename: (_, file, cb) => cb(null, file.originalname),
});

const upload = multer({ storage });

app.post('/api/upload', upload.single('model'), async (req, res) => {
    console.log('UPLOAD FILE:', req.file);

    const { originalname, size } = req.file;

    await pool.query(
        `INSERT INTO models (filename, size)
     VALUES ($1, $2)
     ON CONFLICT (filename) DO NOTHING`,
        [originalname, size]
    );

    res.json({ filename: originalname });
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
        const filePath = path.join(MODELS_DIR, filename);

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

// ---------- SPA ----------
app.get('*', (_, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
    console.log('APP running on port', PORT);
});






