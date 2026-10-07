import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { RABBITMQ_CLIENT } from '../rabbitmq/rabbitmq.module.js';
import { OrderCreated, PaymentsConsumer } from './payments.consumer.js';

describe('PaymentsConsumer', () => {
  let consumer: PaymentsConsumer;
  const emit = vi.fn().mockReturnValue(of(undefined));
  const client = { emit };

  beforeEach(async () => {
    emit.mockClear();
    const module = await Test.createTestingModule({
      controllers: [PaymentsConsumer],
      providers: [{ provide: RABBITMQ_CLIENT, useValue: client }],
    }).compile();
    consumer = module.get(PaymentsConsumer);
  });

  function makeOrder(id: string, sku: string): OrderCreated {
    return {
      id,
      sku,
      qty: 1,
      total: 10,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
  }

  function makeCtx(headers?: Record<string, unknown>) {
    const channel = { ack: vi.fn(), nack: vi.fn(), publish: vi.fn() };
    const message = { properties: { headers } };
    const context = {
      getChannelRef: () => channel,
      getMessage: () => message,
    };
    return { channel, context };
  }

  it('acks and emits payment.succeeded on success', async () => {
    const { channel, context } = makeCtx();
    await consumer.handleOrderCreated(makeOrder('o1', 'SKU-100'), context as never);
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      'payment.succeeded',
      expect.objectContaining({ orderId: 'o1' }),
    );
  });

  it('drops a duplicate delivery', async () => {
    const { context } = makeCtx();
    await consumer.handleOrderCreated(makeOrder('o2', 'SKU-100'), context as never);
    const second = makeCtx();
    await consumer.handleOrderCreated(makeOrder('o2', 'SKU-100'), second.context as never);
    expect(second.channel.ack).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('republishes with an incremented x-retries header on failure', async () => {
    const { channel, context } = makeCtx();
    await consumer.handleOrderCreated(makeOrder('o3', 'FAIL'), context as never);
    expect(channel.publish).toHaveBeenCalledWith(
      'orders',
      'order.created',
      expect.any(Buffer),
      expect.objectContaining({ headers: { 'x-retries': 1 } }),
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
  });

  it('dead-letters once max retries is reached', async () => {
    const { channel, context } = makeCtx({ 'x-retries': 3 });
    await consumer.handleOrderCreated(makeOrder('o4', 'FAIL'), context as never);
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });
});
