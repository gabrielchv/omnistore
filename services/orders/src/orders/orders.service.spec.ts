import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';
import { RABBITMQ_CLIENT } from '../rabbitmq/rabbitmq.module.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  const emit = vi.fn().mockReturnValue(of(undefined));
  const client = { emit };
  const config = {
    get: vi.fn((_key: string, fallback: string) => fallback),
  };

  beforeEach(async () => {
    emit.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [{ id: 1, title: 'USB-C Hub', sku: 'SKU-100', price: 10, stock: 5 }],
          }),
      }),
    );
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: RABBITMQ_CLIENT, useValue: client },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(OrdersService);
  });

  it('creates an order and emits order.created', async () => {
    const order = await service.create({ sku: 'SKU-100', qty: 2 });
    expect(order.total).toBe(20);
    expect(order.status).toBe('PENDING');
    expect(emit).toHaveBeenCalledWith('order.created', order);
  });

  it('rejects an unknown sku', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [] }) }),
    );
    await expect(service.create({ sku: 'MISSING', qty: 1 })).rejects.toThrow('not found');
  });

  it('returns a stored order by id', async () => {
    const order = await service.create({ sku: 'SKU-100', qty: 1 });
    expect(service.findById(order.id)).toEqual(order);
  });
});
