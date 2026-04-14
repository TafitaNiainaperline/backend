require('dotenv').config();
const pool = require('./pool');

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Courses
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        level VARCHAR(20) DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
        duration_minutes INTEGER DEFAULT 0,
        is_published BOOLEAN DEFAULT FALSE,
        price DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Sections (chapitres d'un cours)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Lessons (leçons vidéo)
    await client.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        document_url TEXT,
        duration_minutes INTEGER DEFAULT 0,
        order_index INTEGER NOT NULL,
        is_preview BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Quizzes
    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        passing_score INTEGER DEFAULT 70,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Questions
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Answer options
    await client.query(`
      CREATE TABLE IF NOT EXISTS answer_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        option_text TEXT NOT NULL,
        is_correct BOOLEAN DEFAULT FALSE,
        order_index INTEGER NOT NULL
      );
    `);

    // Enrollments (inscriptions aux cours)
    await client.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        enrolled_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        UNIQUE(user_id, course_id)
      );
    `);

    // Lesson progress
    await client.query(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
        is_completed BOOLEAN DEFAULT FALSE,
        watched_seconds INTEGER DEFAULT 0,
        completed_at TIMESTAMPTZ,
        UNIQUE(user_id, lesson_id)
      );
    `);

    // Quiz attempts
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        passed BOOLEAN NOT NULL,
        answers JSONB,
        attempted_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Certificates
    await client.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
        certificate_number VARCHAR(50) UNIQUE NOT NULL,
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, course_id)
      );
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

createTables();
