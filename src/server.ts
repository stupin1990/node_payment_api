import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './config.js';
import { connectRedis, disconnectRedis } from './redis.js';

async function bootstrap() {
  await mongoose.connect(config.mongoUri);
  await connectRedis();

  const server = app.listen(config.port, () => {
    console.log(`Payment API is listening on port ${config.port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await disconnectRedis();
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('Failed to start Payment API');
  console.error(error);
  process.exitCode = 1;
});
