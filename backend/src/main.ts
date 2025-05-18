import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Crucial for allowing frontend to connect from a different port
  app.enableCors({
    origin: '*', // For development. Be more specific in production.
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  Logger.log(`🚀 Backend server is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`🔌 WebSocket is expected to be available on ws://localhost:${port}`, 'Bootstrap');
}
bootstrap();
