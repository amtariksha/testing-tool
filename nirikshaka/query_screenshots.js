const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.zvmdaldcrkpxztbwnakw:Mrplayer9879%40123@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
  });
  
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database!");
    
    // Query all dashboard users
    const res = await client.query(`
      SELECT email, name 
      FROM users;
    `);
    
    console.log("\nUsers in database:");
    res.rows.forEach(row => {
      console.log(`- ${row.name} (${row.email})`);
    });
    
  } catch (err) {
    console.error("Error running query:", err.message);
  } finally {
    await client.end();
  }
}

main();
