import { Test } from '@nestjs/testing';
import { NotificationsConsumer } from './notifications.consumer.js';

describe('NotificationsConsumer', () => {
  let consumer: NotificationsConsumer;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [NotificationsConsumer],
    }).compile();
    consumer = module.get(NotificationsConsumer);
  });

  it('acks a payment.succeeded event', () => {
    const channel = { ack: vi.fn() };
    const message = { properties: {} };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => message,
    };
    consumer.handlePaymentSucceeded(
      { orderId: 'o1', amount: 10, status: 'PAID', paidAt: '' },
      context as never,
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });
});
