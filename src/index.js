require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const lessonsRoutes = require('./routes/lessons');
const quizzesRoutes = require('./routes/quizzes');
const progressRoutes = require('./routes/progress');
const certificatesRoutes = require('./routes/certificates');
const categoriesRoutes = require('./routes/categories');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/categories', categoriesRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
});
