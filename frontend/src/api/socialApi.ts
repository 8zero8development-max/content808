const API_URL = import.meta.env.VITE_API_URL || '';
const BASE = `${API_URL}/api/v1/content-hub`;

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-user-id': 'staff-user-1',
  'x-user-name': 'Staff User',
  'x-user-role': 'admin',
};

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export interface SocialAccount {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  account_type: 'facebook_page' | 'instagram_business';
  account_name: string;
  account_avatar_url: string;
  token_expires_at: string | null;
  long_lived_token: boolean;
  page_id: string | null;
  instagram_account_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  token_status: string;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  url: string;
  thumbnail_url: string;
  storage_key: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  content_item_id: string | null;
  caption: string;
  hashtags: string;
  post_type: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  retry_count: number;
  media: Array<{ id: string; url: string; thumbnail_url: string; file_type: string; file_name: string }>;
  target_accounts: Array<{
    id: string;
    social_account_id: string;
    platform_post_id: string | null;
    platform_status: string;
    platform_error: string | null;
    published_at: string | null;
    account_name: string;
    account_type: string;
    account_avatar_url: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSummary {
  total_published: number;
  total_impressions: number;
  total_reach: number;
  total_engagement: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  total_clicks: number;
  by_platform: Array<{ account_type: string; post_count: number; impressions: number; reach: number; engagement: number }>;
  recent_posts: Array<{ id: string; caption: string; post_type: string; published_at: string; impressions: number; reach: number; engagement: number; likes: number }>;
  by_status: Record<string, number>;
}

export const socialApi = {
  getAuthUrl: () => request<{ url: string; state: string }>('/meta/auth'),

  getAccounts: () => request<{ accounts: SocialAccount[] }>('/social/accounts'),
  getAccount: (id: string) => request<SocialAccount>(`/social/accounts/${id}`),
  toggleAccount: (id: string) => request<{ id: string; is_active: boolean }>(`/social/accounts/${id}/toggle`, { method: 'PUT' }),
  disconnectAccount: (id: string) => request<{ message: string }>(`/social/accounts/${id}`, { method: 'DELETE' }),
  refreshToken: (id: string) => request<{ message: string; expires_at: string }>(`/meta/refresh-token/${id}`, { method: 'POST' }),

  getPosts: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ posts: SocialPost[]; total: number }>(`/social/posts${qs}`);
  },
  getPost: (id: string) => request<SocialPost>(`/social/posts/${id}`),
  createPost: (data: {
    caption: string;
    hashtags?: string;
    post_type?: string;
    scheduled_at?: string | null;
    content_item_id?: string | null;
    account_ids: string[];
    media_ids: string[];
  }) => request<SocialPost>('/social/posts', { method: 'POST', body: data }),
  updatePost: (id: string, data: Partial<{
    caption: string;
    hashtags: string;
    post_type: string;
    scheduled_at: string | null;
    account_ids: string[];
    media_ids: string[];
  }>) => request<SocialPost>(`/social/posts/${id}`, { method: 'PUT', body: data }),
  deletePost: (id: string) => request<{ message: string }>(`/social/posts/${id}`, { method: 'DELETE' }),
  duplicatePost: (id: string) => request<SocialPost>(`/social/posts/${id}/duplicate`, { method: 'POST' }),
  publishPost: (id: string) => request<SocialPost>(`/social/posts/${id}/publish`, { method: 'POST' }),
  reschedulePost: (id: string, scheduled_at: string | null) =>
    request<SocialPost>(`/social/posts/${id}/reschedule`, { method: 'PUT', body: { scheduled_at } }),

  getMedia: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ media: MediaItem[]; total: number }>(`/social/media${qs}`);
  },
  getUploadUrl: (data: { file_name: string; file_type: string; file_size: number; mime_type: string }) =>
    request<{ id: string; upload_url: string; storage_key: string; local_path: string }>('/social/media/upload-url', { method: 'POST', body: data }),
  confirmUpload: (data: { media_id: string; url?: string; thumbnail_url?: string; width?: number; height?: number }) =>
    request<MediaItem>('/social/media/confirm-upload', { method: 'POST', body: data }),
  deleteMedia: (id: string) => request<{ message: string }>(`/social/media/${id}`, { method: 'DELETE' }),

  getAnalyticsSummary: () => request<AnalyticsSummary>('/social/analytics/summary'),
  fetchPostAnalytics: (postId: string) => request<{ post_id: string; analytics: unknown[] }>(`/social/analytics/fetch/${postId}`, { method: 'POST' }),
};
