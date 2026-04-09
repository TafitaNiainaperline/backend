const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/lessons/:id — détail d'une leçon (requiert inscription)
router.get('/:id', authenticate, async (req, res) => {
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

    if (lessonResult.rows.length === 0) return res.status(404).json({ message: 'Leçon introuvable' });

    const lesson = lessonResult.rows[0];

    if (!lesson.is_preview) {
      const enrolled = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [req.user.id, lesson.course_id]
      );
      if (enrolled.rows.length === 0) {
        return res.status(403).json({ message: 'Inscription requise' });
      }
    }

    // Progression de l'utilisateur sur cette leçon
    const progress = await pool.query(
      'SELECT * FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2',
      [req.user.id, req.params.id]
    );

    res.json({ 
      ...lesson, 
      progress: progress.rows[0] || null,
      quiz_id: lesson.quiz_id,
      prev_lesson_id: lesson.prev_lesson_id,
      next_lesson_id: lesson.next_lesson_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
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

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
