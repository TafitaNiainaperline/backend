const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cat.*, COUNT(c.id) AS course_count
      FROM categories cat
      LEFT JOIN courses c ON cat.id = c.category_id AND c.is_published = TRUE
      GROUP BY cat.id
      ORDER BY cat.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
