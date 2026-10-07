import { Module } from '@nestjs/common';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [RabbitmqModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
