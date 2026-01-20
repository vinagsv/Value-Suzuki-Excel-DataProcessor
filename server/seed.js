require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding Database...');
    await client.query('BEGIN');

    // Clear data just in case (but keep table structure)
    await client.query('TRUNCATE TABLE form22_vehicles RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE gate_passes RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE receipts RESTART IDENTITY CASCADE');

    // 1. Seed Vehicles (For Gate Pass Search)
    const vehicles = [
      { chassis: 'MB81234567', name: 'Rahul Dravid', model: 'ACCESS 125', color: 'White' },
      { chassis: 'MB87654321', name: 'Anil Kumble', model: 'BURGMAN', color: 'Matte Black' },
      { chassis: 'MB89988776', name: 'Virat Kohli', model: 'AVENIS', color: 'Green' }
    ];

    for (const v of vehicles) {
      await client.query(
        'INSERT INTO form22_vehicles (chassis_no, customer_name, model, color) VALUES ($1, $2, $3, $4)',
        [v.chassis, v.name, v.model, v.color]
      );
    }

    // 2. Seed Gate Pass (Includes one old one to test deletion later)
    await client.query(`
      INSERT INTO gate_passes (date, customer_name, model, color, regn_no, chassis_no, sales_bill_no)
      VALUES (CURRENT_DATE, 'Suresh Raina', 'ACCESS 125', 'Silver', 'KA-04-MZ-1234', 'MB81239999', 'SB-001')
    `);
    
    // Old entry (60 days ago)
    await client.query(`
      INSERT INTO gate_passes (date, customer_name, model, color, created_at)
      VALUES (CURRENT_DATE - INTERVAL '60 days', 'Old Customer', 'GIXXER', 'Blue', NOW() - INTERVAL '60 days')
    `);

    // 3. Seed Receipts
    await client.query(`
      INSERT INTO receipts (date, customer_name, amount, payment_mode, hp_financier, model)
      VALUES (CURRENT_DATE, 'MS Dhoni', 125000, 'Online', 'HDFC Bank', 'HAYABUSA')
    `);

    await client.query('COMMIT');
    console.log('✅ Seeding Complete!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding Failed:', err);
  } finally {
    client.release();
    pool.end();
  }
};

seedDatabase();