import { Pool } from 'pg';

export const id = '002_add_product_fields';

export async function up(pool: Pool): Promise<void> {
    await pool.query(`
    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS product_title VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS product_image_url TEXT NOT NULL DEFAULT '';

    CREATE INDEX IF NOT EXISTS idx_content_items_brand ON content_items(brand);
  `);
}

export async function down(pool: Pool): Promise<void> {
    await pool.query(`
    ALTER TABLE content_items
      DROP COLUMN IF EXISTS product_title,
      DROP COLUMN IF EXISTS product_image_url;

    DROP INDEX IF EXISTS idx_content_items_brand;
  `);
}
