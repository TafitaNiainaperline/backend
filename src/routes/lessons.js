const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/lessons/:id — détail d'une leçon (requiert inscription)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!id || id === 'undefined') {
    return res.status(400).json({ message: 'ID de lecon invalide' });
  }
  
  try {
    const lessonResult = await pool.query(`
      SELECT l.*, s.course_id,
             q.id AS quiz_id,
             LAG(l.id) OVER (ORDER BY s.order_index, l.order_index) AS prev_lesson_id,
             LEAD(l.id) OVER (ORDER BY s.order_index, l.order_index) AS next_lesson_id
      FROM lessons l
      JOIN sections s ON l.section_id = s.id
      LEFT JOIN quizzes q ON l.id = q.lesson_id
      WHERE l.id = $1
    `, [req.params.id]);

    if (lessonResult.rows.length === 0) return res.status(404).json({ message: 'Lecon introuvable' });

    const lesson = lessonResult.rows[0];

    // Check if it's a preview lesson - allow without authentication
    const isPreview = lesson.is_preview;
    
    // For non-preview lessons, check authentication and enrollment
    if (!isPreview) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Vous devez etre conecte pour acceder a cette lecon' });
      }
      
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        
        const enrolled = await pool.query(
          'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
          [decoded.id, lesson.course_id]
        );
        if (enrolled.rows.length === 0) {
          return res.status(403).json({ message: 'Vous devez etre inscrit au cours pour acceder a cette lecon' });
        }
        
        // Get progress
        const progress = await pool.query(
          'SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
          [decoded.id, req.params.id]
        );
        
        return res.json({ 
          ...lesson, 
          progress: progress.rows[0] || null,
          quiz_id: lesson.quiz_id,
          prev_lesson_id: lesson.prev_lesson_id,
          next_lesson_id: lesson.next_lesson_id
        });
      } catch (jwtErr) {
        return res.status(401).json({ message: 'Token invalide ou expire' });
      }
    }

    // For preview lessons - no authentication required
    res.json({ 
      ...lesson, 
      progress: null,
      quiz_id: lesson.quiz_id,
      prev_lesson_id: lesson.prev_lesson_id,
      next_lesson_id: lesson.next_lesson_id
    });
  } catch (err) {
    console.error('Lesson API error:', err);
    res.status(500).json({ message: 'Erreur serveur: ' + err.message });
  }
});

// POST /api/lessons/:id/progress — mettre à jour la progression
router.post('/:id/progress', authenticate, async (req, res) => {
  const { watched_seconds, is_completed } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO lesson_progress (user_id, lesson_id, watched_seconds, is_completed, completed_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, lesson_id) DO UPDATE
        SET watched_seconds = GREATEST(lesson_progress.watched_seconds, EXCLUDED.watched_seconds),
            is_completed = EXCLUDED.is_completed,
            completed_at = CASE WHEN EXCLUDED.is_completed = TRUE THEN NOW() ELSE lesson_progress.completed_at END
      RETURNING *
    `, [req.user.id, req.params.id, watched_seconds || 0, is_completed || false, is_completed ? new Date() : null]);

    if (is_completed) {
      const lessonResult = await pool.query(`
        SELECT l.id, l.title, s.course_id, c.title as course_title
        FROM lessons l
        JOIN sections s ON l.section_id = s.id
        JOIN courses c ON s.course_id = c.id
        WHERE l.id = $1
      `, [req.params.id]);

      if (lessonResult.rows.length > 0) {
        const { course_id, title: lesson_title } = lessonResult.rows[0];
        
        const existingCert = await pool.query(
          'SELECT * FROM certificates WHERE user_id = $1 AND course_id = $2',
          [req.user.id, course_id]
        );

        if (existingCert.rows.length === 0) {
          const certNumber = 'CERT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          
          await pool.query(
            `INSERT INTO certificates (user_id, course_id, certificate_number) VALUES ($1, $2, $3)`,
            [req.user.id, course_id, certNumber]
          );
        }
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Progress API error:', err);
    res.status(500).json({ message: 'Erreur serveur: ' + err.message });
  }
});

module.exports = router;
