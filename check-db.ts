import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
  try {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'security_logs'
    `);
    console.log("Table 'security_logs' exists:", result.rowCount > 0);
    
    if (result.rowCount > 0) {
      const columns = await db.execute(sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'security_logs'
      `);
      console.log("Columns:", columns.rows);
    }
  } catch (err) {
    console.error("Error checking table:", err);
  }
  process.exit(0);
}
run().catch(console.error);
