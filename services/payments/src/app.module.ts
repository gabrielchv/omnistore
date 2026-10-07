import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller.js';
import { PaymentsModule } from './payments/payments.module.js';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitmqModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
