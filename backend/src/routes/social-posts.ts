import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAudit } from '../services/audit';

const router = Router();

router.get('/social/posts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { status, limit: limitParam, offset: offsetParam } = req.query;

    let sql = `SELECT sp.*,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', ml.id, 'url', ml.url, 'thumbnail_url', ml.thumbnail_url, 'file_type', ml.file_type, 'file_name', ml.file_name)) FILTER (WHERE ml.id IS NOT NULL),
        '[]'
      ) as media,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object('id', spa.id, 'social_account_id', spa.social_account_id, 'platform_post_id', spa.platform_post_id, 'platform_status', spa.platform_status, 'platform_error', spa.platform_error, 'published_at', spa.published_at, 'account_name', sa.account_name, 'account_type', sa.account_type, 'account_avatar_url', sa.account_avatar_url)) FILTER (WHERE spa.id IS NOT NULL),
        '[]'
      ) as target_accounts
    FROM social_posts sp
    LEFT JOIN social_post_media spm ON sp.id = spm.social_post_id
    LEFT JOIN media_library ml ON spm.media_id = ml.id
    LEFT JOIN social_post_accounts spa ON sp.id = spa.social_post_id
    LEFT JOIN social_accounts sa ON spa.social_account_id = sa.id
    WHERE sp.user_id = $1`;

    const params: unknown[] = [userId];
    let idx = 2;

    if (status) {
      sql += ` AND sp.status = $${idx++}`;
      params.push(status);
    }

    sql += ` GROUP BY sp.id ORDER BY COALESCE(sp.scheduled_at, sp.created_at) DESC`;

    const pageLimit = Math.min(parseInt(limitParam as string) || 50, 200);
    const pageOffset = parseInt(offsetParam as string) || 0;
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(pageLimit, pageOffset);

    const result = await query(sql, params);

    const countResult = await query(
      `SELECT COUNT(*)::int as count FROM social_posts WHERE user_id = $1${status ? ' AND status = $2' : ''}`,
      status ? [userId, status] : [userId]
    );

    res.json({
      posts: result.rows,
      total: countResult.rows[0].count,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (err) {
    console.error('Error fetching social posts:', err);
    res.status(500).json({ error: 'Failed to fetch social posts' });
  }
});

router.get('/social/posts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const result = await query(
      `SELECT sp.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', ml.id, 'url', ml.url, 'thumbnail_url', ml.thumbnail_url, 'file_type', ml.file_type, 'file_name', ml.file_name, 'sort_order', spm.sort_order)) FILTER (WHERE ml.id IS NOT NULL),
          '[]'
        ) as media,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', spa.id, 'social_account_id', spa.social_account_id, 'platform_post_id', spa.platform_post_id, 'platform_status', spa.platform_status, 'platform_error', spa.platform_error, 'published_at', spa.published_at, 'account_name', sa.account_name, 'account_type', sa.account_type, 'account_avatar_url', sa.account_avatar_url)) FILTER (WHERE spa.id IS NOT NULL),
          '[]'
        ) as target_accounts
      FROM social_posts sp
      LEFT JOIN social_post_media spm ON sp.id = spm.social_post_id
      LEFT JOIN media_library ml ON spm.media_id = ml.id
      LEFT JOIN social_post_accounts spa ON sp.id = spa.social_post_id
      LEFT JOIN social_accounts sa ON spa.social_account_id = sa.id
      WHERE sp.id = $1 AND sp.user_id = $2
      GROUP BY sp.id`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching social post:', err);
    res.status(500).json({ error: 'Failed to fetch social post' });
  }
});

router.post('/social/posts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const {
      caption = '',
      hashtags = '',
      post_type = 'image',
      scheduled_at = null,
      content_item_id = null,
      account_ids = [],
      media_ids = [],
    } = req.body;

    const postId = uuidv4();
    const status = scheduled_at ? 'scheduled' : 'draft';

    await query(
      `INSERT INTO social_posts (id, user_id, content_item_id, caption, hashtags, post_type, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [postId, userId, content_item_id, caption, hashtags, post_type, status, scheduled_at]
    );

    for (let i = 0; i < (media_ids as string[]).length; i++) {
      await query(
        'INSERT INTO social_post_media (id, social_post_id, media_id, sort_order) VALUES ($1, $2, $3, $4)',
        [uuidv4(), postId, media_ids[i], i]
      );
    }

    for (const accountId of account_ids as string[]) {
      await query(
        'INSERT INTO social_post_accounts (id, social_post_id, social_account_id) VALUES ($1, $2, $3)',
        [uuidv4(), postId, accountId]
      );
    }

    await logAudit({
      entityType: 'social_post',
      entityId: postId,
      action: 'create',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { post_type, status, account_count: (account_ids as string[]).length },
    });

    const result = await query('SELECT * FROM social_posts WHERE id = $1', [postId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating social post:', err);
    res.status(500).json({ error: 'Failed to create social post' });
  }
});

router.put('/social/posts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = existing.rows[0];
    if (post.status === 'published' || post.status === 'publishing') {
      return res.status(400).json({ error: 'Cannot edit a published or publishing post' });
    }

    const { caption, hashtags, post_type, scheduled_at, account_ids, media_ids } = req.body;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (caption !== undefined) { updates.push(`caption = $${idx++}`); values.push(caption); }
    if (hashtags !== undefined) { updates.push(`hashtags = $${idx++}`); values.push(hashtags); }
    if (post_type !== undefined) { updates.push(`post_type = $${idx++}`); values.push(post_type); }
    if (scheduled_at !== undefined) {
      updates.push(`scheduled_at = $${idx++}`);
      values.push(scheduled_at);
      if (scheduled_at && post.status === 'draft') {
        updates.push(`status = 'scheduled'`);
      } else if (!scheduled_at && post.status === 'scheduled') {
        updates.push(`status = 'draft'`);
      }
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      values.push(req.params.id);
      await query(
        `UPDATE social_posts SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    if (media_ids !== undefined) {
      await query('DELETE FROM social_post_media WHERE social_post_id = $1', [req.params.id]);
      for (let i = 0; i < (media_ids as string[]).length; i++) {
        await query(
          'INSERT INTO social_post_media (id, social_post_id, media_id, sort_order) VALUES ($1, $2, $3, $4)',
          [uuidv4(), req.params.id, media_ids[i], i]
        );
      }
    }

    if (account_ids !== undefined) {
      await query('DELETE FROM social_post_accounts WHERE social_post_id = $1', [req.params.id]);
      for (const accountId of account_ids as string[]) {
        await query(
          'INSERT INTO social_post_accounts (id, social_post_id, social_account_id) VALUES ($1, $2, $3)',
          [uuidv4(), req.params.id, accountId]
        );
      }
    }

    await logAudit({
      entityType: 'social_post',
      entityId: req.params.id,
      action: 'update',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { updated_fields: Object.keys(req.body) },
    });

    const result = await query('SELECT * FROM social_posts WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating social post:', err);
    res.status(500).json({ error: 'Failed to update social post' });
  }
});

