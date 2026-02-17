import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

// Database Connection
const connectionString = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL 
  : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const seedDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting Database Seeding...');
    await client.query('BEGIN');

    // 1. Create Users Table (Safe creation: IF NOT EXISTS)
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(createTableQuery);
    console.log('✅ Users table checked/created.');

    // 2. Check if Admin Exists
    const checkAdmin = await client.query("SELECT * FROM users WHERE email = 'admin@valuesuzuki.com'");
    
    if (checkAdmin.rows.length === 0) {
      // 3. Create Admin User
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);

      const insertAdminQuery = `
        INSERT INTO users (username, email, password_hash, role) 
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(insertAdminQuery, ['Admin User', 'admin@valuesuzuki.com', hashedPassword, 'admin']);
      console.log('✅ Default Admin created: admin@valuesuzuki.com / admin123');
    } else {
      console.log('ℹ️  Admin user already exists. Skipping.');
    }

    // 4. Check if Standard User Exists
    const checkUser = await client.query("SELECT * FROM users WHERE email = 'user@valuesuzuki.com'");
    if (checkUser.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('user123', salt);
      
      await client.query(
        "INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)", 
        ['Staff User', 'user@valuesuzuki.com', hashedPassword, 'user']
      );
      console.log('✅ Default User created: user@valuesuzuki.com / user123');
    }

    await client.query('COMMIT');
    console.log('🚀 Seeding completed successfully!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
};

seedDatabase();