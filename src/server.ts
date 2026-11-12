import type { Server } from 'node:http';
import { app } from './app';
import { env } from './config/env';

const server: Server = app.listen(env.PORT, () => {
  console.log(`Forge API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}, shutting down gracefully`);
  server.close((error) => {
    if (error) {
      console.error('Error while closing server:', error);
      process.exit(1);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { server };