router.delete('/social/posts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (existing.rows[0].status === 'publishing') {
      return res.status(400).json({ error: 'Cannot delete a post that is currently publishing' });
    }

    await query('DELETE FROM social_posts WHERE id = $1', [req.params.id]);

    await logAudit({
      entityType: 'social_post',
      entityId: req.params.id,
      action: 'delete',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: {},
    });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Error deleting social post:', err);
    res.status(500).json({ error: 'Failed to delete social post' });
  }
});

router.post('/social/posts/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const original = existing.rows[0];
    const newId = uuidv4();

    await query(
      `INSERT INTO social_posts (id, user_id, content_item_id, caption, hashtags, post_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'draft')`,
      [newId, userId, original.content_item_id, original.caption, original.hashtags, original.post_type]
    );

    const mediaResult = await query(
      'SELECT * FROM social_post_media WHERE social_post_id = $1 ORDER BY sort_order',
      [req.params.id]
    );
    for (const media of mediaResult.rows) {
      await query(
        'INSERT INTO social_post_media (id, social_post_id, media_id, sort_order) VALUES ($1, $2, $3, $4)',
        [uuidv4(), newId, media.media_id, media.sort_order]
      );
    }

    const accountsResult = await query(
      'SELECT * FROM social_post_accounts WHERE social_post_id = $1',
      [req.params.id]
    );
    for (const account of accountsResult.rows) {
      await query(
        'INSERT INTO social_post_accounts (id, social_post_id, social_account_id) VALUES ($1, $2, $3)',
        [uuidv4(), newId, account.social_account_id]
      );
    }

    await logAudit({
      entityType: 'social_post',
      entityId: newId,
      action: 'duplicate',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { original_id: req.params.id },
    });

    const result = await query('SELECT * FROM social_posts WHERE id = $1', [newId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error duplicating social post:', err);
    res.status(500).json({ error: 'Failed to duplicate social post' });
  }
});

router.post('/social/posts/:id/publish', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = existing.rows[0];
    if (post.status === 'published' || post.status === 'publishing') {
      return res.status(400).json({ error: 'Post is already published or publishing' });
    }

    await query(
      "UPDATE social_posts SET status = 'publishing', updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );

    await query(
      "UPDATE social_post_accounts SET platform_status = 'publishing' WHERE social_post_id = $1",
      [req.params.id]
    );

    try {
      const { publishToAccounts } = await import('../services/meta-publisher');
      await publishToAccounts(req.params.id);
    } catch (pubErr) {
      console.error('Publishing error:', pubErr);
      await query(
        "UPDATE social_posts SET status = 'failed', error_message = $1, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $2",
        [(pubErr as Error).message, req.params.id]
      );
    }

    const result = await query('SELECT * FROM social_posts WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error publishing social post:', err);
    res.status(500).json({ error: 'Failed to publish social post' });
  }
});

router.put('/social/posts/:id/reschedule', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { scheduled_at } = req.body;

    const existing = await query(
      'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = existing.rows[0];
    if (post.status === 'published' || post.status === 'publishing') {
      return res.status(400).json({ error: 'Cannot reschedule a published or publishing post' });
    }

    const newStatus = scheduled_at ? 'scheduled' : 'draft';
    await query(
      'UPDATE social_posts SET scheduled_at = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [scheduled_at, newStatus, req.params.id]
    );

    await logAudit({
      entityType: 'social_post',
      entityId: req.params.id,
      action: 'reschedule',
      actor: userId,
      actorRole: req.user?.role || 'staff',
      details: { scheduled_at },
    });

    const result = await query('SELECT * FROM social_posts WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error rescheduling social post:', err);
    res.status(500).json({ error: 'Failed to reschedule social post' });
  }
});

export default router;
