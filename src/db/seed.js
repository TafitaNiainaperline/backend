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
        ('Developpement Web', 'developpement-web', 'HTML, CSS, JavaScript, React, Node.js...', 'code'),
        ('Data Science', 'data-science', 'Python, Machine Learning, IA...', 'chart'),
        ('Design', 'design', 'UI/UX, Figma, Photoshop...', 'pen'),
        ('DevOps', 'devops', 'Docker, Kubernetes, CI/CD...', 'server')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // Get instructor id
    const instr = await client.query("SELECT id FROM users WHERE email = 'instructor@learning.com'");
    const catWeb = await client.query("SELECT id FROM categories WHERE slug = 'developpement-web'");
    const catData = await client.query("SELECT id FROM categories WHERE slug = 'data-science'");
    const catDesign = await client.query("SELECT id FROM categories WHERE slug = 'design'");

    // Courses
    await client.query(`
      INSERT INTO courses (title, slug, description, thumbnail_url, instructor_id, category_id, level, duration_minutes, is_published, price)
      VALUES 
        ('JavaScript Complet - Debutant a Expert', 'javascript-complet', 'Apprenez JavaScript de zero a hero avec des projets concrets', 'https://picsum.photos/seed/js/800/600', $1, $2, 'beginner', 1200, TRUE, 0),
        ('React & Next.js - Guide Pratique', 'react-nextjs', 'Maitrisez React et Next.js pour creer des applications modernes', 'https://picsum.photos/seed/react/800/600', $1, $2, 'intermediate', 1800, TRUE, 0),
        ('Python pour la Data Science', 'python-data-science', 'Decouvrez Python et ses bibliotheques pour analyse de donnees', 'https://picsum.photos/seed/python/800/600', $1, $3, 'beginner', 2000, TRUE, 0),
        ('UI/UX Design avec Figma', 'figma-design', 'Creez des interfaces utilisateur professionnelles avec Figma', 'https://picsum.photos/seed/figma/800/600', $1, $4, 'beginner', 900, TRUE, 0),
        ('DevOps et Cloud - Guide Complet', 'devops-cloud', 'Containerisez vos applications et deployez a grande echelle', 'https://picsum.photos/seed/devops/800/600', $1, $2, 'advanced', 1500, TRUE, 0)
      ON CONFLICT (slug) DO NOTHING;
    `, [instr.rows[0].id, catWeb.rows[0].id, catData.rows[0].id, catDesign.rows[0].id]);

    // Sections and Lessons for JavaScript course
    const jsCourse = await client.query("SELECT id FROM courses WHERE slug = 'javascript-complet'");
    if (jsCourse.rows[0]) {
      await client.query(`
        INSERT INTO sections (course_id, title, order_index) VALUES 
          ($1, 'Introduction a JavaScript', 1),
          ($1, 'Les bases du langage', 2),
          ($1, 'Fonctions et objets', 3),
          ($1, 'DOM et evenements', 4),
          ($1, 'Projet pratique', 5)
      `, [jsCourse.rows[0].id]);

      const jsSections = await client.query("SELECT id FROM sections WHERE course_id = $1 ORDER BY order_index", [jsCourse.rows[0].id]);
      
      const jsLessons = [
        ['Qu\'est-ce que JavaScript ?', 10, true],
        ['Historique et environnement', 8, true],
        ['Variables et types de donnees', 15, true],
        ['Operateurs', 12, true],
        ['Conditions et boucles', 18, true],
        ['Fonctions declaration et expression', 15, false],
        ['Fonctions flechees', 10, false],
        ['Objets et proprietés', 15, false],
        ['Tableaux et methodes', 18, false],
        ['Introduction au DOM', 12, false],
        ['Selection et modification elements', 15, false],
        ['Gestion des evenements', 12, false],
        ['Projet: Calculatrice', 20, false],
      ];

      for (let i = 0; i < jsSections.rows.length; i++) {
        const sectionId = jsSections.rows[i].id;
        const startIdx = i * 2;
        const endIdx = Math.min(startIdx + 2, jsLessons.length);
        for (let j = startIdx; j < endIdx; j++) {
          await client.query(`
            INSERT INTO lessons (section_id, title, duration_minutes, is_preview, order_index, document_url)
            VALUES ($1, $2, $3, $4, $5, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
          `, [sectionId, jsLessons[j][0], jsLessons[j][1], jsLessons[j][2], j - startIdx + 1]);
        }
      }
    }

    // Sections and Lessons for React course
    const reactCourse = await client.query("SELECT id FROM courses WHERE slug = 'react-nextjs'");
    if (reactCourse.rows[0]) {
      await client.query(`
        INSERT INTO sections (course_id, title, order_index) VALUES 
          ($1, 'Introduction a React', 1),
          ($1, 'Composants et props', 2),
          ($1, 'State et hooks', 3),
          ($1, 'Next.js', 4)
      `, [reactCourse.rows[0].id]);

      const reactSections = await client.query("SELECT id FROM sections WHERE course_id = $1 ORDER BY order_index", [reactCourse.rows[0].id]);
      
      const reactLessons = [
        ['Pourquoi React ?', 10, true],
        ['Installation et configuration', 15, true],
        ['JSX et syntaxe', 12, true],
        ['Composants fonctionnels', 15, false],
        ['Props et children', 12, false],
        ['useState et useEffect', 18, false],
        ['useContext et reducers', 15, false],
        ['Introduction a Next.js', 12, false],
        ['Routing et pages', 15, false],
        ['API routes', 12, false],
      ];

      for (let i = 0; i < reactSections.rows.length; i++) {
        const sectionId = reactSections.rows[i].id;
        const startIdx = i * 2;
        const endIdx = Math.min(startIdx + 3, reactLessons.length);
        for (let j = startIdx; j < endIdx; j++) {
          await client.query(`
            INSERT INTO lessons (section_id, title, duration_minutes, is_preview, order_index, document_url)
            VALUES ($1, $2, $3, $4, $5, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
          `, [sectionId, reactLessons[j][0], reactLessons[j][1], reactLessons[j][2], j - startIdx + 1]);
        }
      }
    }

    // Sections and Lessons for Python course
    const pyCourse = await client.query("SELECT id FROM courses WHERE slug = 'python-data-science'");
    if (pyCourse.rows[0]) {
      await client.query(`
        INSERT INTO sections (course_id, title, order_index) VALUES 
          ($1, 'Bases de Python', 1),
          ($1, 'Structure de donnees', 2),
          ($1, 'Introduction a la Data Science', 3)
      `, [pyCourse.rows[0].id]);

      const pySections = await client.query("SELECT id FROM sections WHERE course_id = $1 ORDER BY order_index", [pyCourse.rows[0].id]);
      
      const pyLessons = [
        ['Installation de Python', 8, true],
        ['Premier script Python', 10, true],
        ['Listes et tuples', 12, false],
        ['Dictionnaires', 12, false],
        ['Introduction a Pandas', 15, false],
        ['Analyse de donnees', 18, false],
      ];

      for (let i = 0; i < pySections.rows.length; i++) {
        const sectionId = pySections.rows[i].id;
        const startIdx = i * 2;
        const endIdx = Math.min(startIdx + 2, pyLessons.length);
        for (let j = startIdx; j < endIdx; j++) {
          await client.query(`
            INSERT INTO lessons (section_id, title, duration_minutes, is_preview, order_index, document_url)
            VALUES ($1, $2, $3, $4, $5, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
          `, [sectionId, pyLessons[j][0], pyLessons[j][1], pyLessons[j][2], j - startIdx + 1]);
        }
      }
    }

    // Sections and Lessons for Figma course
    const figmaCourse = await client.query("SELECT id FROM courses WHERE slug = 'figma-design'");
    if (figmaCourse.rows[0]) {
      await client.query(`
        INSERT INTO sections (course_id, title, order_index) VALUES 
          ($1, 'Introduction a Figma', 1),
          ($1, 'Composants et variantes', 2),
          ($1, 'Prototypage', 3),
          ($1, 'Projet final', 4)
      `, [figmaCourse.rows[0].id]);

      const figmaSections = await client.query("SELECT id FROM sections WHERE course_id = $1 ORDER BY order_index", [figmaCourse.rows[0].id]);
      
      const figmaLessons = [
        ['Premiers pas avec Figma', 10, true],
        ['Interface et outils', 12, true],
        ['Creer des composants', 15, false],
        ['Variantes et proprietes', 12, false],
        ['Creer un prototype', 15, false],
        ['Animations et transitions', 12, false],
        ['Collaborer en equipe', 10, false],
        ['Exporter et deliver', 8, false],
      ];

      for (let i = 0; i < figmaSections.rows.length; i++) {
        const sectionId = figmaSections.rows[i].id;
        const startIdx = i * 2;
        const endIdx = Math.min(startIdx + 2, figmaLessons.length);
        for (let j = startIdx; j < endIdx; j++) {
          await client.query(`
            INSERT INTO lessons (section_id, title, duration_minutes, is_preview, order_index, document_url)
            VALUES ($1, $2, $3, $4, $5, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
          `, [sectionId, figmaLessons[j][0], figmaLessons[j][1], figmaLessons[j][2], j - startIdx + 1]);
        }
      }
    }

    // Sections and Lessons for DevOps course
    const devopsCourse = await client.query("SELECT id FROM courses WHERE slug = 'devops-cloud'");
    if (devopsCourse.rows[0]) {
      await client.query(`
        INSERT INTO sections (course_id, title, order_index) VALUES 
          ($1, 'Introduction au DevOps', 1),
          ($1, 'Docker et Containers', 2),
          ($1, 'CI/CD et Automation', 3),
          ($1, 'Cloud et Deploy', 4)
      `, [devopsCourse.rows[0].id]);

      const devopsSections = await client.query("SELECT id FROM sections WHERE course_id = $1 ORDER BY order_index", [devopsCourse.rows[0].id]);
      
      const devopsLessons = [
        ['Qu\'est-ce que le DevOps ?', 10, true],
        ['Culture et principes', 8, true],
        ['Introduction a Docker', 12, true],
        ['Docker Compose', 15, false],
        ['Kubernetes basics', 18, false],
        ['GitHub Actions', 15, false],
        ['CI/CD Pipeline', 12, false],
        ['AWS/ GCP Intro', 15, false],
        ['Deploy continue', 12, false],
      ];

      for (let i = 0; i < devopsSections.rows.length; i++) {
        const sectionId = devopsSections.rows[i].id;
        const startIdx = i * 2;
        const endIdx = Math.min(startIdx + 3, devopsLessons.length);
        for (let j = startIdx; j < endIdx; j++) {
          await client.query(`
            INSERT INTO lessons (section_id, title, duration_minutes, is_preview, order_index, document_url)
            VALUES ($1, $2, $3, $4, $5, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
          `, [sectionId, devopsLessons[j][0], devopsLessons[j][1], devopsLessons[j][2], j - startIdx + 1]);
        }
      }
    }

    // Create quizzes for lessons
    const jsLessonsResult = await client.query(`
      SELECT l.id, l.title, c.id as course_id 
      FROM lessons l 
      JOIN sections s ON l.section_id = s.id 
      JOIN courses c ON s.course_id = c.id 
      WHERE c.slug = 'javascript-complet' 
      ORDER BY s.order_index, l.order_index 
      LIMIT 5
    `);

    for (const lesson of jsLessonsResult.rows) {
      const quizResult = await client.query(`
        INSERT INTO quizzes (lesson_id, course_id, title, passing_score)
        VALUES ($1, $2, $3, 70)
        RETURNING id
      `, [lesson.id, lesson.course_id, `Quiz: ${lesson.title}`]);
      
      const quizId = quizResult.rows[0].id;

      // Add 3 questions per quiz
      const questions = [
        { text: `Quelle est la bonne syntaxe pour déclarer une variable en JavaScript?`, options: ['var x = 5', 'variable x = 5', 'let x := 5', 'int x = 5'], correct: 0 },
        { text: 'Comment écrire un commentaire en JavaScript?', options: ['// commentaire', '<!-- commentaire -->', '# commentaire', '** commentaire **'], correct: 0 },
        { text: 'Quelle méthode permet dafficher quelque chose dans la console?', options: ['console.log()', 'print()', 'echo()', 'write()'], correct: 0 },
      ];

      for (let q = 0; q < questions.length; q++) {
        const questionResult = await client.query(`
          INSERT INTO questions (quiz_id, question_text, order_index)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [quizId, questions[q].text, q]);
        
        const questionId = questionResult.rows[0].id;

        for (let o = 0; o < questions[q].options.length; o++) {
          await client.query(`
            INSERT INTO answer_options (question_id, option_text, is_correct, order_index)
            VALUES ($1, $2, $3, $4)
          `, [questionId, questions[q].options[o], o === questions[q].correct, o]);
        }
      }
    }

    // Create quizzes for React course
    const reactLessonsResult = await client.query(`
      SELECT l.id, l.title, c.id as course_id 
      FROM lessons l 
      JOIN sections s ON l.section_id = s.id 
      JOIN courses c ON s.course_id = c.id 
      WHERE c.slug = 'react-nextjs' 
      ORDER BY s.order_index, l.order_index 
      LIMIT 5
    `);

    for (const lesson of reactLessonsResult.rows) {
      const quizResult = await client.query(`
        INSERT INTO quizzes (lesson_id, course_id, title, passing_score)
        VALUES ($1, $2, $3, 70)
        RETURNING id
      `, [lesson.id, lesson.course_id, `Quiz: ${lesson.title}`]);
      
      const quizId = quizResult.rows[0].id;

      const questions = [
        { text: 'Quest-ce que JSX?', options: ['Une extension de syntaxe JavaScript', 'Un langage de programmation', 'Un framework', 'Une base de données'], correct: 0 },
        { text: 'Quelle commande crée un nouveau projet React?', options: ['npx create-react-app', 'npm new react', 'react init', 'node react'], correct: 0 },
        { text: 'Quel hook permet de gérer un état dans un composant?', options: ['useState', 'useEffect', 'useContext', 'useReducer'], correct: 0 },
      ];

      for (let q = 0; q < questions.length; q++) {
        const questionResult = await client.query(`
          INSERT INTO questions (quiz_id, question_text, order_index)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [quizId, questions[q].text, q]);
        
        const questionId = questionResult.rows[0].id;

        for (let o = 0; o < questions[q].options.length; o++) {
          await client.query(`
            INSERT INTO answer_options (question_id, option_text, is_correct, order_index)
            VALUES ($1, $2, $3, $4)
          `, [questionId, questions[q].options[o], o === questions[q].correct, o]);
        }
      }
    }

    // Create quizzes for Python course
    const pyLessonsResult = await client.query(`
      SELECT l.id, l.title, c.id as course_id 
      FROM lessons l 
      JOIN sections s ON l.section_id = s.id 
      JOIN courses c ON s.course_id = c.id 
      WHERE c.slug = 'python-data-science' 
      ORDER BY s.order_index, l.order_index 
      LIMIT 5
    `);

    for (const lesson of pyLessonsResult.rows) {
      const quizResult = await client.query(`
        INSERT INTO quizzes (lesson_id, course_id, title, passing_score)
        VALUES ($1, $2, $3, 70)
        RETURNING id
      `, [lesson.id, lesson.course_id, `Quiz: ${lesson.title}`]);
      
      const quizId = quizResult.rows[0].id;

      const questions = [
        { text: 'Comment déclarer une variable en Python?', options: ['x = 5', 'var x = 5', 'let x = 5', 'int x = 5'], correct: 0 },
        { text: 'Quelle fonction affiche quelque chose en Python?', options: ['print()', 'echo()', 'console.log()', 'display()'], correct: 0 },
        { text: 'Quel est le type dune liste en Python?', options: ['list', 'array', 'collection', 'group'], correct: 0 },
      ];

      for (let q = 0; q < questions.length; q++) {
        const questionResult = await client.query(`
          INSERT INTO questions (quiz_id, question_text, order_index)
          VALUES ($1, $2, $3)
          RETURNING id
        `, [quizId, questions[q].text, q]);
        
        const questionId = questionResult.rows[0].id;

        for (let o = 0; o < questions[q].options.length; o++) {
          await client.query(`
            INSERT INTO answer_options (question_id, option_text, is_correct, order_index)
            VALUES ($1, $2, $3, $4)
          `, [questionId, questions[q].options[o], o === questions[q].correct, o]);
        }
      }
    }

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
