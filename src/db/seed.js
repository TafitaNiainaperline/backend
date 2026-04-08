require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Admin user
    const hashedPwd = await bcrypt.hash('Admin1234!', 10);
    const adminResult = await client.query(`
      INSERT INTO users (email, password, first_name, last_name, role)
      VALUES ('admin@learning.com', $1, 'Admin', 'Platform', 'admin')
      ON CONFLICT (email) DO NOTHING RETURNING id;
    `, [hashedPwd]);

    // Instructor
    const instrPwd = await bcrypt.hash('Instr1234!', 10);
    const instrResult = await client.query(`
      INSERT INTO users (email, password, first_name, last_name, role)
      VALUES ('instructor@learning.com', $1, 'Jean', 'Dupont', 'instructor')
      ON CONFLICT (email) DO NOTHING RETURNING id;
    `, [instrPwd]);

    // Categories
    await client.query(`
      INSERT INTO categories (name, slug, description, icon) VALUES
        ('Développement Web', 'developpement-web', 'HTML, CSS, JavaScript, React, Node.js...', 'code'),
        ('Data Science', 'data-science', 'Python, Machine Learning, IA...', 'chart'),
        ('Design', 'design', 'UI/UX, Figma, Photoshop...', 'pen'),
        ('DevOps', 'devops', 'Docker, Kubernetes, CI/CD...', 'server')
      ON CONFLICT (slug) DO NOTHING;
    `);

    console.log('Seed completed successfully');
    console.log('Admin: admin@learning.com / Admin1234!');
    console.log('Instructor: instructor@learning.com / Instr1234!');

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
