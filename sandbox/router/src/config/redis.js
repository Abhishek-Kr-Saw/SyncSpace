import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL)

redis.on('connect', () => {
    console.log("Connected to Redis successfully")
})

redis.on('error', (error) => {
    console.error('Redis connection error:',error)
})

export async function refreshTTL(sandboxId){
    await redis.expire(`sandbox:${sandboxId}`, 120);
}