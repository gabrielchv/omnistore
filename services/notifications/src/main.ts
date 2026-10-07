import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const rabbitUrl = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';

  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      exchange: 'payments',
      wildcards: true,
      queue: 'notifications',
      noAck: false,
      queueOptions: { durable: true },
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 8082);
}
await bootstrap();
