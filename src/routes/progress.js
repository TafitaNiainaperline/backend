const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/progress/courses — tous les cours avec progression de l'utilisateur
router.get('/courses', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.title, c.slug, c.thumbnail_url, c.level, c.duration_minutes,
             e.enrolled_at, e.completed_at,
             COUNT(l.id) AS total_lessons,
             COUNT(lp.id) FILTER (WHERE lp.is_completed = TRUE) AS completed_lessons,
             CASE
               WHEN COUNT(l.id) > 0
               THEN ROUND((COUNT(lp.id) FILTER (WHERE lp.is_completed = TRUE)::DECIMAL / COUNT(l.id)) * 100)
               ELSE 0
             END AS progress_percent
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN sections s ON c.id = s.course_id
      LEFT JOIN lessons l ON s.id = l.section_id
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = e.user_id
      WHERE e.user_id = $1
      GROUP BY c.id, e.enrolled_at, e.completed_at
      ORDER BY e.enrolled_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/progress/courses/:courseId — progression détaillée sur un cours
router.get('/courses/:courseId', authenticate, async (req, res) => {
  try {
    const enrolled = await pool.query(
      'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
      [req.user.id, req.params.courseId]
    );
    if (enrolled.rows.length === 0) return res.status(403).json({ message: 'Non inscrit à ce cours' });

    const sections = await pool.query(`
      SELECT s.id, s.title, s.order_index,
             json_agg(
               json_build_object(
                 'lesson_id', l.id,
                 'title', l.title,
                 'duration_minutes', l.duration_minutes,
                 'is_completed', COALESCE(lp.is_completed, FALSE),
                 'watched_seconds', COALESCE(lp.watched_seconds, 0)
               ) ORDER BY l.order_index
             ) FILTER (WHERE l.id IS NOT NULL) AS lessons
      FROM sections s
      LEFT JOIN lessons l ON s.id = l.section_id
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = $1
      WHERE s.course_id = $2
      GROUP BY s.id
      ORDER BY s.order_index
    `, [req.user.id, req.params.courseId]);

    res.json(sections.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/progress/dashboard — stats globales pour le tableau de bord
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT e.course_id) AS enrolled_courses,
        COUNT(DISTINCT e.course_id) FILTER (WHERE e.completed_at IS NOT NULL) AS completed_courses,
        COUNT(DISTINCT cert.id) AS certificates,
        COUNT(DISTINCT qa.id) AS quiz_attempts,
        COUNT(DISTINCT qa.id) FILTER (WHERE qa.passed = TRUE) AS quizzes_passed,
        COALESCE(SUM(lp.watched_seconds), 0) AS total_watched_seconds
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id
      LEFT JOIN certificates cert ON u.id = cert.user_id
      LEFT JOIN quiz_attempts qa ON u.id = qa.user_id
      LEFT JOIN lesson_progress lp ON u.id = lp.user_id
      WHERE u.id = $1
    `, [req.user.id]);

    const recentActivity = await pool.query(`
      SELECT l.title AS lesson_title, c.title AS course_title, lp.completed_at
      FROM lesson_progress lp
      JOIN lessons l ON lp.lesson_id = l.id
      JOIN sections s ON l.section_id = s.id
      JOIN courses c ON s.course_id = c.id
      WHERE lp.user_id = $1 AND lp.is_completed = TRUE
      ORDER BY lp.completed_at DESC
      LIMIT 5
    `, [req.user.id]);

    res.json({
      stats: stats.rows[0],
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
