import amqplib from 'amqplib';
import { setTimeout as sleep } from 'node:timers/promises';

const EXCHANGE = 'payments.dlq';
const QUEUE = 'payments.dlq.queue';
const ROUTING_KEY = 'failed';

/**
 * Declares the dead-letter exchange and queue used by the payments consumer.
 * The `orders`/`payments` exchanges and their queues are asserted by Nest's
 * RMQ transport (wildcards mode); the DLQ is the one piece it does not manage.
 */
export async function assertDlqTopology(url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      const connection = await amqplib.connect(url);
      try {
        const channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
        await channel.assertQueue(QUEUE, { durable: true });
        await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
        await channel.close();
      } finally {
        await connection.close();
      }
      return;
    } catch (err) {
      lastError = err;
      await sleep(1000);
    }
  }
  throw new Error(`could not reach RabbitMQ at ${url}: ${String(lastError)}`);
}
