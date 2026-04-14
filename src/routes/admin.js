const express = require('express');
const pool = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const coursesResult = await pool.query('SELECT COUNT(*) as count FROM courses WHERE is_published = TRUE');
    const studentsResult = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
    const certificatesResult = await pool.query('SELECT COUNT(*) as count FROM certificates');
    const lessonsResult = await pool.query('SELECT COUNT(*) as count FROM lessons');

    res.json({
      total_courses: Number(coursesResult.rows[0].count),
      total_students: Number(studentsResult.rows[0].count),
      total_certificates: Number(certificatesResult.rows[0].count),
      total_lessons: Number(lessonsResult.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/courses', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, cat.name as category_name,
             u.first_name || ' ' || u.last_name as instructor_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/courses/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const courseResult = await pool.query('SELECT * FROM courses WHERE id = $1', [req.params.id]);
    if (courseResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cours introuvable' });
    }

    const sectionsResult = await pool.query(`
      SELECT s.id, s.title, s.order_index,
             json_agg(
               json_build_object(
                 'id', l.id,
                 'title', l.title,
                 'duration_minutes', l.duration_minutes,
                 'order_index', l.order_index,
                 'document_url', l.document_url
               ) ORDER BY l.order_index
             ) FILTER (WHERE l.id IS NOT NULL) AS lessons
      FROM sections s
      LEFT JOIN lessons l ON s.id = l.section_id
      WHERE s.course_id = $1
      GROUP BY s.id
      ORDER BY s.order_index
    `, [req.params.id]);

    res.json({ ...courseResult.rows[0], sections: sectionsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/courses', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { title, slug, description, level, category_id, duration_minutes } = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO courses (title, slug, description, level, category_id, instructor_id, duration_minutes, is_published)
      VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
      RETURNING *
    `, [title, slug, description || title, level, category_id, req.user.id, duration_minutes || 0]);
    
    const courseId = result.rows[0].id;
    
    await pool.query(`
      INSERT INTO sections (course_id, title, order_index)
      VALUES ($1, 'Introduction', 1)
    `, [courseId]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.post('/courses/:id/lessons', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { title, duration_minutes, is_preview } = req.body;
  
  try {
    let sectionResult = await pool.query('SELECT id FROM sections WHERE course_id = $1 ORDER BY order_index LIMIT 1', [id]);
    
    let sectionId;
    if (sectionResult.rows.length === 0) {
      const newSection = await pool.query(`
        INSERT INTO sections (course_id, title, order_index)
        VALUES ($1, 'Introduction', 1)
        RETURNING id
      `, [id]);
      sectionId = newSection.rows[0].id;
    } else {
      sectionId = sectionResult.rows[0].id;
    }
    
    const maxOrderResult = await pool.query('SELECT MAX(order_index) as max_order FROM lessons WHERE section_id = $1', [sectionId]);
    const newOrder = (maxOrderResult.rows[0].max_order || 0) + 1;
    
    const result = await pool.query(`
      INSERT INTO lessons (section_id, title, duration_minutes, is_preview, order_index)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [sectionId, title, duration_minutes || 10, is_preview || false, newOrder]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.patch('/courses/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { title, description, level, category_id, duration_minutes, is_published } = req.body;
  
  try {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) { fields.push(`title = $${paramCount++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description = $${paramCount++}`); values.push(description); }
    if (level !== undefined) { fields.push(`level = $${paramCount++}`); values.push(level); }
    if (category_id !== undefined) { fields.push(`category_id = $${paramCount++}`); values.push(category_id); }
    if (duration_minutes !== undefined) { fields.push(`duration_minutes = $${paramCount++}`); values.push(duration_minutes); }
    if (is_published !== undefined) { fields.push(`is_published = $${paramCount++}`); values.push(is_published); }
    
    values.push(id);
    
    const result = await pool.query(`UPDATE courses SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cours introuvable' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.delete('/courses/:id', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Cours supprimé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/students', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.created_at,
             COALESCE((SELECT COUNT(*) FROM enrollments WHERE user_id = u.id), 0) as enrolled_courses,
             COALESCE((SELECT COUNT(DISTINCT course_id) FROM enrollments 
              WHERE user_id = u.id AND completed_at IS NOT NULL), 0) as completed_courses
      FROM users u
      WHERE u.role = 'student'
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

router.get('/certificates', authenticate, requireRole('instructor', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cert.id, cert.user_id, cert.course_id, cert.certificate_number, cert.issued_at,
             u.first_name || ' ' || u.last_name as user_name, u.email as user_email,
             c.title as course_title
      FROM certificates cert
      JOIN users u ON cert.user_id = u.id
      JOIN courses c ON cert.course_id = c.id
      ORDER BY cert.issued_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
