import { Pool } from 'pg';

export const id = '005_marketing_data_fields';

export async function up(pool: Pool): Promise<void> {
    // Convert campaign_goal and direction from TEXT to JSONB.
    // Existing plain-text values are wrapped into a JSON string so that
    // the column stays readable for backward-compatible display logic.
    await pool.query(`
    ALTER TABLE content_items
      ALTER COLUMN campaign_goal TYPE jsonb USING
        CASE
          WHEN campaign_goal IS NULL OR campaign_goal = '' THEN 'null'::jsonb
          ELSE to_jsonb(campaign_goal)
        END,
      ALTER COLUMN direction TYPE jsonb USING
        CASE
          WHEN direction IS NULL OR direction = '' THEN 'null'::jsonb
          ELSE to_jsonb(direction)
        END;

    ALTER TABLE content_items
      ADD COLUMN IF NOT EXISTS target_audience jsonb;
  `);
}

export async function down(pool: Pool): Promise<void> {
    await pool.query(`
    ALTER TABLE content_items
      DROP COLUMN IF EXISTS target_audience;

    ALTER TABLE content_items
      ALTER COLUMN campaign_goal TYPE text USING campaign_goal::text,
      ALTER COLUMN direction TYPE text USING direction::text;
  `);
}
