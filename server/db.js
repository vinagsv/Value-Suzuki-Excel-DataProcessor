const { Pool } = require('pg');

// Use DATABASE_URL if provided (Production), otherwise use individual vars (Local)
const connectionString = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL 
  : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // SSL needed for most cloud DBs (Render/Heroku)
});

module.exports = { pool };