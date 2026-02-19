import { Router, Request, Response } from 'express';
import { query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

router.get('/social/media', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { file_type, limit: limitParam, offset: offsetParam } = req.query;

    let sql = 'SELECT * FROM media_library WHERE user_id = $1';
    const params: unknown[] = [userId];
    let idx = 2;

    if (file_type) {
      sql += ` AND file_type = $${idx++}`;
      params.push(file_type);
    }

    sql += ' ORDER BY created_at DESC';

    const pageLimit = Math.min(parseInt(limitParam as string) || 50, 200);
    const pageOffset = parseInt(offsetParam as string) || 0;
    sql += ` LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(pageLimit, pageOffset);

    const result = await query(sql, params);

    const countSql = `SELECT COUNT(*)::int as count FROM media_library WHERE user_id = $1${file_type ? ' AND file_type = $2' : ''}`;
    const countResult = await query(countSql, file_type ? [userId, file_type] : [userId]);

    res.json({
      media: result.rows,
      total: countResult.rows[0].count,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

router.post('/social/media/upload-url', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { file_name, file_type, file_size, mime_type } = req.body;

    if (!file_name || !file_type) {
      return res.status(400).json({ error: 'file_name and file_type are required' });
    }

    const mediaId = uuidv4();
    const ext = path.extname(file_name) || `.${file_type.split('/').pop()}`;
    const storageKey = `media/${userId}/${mediaId}${ext}`;
    const uploadUrl = `${config.storage.baseUrl}/${storageKey}`;

    await query(
      `INSERT INTO media_library (id, user_id, file_name, file_type, file_size, mime_type, url, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [mediaId, userId, file_name, file_type, file_size || 0, mime_type || '', uploadUrl, storageKey]
    );

    const uploadDir = path.join(config.storage.uploadDir, 'media', userId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    res.json({
      id: mediaId,
      upload_url: uploadUrl,
      storage_key: storageKey,
      local_path: path.join(uploadDir, `${mediaId}${ext}`),
    });
  } catch (err) {
    console.error('Error generating upload URL:', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

router.post('/social/media/confirm-upload', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const { media_id, url, thumbnail_url, width, height, duration_seconds } = req.body;

    if (!media_id) {
      return res.status(400).json({ error: 'media_id is required' });
    }

    const existing = await query(
      'SELECT * FROM media_library WHERE id = $1 AND user_id = $2',
      [media_id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (url) { updates.push(`url = $${idx++}`); values.push(url); }
    if (thumbnail_url) { updates.push(`thumbnail_url = $${idx++}`); values.push(thumbnail_url); }
    if (width) { updates.push(`width = $${idx++}`); values.push(width); }
    if (height) { updates.push(`height = $${idx++}`); values.push(height); }
    if (duration_seconds) { updates.push(`duration_seconds = $${idx++}`); values.push(duration_seconds); }

    if (updates.length > 0) {
      values.push(media_id);
      await query(
        `UPDATE media_library SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    const result = await query('SELECT * FROM media_library WHERE id = $1', [media_id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error confirming upload:', err);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

router.delete('/social/media/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM media_library WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const inUse = await query(
      'SELECT COUNT(*)::int as count FROM social_post_media WHERE media_id = $1',
      [req.params.id]
    );

    if (inUse.rows[0].count > 0) {
      return res.status(400).json({ error: 'Media is in use by one or more posts. Remove from posts first.' });
    }

    await query('DELETE FROM media_library WHERE id = $1', [req.params.id]);
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

export default router;
