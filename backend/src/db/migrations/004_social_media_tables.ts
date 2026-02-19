import { Pool } from 'pg';

export const id = '004_social_media_tables';

export async function up(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id VARCHAR(255) NOT NULL,
      provider VARCHAR(50) NOT NULL DEFAULT 'meta',
      provider_account_id VARCHAR(255) NOT NULL,
      account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('facebook_page', 'instagram_business')),
      account_name VARCHAR(255) NOT NULL DEFAULT '',
      account_avatar_url TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL,
      token_expires_at TIMESTAMPTZ,
      long_lived_token BOOLEAN NOT NULL DEFAULT false,
      page_id VARCHAR(255),
      instagram_account_id VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT true,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider, provider_account_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_unique ON social_accounts(user_id, provider, provider_account_id);

    CREATE TABLE IF NOT EXISTS media_library (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id VARCHAR(255) NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      file_type VARCHAR(100) NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      mime_type VARCHAR(100) NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL DEFAULT '',
      storage_key TEXT NOT NULL DEFAULT '',
      width INT,
      height INT,
      duration_seconds NUMERIC(10,2),
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_media_library_user ON media_library(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_library_type ON media_library(file_type);

    CREATE TABLE IF NOT EXISTS social_posts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id VARCHAR(255) NOT NULL,
      content_item_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
      caption TEXT NOT NULL DEFAULT '',
      hashtags TEXT NOT NULL DEFAULT '',
      post_type VARCHAR(50) NOT NULL DEFAULT 'image' CHECK (post_type IN ('image', 'video', 'carousel', 'text', 'reel', 'story')),
      status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      error_message TEXT,
      retry_count INT NOT NULL DEFAULT 0,
      max_retries INT NOT NULL DEFAULT 3,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
    CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_social_posts_content_item ON social_posts(content_item_id);

    CREATE TABLE IF NOT EXISTS social_post_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
      platform_post_id VARCHAR(255),
      platform_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (platform_status IN ('pending', 'publishing', 'published', 'failed')),
      platform_error TEXT,
      published_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_social_post_accounts_post ON social_post_accounts(social_post_id);
    CREATE INDEX IF NOT EXISTS idx_social_post_accounts_account ON social_post_accounts(social_account_id);

    CREATE TABLE IF NOT EXISTS social_post_media (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      media_id UUID NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
      sort_order INT NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_social_post_media_post ON social_post_media(social_post_id);

    CREATE TABLE IF NOT EXISTS social_post_analytics (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      social_post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
      social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
      platform_post_id VARCHAR(255),
      impressions INT NOT NULL DEFAULT 0,
      reach INT NOT NULL DEFAULT 0,
      engagement INT NOT NULL DEFAULT 0,
      likes INT NOT NULL DEFAULT 0,
      comments INT NOT NULL DEFAULT 0,
      shares INT NOT NULL DEFAULT 0,
      saves INT NOT NULL DEFAULT 0,
      clicks INT NOT NULL DEFAULT 0,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_social_post_analytics_post ON social_post_analytics(social_post_id);
    CREATE INDEX IF NOT EXISTS idx_social_post_analytics_account ON social_post_analytics(social_account_id);
  `);
}

export async function down(pool: Pool): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS social_post_analytics;
    DROP TABLE IF EXISTS social_post_media;
    DROP TABLE IF EXISTS social_post_accounts;
    DROP TABLE IF EXISTS social_posts;
    DROP TABLE IF EXISTS media_library;
    DROP TABLE IF EXISTS social_accounts;
  `);
}
