const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/documents');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Seuls les fichiers PDF sont autorisés'));
  }
});

router.post('/lessons/:id/document', authenticate, requireRole('instructor', 'admin'), upload.single('document'), async (req, res) => {
  const { id } = req.params;
  
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier uploadé' });
  }

  try {
    const lessonResult = await pool.query('SELECT * FROM lessons WHERE id = $1', [id]);
    if (lessonResult.rows.length === 0) {
      return res.status(404).json({ message: 'Leçon introuvable' });
    }

    const documentUrl = `/uploads/documents/${req.file.filename}`;
    
    await pool.query(
      'UPDATE lessons SET document_url = $1, updated_at = NOW() WHERE id = $2',
      [documentUrl, id]
    );

    res.json({ 
      message: 'Document uploadé avec succès',
      document_url: documentUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
