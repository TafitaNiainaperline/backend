const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/courses — liste publique des cours publiés
router.get('/', async (req, res) => {
  const { category, level, search, page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT c.id, c.title, c.slug, c.description, c.thumbnail_url,
           c.level, c.duration_minutes, c.price, c.is_published,
           cat.name AS category_name, cat.slug AS category_slug,
           u.first_name || ' ' || u.last_name AS instructor_name,
           COUNT(DISTINCT e.id) AS enrollment_count
    FROM courses c
    LEFT JOIN categories cat ON c.category_id = cat.id
    LEFT JOIN users u ON c.instructor_id = u.id
    LEFT JOIN enrollments e ON c.id = e.course_id
    WHERE c.is_published = TRUE
  `;
  const params = [];

  if (category) {
    params.push(category);
    query += ` AND cat.slug = $${params.length}`;
  }
  if (level) {
    params.push(level);
    query += ` AND c.level = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    query += ` AND c.title ILIKE $${params.length}`;
  }

  query += ` GROUP BY c.id, cat.name, cat.slug, u.first_name, u.last_name`;
  params.push(limit, offset);
  query += ` ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  try {
    const result = await pool.query(query, params);
    res.json({ courses: result.rows, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/courses/:slug — détail d'un cours
router.get('/:slug', async (req, res) => {
  try {
    const courseResult = await pool.query(`
      SELECT c.*, cat.name AS category_name,
             u.first_name || ' ' || u.last_name AS instructor_name,
             u.avatar_url AS instructor_avatar
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.slug = $1 AND c.is_published = TRUE
    `, [req.params.slug]);

    if (courseResult.rows.length === 0) return res.status(404).json({ message: 'Cours introuvable' });

    const course = courseResult.rows[0];

    const sectionsResult = await pool.query(`
      SELECT s.id, s.title, s.order_index,
             json_agg(
               json_build_object(
                 'id', l.id,
                 'title', l.title,
                 'duration_minutes', l.duration_minutes,
                 'is_preview', l.is_preview,
                 'order_index', l.order_index
               ) ORDER BY l.order_index
             ) FILTER (WHERE l.id IS NOT NULL) AS lessons
      FROM sections s
      LEFT JOIN lessons l ON s.id = l.section_id
      WHERE s.course_id = $1
      GROUP BY s.id
      ORDER BY s.order_index
    `, [course.id]);

    res.json({ ...course, sections: sectionsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/courses — créer un cours (instructor/admin)
router.post('/', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { title, slug, description, thumbnail_url, category_id, level, price } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO courses (title, slug, description, thumbnail_url, instructor_id, category_id, level, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, slug, description, thumbnail_url, req.user.id, category_id, level || 'beginner', price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/courses/:id/enroll — s'inscrire à un cours
router.post('/:id/enroll', authenticate, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );
    res.status(201).json({ message: 'Inscription réussie' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
