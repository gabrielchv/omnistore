import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';

const PAYMENT_SUCCEEDED = 'payment.succeeded';

export interface PaymentSucceeded {
  orderId: string;
  amount: number;
  status: string;
  paidAt: string;
}

@Controller()
export class NotificationsConsumer {
  private readonly logger = new Logger(NotificationsConsumer.name);

  @EventPattern(PAYMENT_SUCCEEDED)
  handlePaymentSucceeded(
    @Payload() data: PaymentSucceeded,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RmqContext is opaque at runtime
    @Ctx() context: any,
  ): void {
    const channel = context.getChannelRef() as Channel;
    const message = context.getMessage() as ConsumeMessage;

    // Mock dispatch (email / SMS / push). Terminal consumer of the chain.
    this.logger.log(
      `notifying customer: order ${data.orderId} paid (${data.amount})`,
    );
    channel.ack(message);
  }
}
