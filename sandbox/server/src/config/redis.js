import Redis from 'ioredis';
import { deletePod } from '../kubernetes/pod.js';
import { deleteService } from '../kubernetes/service.js';

const redis = new Redis(process.env.REDIS_URL);

const subscriber = new Redis(process.env.REDIS_URL);

export async function createSandboxKey(sandboxId) {
    await redis.set(`sandbox:${sandboxId}`, JSON.stringify({
        status: 'active'
    }), "EX", 60*20 ) // Key expires in 20 minutes;
}

redis.config('SET', 'notify-keyspace-events', 'Ex').catch((err) => {
    console.warn('Could not set notify-keyspace-events via Redis CONFIG:', err.message);
});

subscriber.subscribe('__keyevent@0__:expired').catch((err) => {
    console.error('Failed to subscribe to keyspace expiration events:', err.message);
});

subscriber.on('message', async (channel, key) => {
    console.log(`Key expired: ${key}`);

    /**
     *  sandbox:019e4104-020b-764e-b366-74ee0429d36a
     */
    const parts = key.split(':');
    if (parts[0] !== 'sandbox' || !parts[1]) return;
    const sandboxId = parts[1];

    // Delete the associated Kubernetes resources safely
    try {
        await Promise.allSettled([
            deletePod(sandboxId),
            deleteService(sandboxId)
        ]);
        console.log(`Cleaned up sandbox resources for: ${sandboxId}`);
    } catch (err) {
        console.error(`Error deleting sandbox ${sandboxId}:`, err);
    }
})

export default { subscriber }