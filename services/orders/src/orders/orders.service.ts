import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import { ORDER_CREATED, RABBITMQ_CLIENT } from '../rabbitmq/rabbitmq.module.js';
import { CreateOrderDto } from './dto/create-order.dto.js';

export interface Product {
  id: number;
  title: string;
  sku: string;
  price: number;
  stock: number;
}

export interface Order {
  id: string;
  sku: string;
  qty: number;
  total: number;
  status: 'PENDING';
  createdAt: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orders = new Map<string, Order>();

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateOrderDto): Promise<Order> {
    const product = await this.fetchProduct(dto.sku);
    if (!product) {
      throw new NotFoundException(`product "${dto.sku}" not found`);
    }

    const order: Order = {
      id: randomUUID(),
      sku: product.sku,
      qty: dto.qty,
      total: Number((product.price * dto.qty).toFixed(2)),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);

    await firstValueFrom(this.client.emit(ORDER_CREATED, order));
    this.logger.log(`order ${order.id} created — "${ORDER_CREATED}" emitted`);
    return order;
  }

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  private async fetchProduct(sku: string): Promise<Product | null> {
    const base = this.config.get<string>('STRAPI_URL', 'http://localhost:1337');
    const url = `${base}/api/products?filters[sku][$eq]=${encodeURIComponent(sku)}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`strapi responded ${res.status}`);
      }
      const payload = (await res.json()) as { data: Product[] };
      return payload.data[0] ?? null;
    } catch (err) {
      this.logger.error(`catalog unreachable at ${url}: ${String(err)}`);
      throw new ServiceUnavailableException('product catalog unavailable');
    }
  }
}
