import { Pool } from 'pg';

export const id = '003_add_output_created_by_and_final_copy';

export async function up(pool: Pool): Promise<void> {
    await pool.query(`
    ALTER TABLE content_item_outputs
      ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system';

    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS final_copy TEXT NOT NULL DEFAULT '';
  `);
}

export async function down(pool: Pool): Promise<void> {
    await pool.query(`
    ALTER TABLE content_item_outputs
      DROP COLUMN IF EXISTS created_by;

    ALTER TABLE content_items
      DROP COLUMN IF EXISTS final_copy;
  `);
}
