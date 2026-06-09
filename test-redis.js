// test-redis.js
require('dotenv').config();
const { createClient } = require('redis');

const client = createClient({ url: process.env.REDIS_URL });

(async () => {
  client.on('error', (err) => console.error('Redis Client Error', err));
  await client.connect();
  await client.set('vaobep:test', 'ok', { EX: 60 });
  const v = await client.get('vaobep:test');
  console.log('Redis test value:', v);
  await client.disconnect();
})();