import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(sql`
    select
      column_name,
      data_type,
      column_default,
      is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name in ('source', 'delivery_required', 'delivery_provider', 'delivery_address')
    order by column_name;
  `);

  console.log(result.rows);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

