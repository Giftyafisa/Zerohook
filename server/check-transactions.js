const { query } = require('./config/database');

(async () => {
  const r = await query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    ORDER BY ordinal_position
  `);
  
  console.log('transactions table columns:');
  r.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
  process.exit(0);
})();
