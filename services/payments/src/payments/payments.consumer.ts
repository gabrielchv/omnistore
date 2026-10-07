import { Controller, Inject, Logger } from '@nestjs/common';
import {
  ClientProxy,
  Ctx,
  EventPattern,
  Payload,
} from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { firstValueFrom } from 'rxjs';
import { RABBITMQ_CLIENT } from '../rabbitmq/rabbitmq.module.js';

const MAX_RETRIES = 3;
const ORDER_CREATED = 'order.created';
const PAYMENT_SUCCEEDED = 'payment.succeeded';

export interface OrderCreated {
  id: string;
  sku: string;
  qty: number;
  total: number;
  status: string;
  createdAt: string;
}

@Controller()
export class PaymentsConsumer {
  private readonly logger = new Logger(PaymentsConsumer.name);
  private readonly processed = new Set<string>();

  constructor(@Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy) {}

  @EventPattern(ORDER_CREATED)
  async handleOrderCreated(
    @Payload() data: OrderCreated,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RmqContext is opaque at runtime
    @Ctx() context: any,
  ): Promise<void> {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;
    const retries = Number(message.properties?.headers?.['x-retries'] ?? 0);

    if (retries >= MAX_RETRIES) {
      this.logger.warn(
        `order ${data.id} exceeded ${MAX_RETRIES} retries — dead-lettering`,
      );
      channel.nack(message, false, false);
      return;
    }

    try {
      if (this.processed.has(data.id)) {
        this.logger.warn(`order ${data.id} already processed — dropping duplicate`);
        channel.ack(message);
        return;
      }

      await this.processPayment(data);
      this.processed.add(data.id);

      this.logger.log(
        `order ${data.id} paid (${data.total}) — emitting ${PAYMENT_SUCCEEDED}`,
      );
      await firstValueFrom(
        this.client.emit(PAYMENT_SUCCEEDED, {
          orderId: data.id,
          amount: data.total,
          status: 'PAID',
          paidAt: new Date().toISOString(),
        }),
      );
      channel.ack(message);
    } catch (err) {
      this.logger.warn(
        `order ${data.id} payment failed (${String(err)}) — retry ${retries + 1}/${MAX_RETRIES}`,
      );
      const body = JSON.stringify({ pattern: ORDER_CREATED, data });
      channel.publish('orders', ORDER_CREATED, Buffer.from(body), {
        persistent: true,
        headers: { 'x-retries': retries + 1 },
      });
      channel.ack(message);
    }
  }

  private async processPayment(data: OrderCreated): Promise<void> {
    // Deterministic sentinel for demos/tests: SKU "FAIL" always declines.
    if (data.sku === 'FAIL') {
      throw new Error('card declined');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
