const {query} = require('./config/database'); 

async function checkSchema() {
  const r = await query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['users']);
  console.log('Columns:', r.rows.map(x => x.column_name).join(', ')); 
  process.exit(0);
}
checkSchema();
