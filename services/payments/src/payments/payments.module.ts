import { Module } from '@nestjs/common';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module.js';
import { PaymentsConsumer } from './payments.consumer.js';

@Module({
  imports: [RabbitmqModule],
  controllers: [PaymentsConsumer],
})
export class PaymentsModule {}
