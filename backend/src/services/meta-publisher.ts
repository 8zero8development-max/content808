import { query } from '../db/connection';
import { config } from '../config';

const GRAPH_URL = `https://graph.facebook.com/${config.meta.graphApiVersion}`;

interface PublishResult {
  accountId: string;
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export async function publishToAccounts(postId: string): Promise<PublishResult[]> {
  const postResult = await query('SELECT * FROM social_posts WHERE id = $1', [postId]);
  if (postResult.rows.length === 0) throw new Error('Post not found');
  const post = postResult.rows[0];

  const accountsResult = await query(
    `SELECT spa.*, sa.account_type, sa.access_token, sa.page_id, sa.instagram_account_id, sa.provider_account_id
     FROM social_post_accounts spa
     JOIN social_accounts sa ON spa.social_account_id = sa.id
     WHERE spa.social_post_id = $1`,
    [postId]
  );

  const mediaResult = await query(
    `SELECT ml.* FROM social_post_media spm
     JOIN media_library ml ON spm.media_id = ml.id
     WHERE spm.social_post_id = $1 ORDER BY spm.sort_order`,
    [postId]
  );

  const results: PublishResult[] = [];
  let allSuccess = true;
  const fullCaption = post.hashtags ? `${post.caption}\n\n${post.hashtags}` : post.caption;

  for (const account of accountsResult.rows) {
    try {
      let platformPostId: string | undefined;

      if (account.account_type === 'facebook_page') {
        platformPostId = await publishToFacebook(
          account.page_id || account.provider_account_id,
          account.access_token,
          fullCaption,
          mediaResult.rows
        );
      } else if (account.account_type === 'instagram_business') {
        platformPostId = await publishToInstagram(
          account.instagram_account_id || account.provider_account_id,
          account.access_token,
          fullCaption,
          mediaResult.rows,
          post.post_type
        );
      }

      await query(
        "UPDATE social_post_accounts SET platform_status = 'published', platform_post_id = $1, published_at = NOW() WHERE id = $2",
        [platformPostId, account.id]
      );

      results.push({ accountId: account.social_account_id, success: true, platformPostId });
    } catch (err) {
      allSuccess = false;
      const errMsg = (err as Error).message;
      await query(
        "UPDATE social_post_accounts SET platform_status = 'failed', platform_error = $1 WHERE id = $2",
        [errMsg, account.id]
      );
      results.push({ accountId: account.social_account_id, success: false, error: errMsg });
    }
  }

  if (allSuccess && results.length > 0) {
    await query(
      "UPDATE social_posts SET status = 'published', published_at = NOW(), updated_at = NOW() WHERE id = $1",
      [postId]
    );
  } else if (!allSuccess) {
    const anySuccess = results.some(r => r.success);
    await query(
      `UPDATE social_posts SET status = $1, error_message = $2, retry_count = retry_count + 1, updated_at = NOW() WHERE id = $3`,
      [
        anySuccess ? 'published' : 'failed',
        results.filter(r => !r.success).map(r => r.error).join('; '),
        postId,
      ]
    );
  }

  return results;
}

async function publishToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  media: Array<{ url: string; file_type: string }>
): Promise<string> {
  if (media.length > 0 && media[0].file_type === 'image') {
    const res = await fetch(`${GRAPH_URL}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: media[0].url,
        message,
        access_token: accessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: { message: string } };
    if (data.error) throw new Error(`Facebook API: ${data.error.message}`);
    return data.id || '';
  }

  if (media.length > 0 && media[0].file_type === 'video') {
    const res = await fetch(`${GRAPH_URL}/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: media[0].url,
        description: message,
        access_token: accessToken,
      }),
    });
    const data = await res.json() as { id?: string; error?: { message: string } };
    if (data.error) throw new Error(`Facebook API: ${data.error.message}`);
    return data.id || '';
  }

  const res = await fetch(`${GRAPH_URL}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      access_token: accessToken,
    }),
  });
  const data = await res.json() as { id?: string; error?: { message: string } };
  if (data.error) throw new Error(`Facebook API: ${data.error.message}`);
  return data.id || '';
}

async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  media: Array<{ url: string; file_type: string }>,
  postType: string
): Promise<string> {
  if (media.length === 0) {
    throw new Error('Instagram requires at least one media item');
  }

  if (postType === 'carousel' && media.length > 1) {
    const containerIds: string[] = [];
    for (const item of media) {
      const isVideo = item.file_type === 'video';
      const containerRes = await fetch(`${GRAPH_URL}/${igAccountId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [isVideo ? 'video_url' : 'image_url']: item.url,
          media_type: isVideo ? 'VIDEO' : 'IMAGE',
          is_carousel_item: true,
          access_token: accessToken,
        }),
      });
      const containerData = await containerRes.json() as { id?: string; error?: { message: string } };
      if (containerData.error) throw new Error(`Instagram API: ${containerData.error.message}`);
      containerIds.push(containerData.id || '');
    }

    const carouselRes = await fetch(`${GRAPH_URL}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'CAROUSEL',
        children: containerIds.join(','),
        caption,
        access_token: accessToken,
      }),
    });
    const carouselData = await carouselRes.json() as { id?: string; error?: { message: string } };
    if (carouselData.error) throw new Error(`Instagram API: ${carouselData.error.message}`);

    const publishRes = await fetch(`${GRAPH_URL}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: accessToken,
      }),
    });
    const publishData = await publishRes.json() as { id?: string; error?: { message: string } };
    if (publishData.error) throw new Error(`Instagram API: ${publishData.error.message}`);
    return publishData.id || '';
  }

  const isVideo = media[0].file_type === 'video';
  const isReel = postType === 'reel';

  const containerRes = await fetch(`${GRAPH_URL}/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      [isVideo || isReel ? 'video_url' : 'image_url']: media[0].url,
      media_type: isReel ? 'REELS' : (isVideo ? 'VIDEO' : 'IMAGE'),
      caption,
      access_token: accessToken,
    }),
  });
  const containerData = await containerRes.json() as { id?: string; error?: { message: string } };
  if (containerData.error) throw new Error(`Instagram API: ${containerData.error.message}`);

  if (isVideo || isReel) {
    await waitForMediaReady(igAccountId, containerData.id || '', accessToken);
  }

  const publishRes = await fetch(`${GRAPH_URL}/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: accessToken,
    }),
  });
  const publishData = await publishRes.json() as { id?: string; error?: { message: string } };
  if (publishData.error) throw new Error(`Instagram API: ${publishData.error.message}`);
  return publishData.id || '';
}

async function waitForMediaReady(igAccountId: string, containerId: string, accessToken: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(
      `${GRAPH_URL}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json() as { status_code?: string; error?: { message: string } };

    if (statusData.status_code === 'FINISHED') return;
    if (statusData.status_code === 'ERROR') {
      throw new Error(`Instagram media processing failed for container ${containerId}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`Instagram media processing timed out for account ${igAccountId}`);
}
