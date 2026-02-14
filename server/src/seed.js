require('dotenv').config(); // Load environment variables
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database Connection
const connectionString = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL 
  : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const seedDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting Database Seeding...');
    await client.query('BEGIN');

    // 1. Create Users Table (Safe creation: IF NOT EXISTS)
    // This ensures we don't drop the table if it already has users
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createTableQuery);
    console.log('✅ Users table checked/created.');

    // 2. Check if Admin Exists
    const checkAdmin = await client.query("SELECT * FROM users WHERE username = 'admin'");
    
    if (checkAdmin.rows.length === 0) {
      // 3. Create Admin User
      // Password: 'admin123'
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      const insertAdminQuery = `
        INSERT INTO users (username, password_hash, role) 
        VALUES ($1, $2, $3)
      `;
      await client.query(insertAdminQuery, ['admin', hashedPassword, 'admin']);
      console.log('✅ Default Admin user created (User: admin / Pass: admin123)');
    } else {
      console.log('ℹ️  Admin user already exists. Skipping creation.');
    }

    // 4. (Optional) Create a standard 'user' for testing
    const checkUser = await client.query("SELECT * FROM users WHERE username = 'user'");
    if (checkUser.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('user123', salt);
      
      await client.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)", 
        ['user', hashedPassword, 'user']
      );
      console.log('✅ Default Standard user created (User: user / Pass: user123)');
    }

    await client.query('COMMIT');
    console.log('🚀 Seeding completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
  } finally {
    client.release();
    pool.end();
  }
};

seedDatabase();