import { Redis, RedisOptions } from 'ioredis';
import { AppLogger } from './logging/logger';
import { config } from './config';

export class CacheService {
    private redis: Redis | null = null;
    private readonly isEnabled: boolean;

    constructor() {
        this.isEnabled = !!config.redis.url;
    }

    public async initialize(): Promise<void> {
        if (!this.isEnabled) {
            AppLogger.warn('⚠ Redis URL not provided. Caching is disabled.');
            return;
        }

        try {
            const options: RedisOptions = {
                maxRetriesPerRequest: 3,
                retryStrategy(times) {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                // Reconnect if connection is lost
                reconnectOnError: (err) => {
                    const targetError = 'READONLY';
                    if (err.message.includes(targetError)) {
                        return true;
                    }
                    return false;
                },
            };

            this.redis = new Redis(config.redis.url, options);

            this.redis.on('connect', () => {
                AppLogger.info('⚡ Redis connected successfully');
            });

            this.redis.on('error', (error) => {
                AppLogger.error('❌ Redis connection error', error);
            });

        } catch (error) {
            AppLogger.error('❌ Failed to initialize Redis', error);
        }
    }

    public async get<T>(key: string): Promise<T | null> {
        if (!this.redis) return null;
        try {
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            AppLogger.error(`❌ Cache GET error for key: ${key}`, error);
            return null;
        }
    }

    public async set(key: string, value: any, ttl: number = config.redis.ttl): Promise<void> {
        if (!this.redis) return;
        try {
            const data = JSON.stringify(value);
            if (ttl > 0) {
                await this.redis.set(key, data, 'EX', ttl);
            } else {
                await this.redis.set(key, data);
            }
        } catch (error) {
            AppLogger.error(`❌ Cache SET error for key: ${key}`, error);
        }
    }

    public async del(key: string): Promise<void> {
        if (!this.redis) return;
        try {
            await this.redis.del(key);
        } catch (error) {
            AppLogger.error(`❌ Cache DEL error for key: ${key}`, error);
        }
    }

    public async delByPattern(pattern: string): Promise<void> {
        if (!this.redis) return;
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            AppLogger.error(`❌ Cache DEL by pattern error: ${pattern}`, error);
        }
    }

    public async shutdown(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
            AppLogger.info('⚡ Redis connection closed');
        }
    }
}
