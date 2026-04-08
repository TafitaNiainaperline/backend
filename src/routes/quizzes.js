const express = require('express');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/quizzes/:id — récupérer un quiz avec ses questions
router.get('/:id', authenticate, async (req, res) => {
  try {
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizResult.rows.length === 0) return res.status(404).json({ message: 'Quiz introuvable' });

    const questions = await pool.query(`
      SELECT q.id, q.question_text, q.order_index,
             json_agg(
               json_build_object(
                 'id', ao.id,
                 'option_text', ao.option_text,
                 'order_index', ao.order_index
               ) ORDER BY ao.order_index
             ) AS options
      FROM questions q
      LEFT JOIN answer_options ao ON q.id = ao.question_id
      WHERE q.quiz_id = $1
      GROUP BY q.id
      ORDER BY q.order_index
    `, [req.params.id]);

    res.json({ ...quizResult.rows[0], questions: questions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/quizzes/:id/attempt — soumettre les réponses
router.post('/:id/attempt', authenticate, async (req, res) => {
  const { answers } = req.body; // { questionId: optionId, ... }
  try {
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [req.params.id]);
    if (quizResult.rows.length === 0) return res.status(404).json({ message: 'Quiz introuvable' });

    const quiz = quizResult.rows[0];

    // Récupérer les bonnes réponses
    const correctResult = await pool.query(`
      SELECT q.id AS question_id, ao.id AS correct_option_id
      FROM questions q
      JOIN answer_options ao ON q.id = ao.question_id AND ao.is_correct = TRUE
      WHERE q.quiz_id = $1
    `, [req.params.id]);

    let correct = 0;
    const total = correctResult.rows.length;

    for (const row of correctResult.rows) {
      if (answers[row.question_id] === row.correct_option_id) {
        correct++;
      }
    }

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= quiz.passing_score;

    const attempt = await pool.query(`
      INSERT INTO quiz_attempts (user_id, quiz_id, score, passed, answers)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [req.user.id, req.params.id, score, passed, JSON.stringify(answers)]);

    res.json({ score, passed, correct, total, attempt: attempt.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// GET /api/quizzes/:id/attempts — historique des tentatives
router.get('/:id/attempts', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM quiz_attempts WHERE user_id = $1 AND quiz_id = $2 ORDER BY attempted_at DESC',
      [req.user.id, req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
