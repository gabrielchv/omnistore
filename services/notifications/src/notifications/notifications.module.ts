import { Module } from '@nestjs/common';
import { NotificationsConsumer } from './notifications.consumer.js';

@Module({
  controllers: [NotificationsConsumer],
})
export class NotificationsModule {}
