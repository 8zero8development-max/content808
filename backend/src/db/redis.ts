import { config } from '../config';

/**
 * Redis connection config for BullMQ.
 * BullMQ creates its own IORedis instance internally, avoiding version mismatches.
 */
export const redisConnection = {
    host: config.redis.host,
    port: config.redis.port,
};
