require('dotenv').config();
const { createClient } = require('redis');

async function main(){
  const url = process.env.REDIS_URL || 'redis://:YOUR_REDIS_PASSWORD@localhost:6379';
  const client = createClient({ url });

  client.on('error', (err) => console.error('Redis Client Error', err));

  await client.connect();
  await client.set('vaobep:test', 'ok', { EX: 60 });
  const v = await client.get('vaobep:test');
  console.log('Redis test value:', v);
  await client.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
