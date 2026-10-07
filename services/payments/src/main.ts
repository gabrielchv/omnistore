import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module.js';
import { assertDlqTopology } from './rabbitmq/topology.js';

async function bootstrap() {
  const rabbitUrl = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
  await assertDlqTopology(rabbitUrl);

  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitUrl],
      exchange: 'orders',
      wildcards: true,
      queue: 'payments',
      noAck: false,
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'payments.dlq',
          'x-dead-letter-routing-key': 'failed',
        },
      },
    },
  });
  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 8081);
}
await bootstrap();
