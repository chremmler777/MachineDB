import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import pool from '../db/connection.js';
import { verifyToken, requireMaster, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Setup multer for file uploads
const uploadDir = '/data/files';
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

    res.json({ message: 'File deleted' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
