import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const seedDatabase = async () => {
  const client = await pool.connect();

  try {
    console.log('🌱 Starting Database Seeding...');
    await client.query('BEGIN');

    // 1. Seed Admin User
    const checkAdmin = await client.query("SELECT * FROM users WHERE email = 'admin@valuesuzuki.com'");
    
    if (checkAdmin.rows.length === 0) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('Accounts12*', salt);

      await client.query(
        `INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)`, 
        ['Admin', 'admin@valuesuzuki.com', hashedPassword, 'admin']
      );
      console.log('✅ Admin user seeded: admin@valuesuzuki.com');
    } else {
      console.log('ℹ️  Admin user already exists. Skipping.');
    }

    // 2. Seed Default Settings
    console.log('⚙️  Seeding default Application Settings...');
    
    const settingsToSeed = [
        { key: 'file_prefix', value: 'VMA2025/' },
        { key: 'file_seq', value: '0' }
    ];

    for (const setting of settingsToSeed) {
        await client.query(
            `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
            [setting.key, setting.value]
        );
    }
    console.log('✅ Default settings applied (Prefix: VMA2025/, Seq: 0).');

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