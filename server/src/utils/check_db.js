import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const run = async () => {
  const client = await pool.connect();
  console.log('\n═══════════════════════════════════════════════');
  console.log('  DATABASE CONFIGURATION REPORT');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. All tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('📋 TABLES:');
    tables.rows.forEach(r => console.log(`   - ${r.table_name}`));

    // 2. Columns for each table
    console.log('\n📐 COLUMN DETAILS:\n');
    for (const { table_name } of tables.rows) {
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table_name]);

      console.log(`  ┌─ ${table_name.toUpperCase()}`);
      cols.rows.forEach(c => {
        console.log(`  │  ${c.column_name.padEnd(25)} ${c.data_type.padEnd(20)} nullable:${c.is_nullable} ${c.column_default ? `default:${c.column_default}` : ''}`);
      });
      console.log('  └─');
    }

    // 3. Sequences
    const seqs = await client.query(`
        SELECT sequencename, last_value
        FROM pg_sequences 
        WHERE schemaname = 'public'
        `);
    seqs.rows.forEach(s => {
    console.log(`   - ${s.sequencename}: last_value=${s.last_value}`);
    }); 

    // 4. Indexes
    console.log('\n📇 INDEXES:');
    const indexes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    indexes.rows.forEach(i => {
      console.log(`   - [${i.tablename}] ${i.indexname}`);
    });

    // 5. Row counts
    console.log('\n📊 ROW COUNTS:');
    for (const { table_name } of tables.rows) {
      const count = await client.query(`SELECT COUNT(*) FROM ${table_name}`);
      console.log(`   - ${table_name.padEnd(30)} ${count.rows[0].count} rows`);
    }

    // 6. App settings (safe — no PDF blob)
    console.log('\n⚙️  APP SETTINGS:');
    const settings = await client.query(`
      SELECT key, 
        CASE WHEN key = 'price_list_pdf' 
          THEN '[PDF OMITTED - ' || LENGTH(value)::text || ' chars]'
          ELSE value 
        END as value
      FROM app_settings 
      ORDER BY key
    `);
    settings.rows.forEach(s => {
      console.log(`   - ${s.key.padEnd(20)} = ${s.value}`);
    });

    // 7. Check for remarks vs gst_no
    console.log('\n🔍 COLUMN CHECK (remarks vs gst_no):');
    const remarksCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'general_receipts' 
      AND column_name IN ('remarks', 'gst_no')
    `);
    remarksCheck.rows.forEach(r => {
      console.log(`   - Found column: ${r.column_name}`);
    });

    // 8. Check if receipt_audit_log exists
    console.log('\n🔍 AUDIT LOG TABLE:');
    const auditCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'receipt_audit_log'
      ) as exists
    `);
    console.log(`   - receipt_audit_log exists: ${auditCheck.rows[0].exists}`);

    console.log('\n═══════════════════════════════════════════════');
    console.log('  REPORT COMPLETE');
    console.log('═══════════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

run();