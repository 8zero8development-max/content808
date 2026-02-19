import { Router, Request, Response } from 'express';
import { query } from '../db/connection';

const router = Router();

router.get('/social/accounts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const result = await query(
      `SELECT id, user_id, provider, provider_account_id, account_type, account_name, account_avatar_url,
              token_expires_at, long_lived_token, page_id, instagram_account_id, is_active, metadata, created_at, updated_at
       FROM social_accounts WHERE user_id = $1 ORDER BY account_type, account_name`,
      [userId]
    );

    const accounts = result.rows.map((row) => ({
      ...row,
      token_status: getTokenStatus(row.token_expires_at),
    }));

    res.json({ accounts });
  } catch (err) {
    console.error('Error fetching social accounts:', err);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

router.get('/social/accounts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const result = await query(
      `SELECT id, user_id, provider, provider_account_id, account_type, account_name, account_avatar_url,
              token_expires_at, long_lived_token, page_id, instagram_account_id, is_active, metadata, created_at, updated_at
       FROM social_accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];
    res.json({ ...account, token_status: getTokenStatus(account.token_expires_at) });
  } catch (err) {
    console.error('Error fetching social account:', err);
    res.status(500).json({ error: 'Failed to fetch social account' });
  }
});

router.put('/social/accounts/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const newStatus = !existing.rows[0].is_active;
    await query(
      'UPDATE social_accounts SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [newStatus, req.params.id]
    );

    res.json({ id: req.params.id, is_active: newStatus });
  } catch (err) {
    console.error('Error toggling account:', err);
    res.status(500).json({ error: 'Failed to toggle account' });
  }
});

router.delete('/social/accounts/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'unknown';
    const existing = await query(
      'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await query('DELETE FROM social_accounts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Account disconnected' });
  } catch (err) {
    console.error('Error disconnecting account:', err);
    res.status(500).json({ error: 'Failed to disconnect account' });
  }
});

function getTokenStatus(expiresAt: string | null): string {
  if (!expiresAt) return 'unknown';
  const expires = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return 'expired';
  if (daysLeft < 7) return 'expiring_soon';
  return 'active';
}

export default router;
