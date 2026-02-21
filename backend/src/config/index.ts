import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    callbackUrl: process.env.META_CALLBACK_URL || 'http://localhost:4000/api/v1/content-hub/meta/callback',
    graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'content-hub-session-secret',
  },
  storage: {
    baseUrl: process.env.STORAGE_BASE_URL || '/uploads',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
