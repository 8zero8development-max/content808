import { Router, Request, Response } from 'express';
import { config } from '../config';
import { query } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const GRAPH_URL = `https://graph.facebook.com/${config.meta.graphApiVersion}`;
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
  'pages_read_user_content',
].join(',');

router.get('/meta/auth', (req: Request, res: Response) => {
  const state = uuidv4();
  const userId = req.user?.id || 'unknown';

  const authUrl = new URL('https://www.facebook.com/' + config.meta.graphApiVersion + '/dialog/oauth');
  authUrl.searchParams.set('client_id', config.meta.appId);
  authUrl.searchParams.set('redirect_uri', config.meta.callbackUrl);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', `${state}:${userId}`);
  authUrl.searchParams.set('response_type', 'code');

  res.json({ url: authUrl.toString(), state });
});

router.get('/meta/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=${encodeURIComponent(error_description as string || 'Authorization denied')}`);
    }

    if (!code || !state) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=Missing authorization code`);
    }

    const [, userId] = (state as string).split(':');
    if (!userId) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=Invalid state parameter`);
    }

    const tokenUrl = `${GRAPH_URL}/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.callbackUrl,
      code: code as string,
    });

    const tokenRes = await fetch(`${tokenUrl}?${tokenParams.toString()}`);
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };

    if (!tokenData.access_token) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=${encodeURIComponent(tokenData.error?.message || 'Failed to get access token')}`);
    }

    const shortToken = tokenData.access_token;

    const longTokenRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta.appId}&client_secret=${config.meta.appSecret}&fb_exchange_token=${shortToken}`
    );
    const longTokenData = await longTokenRes.json() as { access_token?: string; expires_in?: number };
    const longLivedToken = longTokenData.access_token || shortToken;
    const tokenExpiresIn = longTokenData.expires_in || 3600;
    const tokenExpiresAt = new Date(Date.now() + tokenExpiresIn * 1000);
    const isLongLived = !!longTokenData.access_token;

    const pagesRes = await fetch(`${GRAPH_URL}/me/accounts?access_token=${longLivedToken}&fields=id,name,picture,access_token,instagram_business_account`);
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; picture?: { data?: { url?: string } }; access_token: string; instagram_business_account?: { id: string } }> };

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.redirect(`${config.frontendUrl}/social/accounts?error=No Facebook Pages found. Please make sure you have admin access to at least one Facebook Page.`);
    }

    let connectedCount = 0;

    for (const page of pagesData.data) {
      const pageId = page.id;
      const pageName = page.name;
      const pageAvatar = page.picture?.data?.url || '';
      const pageToken = page.access_token;

      await query(
        `INSERT INTO social_accounts (id, user_id, provider, provider_account_id, account_type, account_name, account_avatar_url, access_token, token_expires_at, long_lived_token, page_id, metadata)
         VALUES ($1, $2, 'meta', $3, 'facebook_page', $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, provider, provider_account_id)
         DO UPDATE SET account_name = $4, account_avatar_url = $5, access_token = $6, token_expires_at = $7, long_lived_token = $8, updated_at = NOW(), is_active = true`,
        [uuidv4(), userId, pageId, pageName, pageAvatar, pageToken, tokenExpiresAt, isLongLived, pageId, JSON.stringify({ page_category: '' })]
      );
      connectedCount++;

      if (page.instagram_business_account) {
        const igId = page.instagram_business_account.id;
        const igRes = await fetch(`${GRAPH_URL}/${igId}?fields=id,name,username,profile_picture_url&access_token=${pageToken}`);
        const igData = await igRes.json() as { id?: string; name?: string; username?: string; profile_picture_url?: string };

        if (igData.id) {
          await query(
            `INSERT INTO social_accounts (id, user_id, provider, provider_account_id, account_type, account_name, account_avatar_url, access_token, token_expires_at, long_lived_token, page_id, instagram_account_id, metadata)
             VALUES ($1, $2, 'meta', $3, 'instagram_business', $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (user_id, provider, provider_account_id)
             DO UPDATE SET account_name = $4, account_avatar_url = $5, access_token = $6, token_expires_at = $7, long_lived_token = $8, instagram_account_id = $10, updated_at = NOW(), is_active = true`,
            [uuidv4(), userId, igId, igData.username || igData.name || 'Instagram', igData.profile_picture_url || '', pageToken, tokenExpiresAt, isLongLived, pageId, igId, JSON.stringify({ username: igData.username || '' })]
          );
          connectedCount++;
        }
      }
    }

    res.redirect(`${config.frontendUrl}/social/accounts?connected=${connectedCount}`);
  } catch (err) {
    console.error('Meta OAuth callback error:', err);
    res.redirect(`${config.frontendUrl}/social/accounts?error=Connection failed. Please try again.`);
  }
});

router.post('/meta/refresh-token/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.id || 'unknown';

    const result = await query(
      'SELECT * FROM social_accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = result.rows[0];
    const currentToken = account.access_token;

    const refreshRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta.appId}&client_secret=${config.meta.appSecret}&fb_exchange_token=${currentToken}`
    );
    const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } };

    if (!refreshData.access_token) {
      return res.status(400).json({ error: refreshData.error?.message || 'Failed to refresh token' });
    }

    const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);

    await query(
      'UPDATE social_accounts SET access_token = $1, token_expires_at = $2, long_lived_token = true, updated_at = NOW() WHERE id = $3',
      [refreshData.access_token, newExpiresAt, accountId]
    );

    res.json({ message: 'Token refreshed', expires_at: newExpiresAt });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

export default router;
