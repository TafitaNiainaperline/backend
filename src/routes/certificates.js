const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const generateCertNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${timestamp}-${random}`;
};

// POST /api/certificates/generate/:courseId — générer un certificat si cours complété
router.post('/generate/:courseId', authenticate, async (req, res) => {
  const { courseId } = req.params;
  try {
    // Vérifier si déjà certifié
    const existing = await pool.query(
      'SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2',
      [req.user.id, courseId]
    );
    if (existing.rows.length > 0) return res.json(existing.rows[0]);

    // Vérifier la progression (100%)
    const progressResult = await pool.query(`
      SELECT
        COUNT(l.id) AS total_lessons,
        COUNT(lp.id) FILTER (WHERE lp.is_completed = TRUE) AS completed_lessons
      FROM sections s
      JOIN lessons l ON s.id = l.section_id
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
      WHERE s.course_id = $2
    `, [req.user.id, courseId]);

    const { total_lessons, completed_lessons } = progressResult.rows[0];
    if (Number(total_lessons) === 0 || Number(completed_lessons) < Number(total_lessons)) {
      return res.status(400).json({ message: 'Cours non terminé. Complétez toutes les leçons.' });
    }

    const certNumber = generateCertNumber();
    const cert = await pool.query(
      `INSERT INTO certificates (user_id, course_id, certificate_number)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, courseId, certNumber]
    );

    // Marquer l'inscription comme complétée
    await pool.query(
      `UPDATE enrollments SET completed_at = NOW() WHERE user_id = $1 AND course_id = $2`,
      [req.user.id, courseId]
    );

    res.status(201).json(cert.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/certificates — certificats de l'utilisateur
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cert.*, c.title AS course_title, c.slug AS course_slug,
             c.thumbnail_url, cat.name AS category_name,
             u.first_name || ' ' || u.last_name AS student_name
      FROM certificates cert
      JOIN courses c ON cert.course_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      JOIN users u ON cert.user_id = u.id
      WHERE cert.user_id = $1
      ORDER BY cert.issued_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/certificates/verify/:number — vérifier un certificat (public)
router.get('/verify/:number', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cert.certificate_number, cert.issued_at,
             c.title AS course_title, c.level,
             u.first_name || ' ' || u.last_name AS student_name
      FROM certificates cert
      JOIN courses c ON cert.course_id = c.id
      JOIN users u ON cert.user_id = u.id
      WHERE cert.certificate_number = $1
    `, [req.params.number]);

    if (result.rows.length === 0) return res.status(404).json({ message: 'Certificat introuvable', valid: false });
    res.json({ ...result.rows[0], valid: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
