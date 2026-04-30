import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import pool from '../db/connection.js';
import { verifyToken, requireMaster, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Setup multer for file uploads
const uploadDir = process.env.FILES_DIR || '/tmp/machinedb-files';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });

// List files for a machine
router.get('/machine/:machineId', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { machineId } = req.params;

    const result = await pool.query(
      `SELECT f.*, u.username FROM machine_files f
       LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.machine_id = $1
       ORDER BY f.uploaded_at DESC`,
      [machineId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload file
router.post('/machine/:machineId/upload', verifyToken, requireMaster, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { machineId } = req.params;
    const { file_type, description } = req.body;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Verify machine exists
    const machineCheck = await pool.query('SELECT id FROM machines WHERE id = $1', [machineId]);
    if (machineCheck.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO machine_files (machine_id, file_name, file_type, file_path, file_size, uploaded_by, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [machineId, req.file.originalname, file_type || 'document', req.file.path, req.file.size, req.user?.userId, description]
    );

    // Log WAM uploads as machine revisions
    if (file_type === 'wam') {
      const revResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [machineId]);
      const nextRevision = (revResult.rows[0].max_rev || 0) + 1;
      await pool.query(
        `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, change_summary)
         VALUES ($1, $2, $3, 'wam_upload', $4)`,
        [machineId, nextRevision, req.user?.userId, `WAM uploaded: ${req.file.originalname} (${(req.file.size / 1024).toFixed(0)} KB)`]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download file
router.get('/download/:fileId', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query('SELECT * FROM machine_files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = result.rows[0];
    res.download(file.file_path, file.file_name);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Inline view: streams PDF as-is, converts TIFF -> PNG on the fly
router.get('/view/:fileId', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const result = await pool.query('SELECT * FROM machine_files WHERE id = $1', [fileId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const file = result.rows[0];
    if (!fs.existsSync(file.file_path)) {
      res.status(404).json({ error: 'File missing on disk' });
      return;
    }
    const ext = path.extname(file.file_name).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      fs.createReadStream(file.file_path).pipe(res);
      return;
    }
    if (ext === '.tif' || ext === '.tiff') {
      res.setHeader('Content-Type', 'image/png');
      const proc = spawn('magick', [file.file_path, '-resize', '2000x2000>', '-quality', '90', 'png:-']);
      proc.stdout.pipe(res);
      proc.stderr.on('data', d => console.error('magick:', d.toString()));
      proc.on('error', err => {
        console.error('magick spawn error', err);
        if (!res.headersSent) res.status(500).json({ error: 'Conversion failed' });
      });
      proc.on('close', code => {
        if (code !== 0 && !res.headersSent) res.status(500).json({ error: `Conversion exited ${code}` });
      });
      return;
    }
    res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
    fs.createReadStream(file.file_path).pipe(res);
  } catch (error) {
    console.error('View file error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete file
router.delete('/:fileId', verifyToken, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    const result = await pool.query('SELECT * FROM machine_files WHERE id = $1', [fileId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const file = result.rows[0];

    // Delete file from filesystem
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // Delete record from database
    await pool.query('DELETE FROM machine_files WHERE id = $1', [fileId]);

    // Log WAM deletions as machine revisions
    if (file.file_type === 'wam') {
      const revResult = await pool.query('SELECT MAX(revision_number) as max_rev FROM machine_revisions WHERE machine_id = $1', [file.machine_id]);
      const nextRevision = (revResult.rows[0].max_rev || 0) + 1;
      await pool.query(
        `INSERT INTO machine_revisions (machine_id, revision_number, changed_by, change_type, change_summary)
         VALUES ($1, $2, $3, 'wam_delete', $4)`,
        [file.machine_id, nextRevision, req.user?.userId, `WAM deleted: ${file.file_name}`]
      );
    }

    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
