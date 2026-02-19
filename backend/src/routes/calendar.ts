import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/calendar', async (req: Request, res: Response) => {
  try {
    const { start, end, platform, status, assignee, brand } = req.query;

    let sql = `SELECT * FROM content_items WHERE (publish_date IS NOT NULL OR due_date IS NOT NULL)`;
    const params: unknown[] = [];
    let idx = 1;

    if (start) {
      sql += ` AND (publish_date >= $${idx} OR due_date >= $${idx})`;
      params.push(start);
      idx++;
    }
    if (end) {
      sql += ` AND (publish_date <= $${idx} OR due_date <= $${idx})`;
      params.push(end);
      idx++;
    }
    if (platform) {
      sql += ` AND platform = $${idx++}`;
      params.push(platform);
    }
    if (status) {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (assignee) {
      sql += ` AND assignee = $${idx++}`;
      params.push(assignee);
    }
    if (brand) {
      sql += ` AND brand ILIKE $${idx++}`;
      params.push(`%${brand}%`);
    }

    sql += ' ORDER BY COALESCE(publish_date, due_date) ASC';
    const result = await query(sql, params);

    // Also fetch social posts for the calendar
    let socialSql = `SELECT sp.id, sp.caption as brand, '' as product_url, sp.post_type as campaign_goal,
           '' as direction, '' as pivot_notes,
           CASE WHEN EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'instagram_business') THEN 'instagram'
                WHEN EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'facebook_page') THEN 'facebook'
                ELSE 'facebook' END as platform,
           sp.status, NULL as due_date, sp.scheduled_at as publish_date,
           sp.user_id as assignee, sp.user_id as created_by, sp.created_at, sp.updated_at,
           '' as product_title, '' as product_image_url, NULL as product_id, sp.caption as final_copy,
           'social_post' as item_type, sp.post_type, sp.hashtags
    FROM social_posts sp WHERE sp.scheduled_at IS NOT NULL`;
    const socialParams: unknown[] = [];
    let sIdx = 1;

    if (start) {
      socialSql += ` AND sp.scheduled_at >= $${sIdx++}`;
      socialParams.push(start);
    }
    if (end) {
      socialSql += ` AND sp.scheduled_at <= $${sIdx++}`;
      socialParams.push(end);
    }
    if (platform) {
      if (platform === 'instagram') {
        socialSql += ` AND EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'instagram_business')`;
      } else if (platform === 'facebook') {
        socialSql += ` AND EXISTS (SELECT 1 FROM social_post_accounts spa JOIN social_accounts sa ON spa.social_account_id = sa.id WHERE spa.social_post_id = sp.id AND sa.account_type = 'facebook_page')`;
      }
    }
    if (status) {
      socialSql += ` AND sp.status = $${sIdx++}`;
      socialParams.push(status);
    }

    socialSql += ' ORDER BY sp.scheduled_at ASC';

    let socialPosts: unknown[] = [];
    try {
      const socialResult = await query(socialSql, socialParams);
      socialPosts = socialResult.rows.map((row: Record<string, unknown>) => ({ ...row, item_type: 'social_post' }));
    } catch {
      // social tables may not exist yet
    }

    const contentItems = result.rows.map((row: Record<string, unknown>) => ({ ...row, item_type: 'content_item' }));
    const allItems = [...contentItems, ...socialPosts] as Record<string, unknown>[];
    allItems.sort((a, b) => {
      const dateA = (a.publish_date || a.due_date) as string;
      const dateB = (b.publish_date || b.due_date) as string;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    res.json({ items: allItems });
  } catch (err) {
    console.error('Error fetching calendar items:', err);
    res.status(500).json({ error: 'Failed to fetch calendar items' });
  }
});

router.put('/calendar/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const { publish_date, due_date } = req.body;
    const existing = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (publish_date !== undefined) {
      updates.push(`publish_date = $${idx++}`);
      values.push(publish_date);
    }
    if (due_date !== undefined) {
      updates.push(`due_date = $${idx++}`);
      values.push(due_date);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No date fields provided' });
    }

    updates.push('updated_at = NOW()');
    values.push(req.params.id);

    await query(
      `UPDATE content_items SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    await logAudit({
      entityType: 'content_item',
      entityId: req.params.id,
      action: 'reschedule',
      actor: req.user?.id || 'unknown',
      actorRole: (req.user?.role as 'staff' | 'manager' | 'admin') || 'staff',
      details: {
        publish_date: publish_date ?? null,
        due_date: due_date ?? null,
      },
    });

    const result = await query('SELECT * FROM content_items WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error rescheduling item:', err);
    res.status(500).json({ error: 'Failed to reschedule item' });
  }
});

export default router;
