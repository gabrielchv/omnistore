import type { Core } from '@strapi/strapi';

const SEED_PRODUCTS = [
  { title: 'USB-C Hub 8-in-1', sku: 'SKU-100', price: 129.9, stock: 50 },
  { title: 'Mechanical Keyboard', sku: 'SKU-101', price: 449.0, stock: 20 },
  { title: '27" 4K Monitor', sku: 'SKU-102', price: 1899.9, stock: 12 },
  // Sentinel used to exercise the payments retry -> dead-letter path.
  { title: 'Declined Test Product', sku: 'FAIL', price: 1.0, stock: 99 },
];

const PUBLIC_READ_ACTIONS = [
  'api::product.product.find',
  'api::product.product.findOne',
];

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedProducts(strapi);
    await grantPublicRead(strapi);
  },
};

async function seedProducts(strapi: Core.Strapi): Promise<void> {
  const documents = strapi.documents('api::product.product');
  const existing = await documents.findMany();
  if (existing.length > 0) {
    return;
  }

  for (const product of SEED_PRODUCTS) {
    await documents.create({ data: product });
  }
  strapi.log.info(`Seeded ${SEED_PRODUCTS.length} products`);
}

async function grantPublicRead(strapi: Core.Strapi): Promise<void> {
  const publicRole = await strapi.db
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' }, populate: { permissions: true } });

  if (!publicRole) {
    strapi.log.warn('public role not found — skipping public product API permission grant');
    return;
  }

  const granted = new Set(
    (publicRole.permissions ?? []).map((permission: { action: string }) => permission.action),
  );

  for (const action of PUBLIC_READ_ACTIONS) {
    if (granted.has(action)) {
      continue;
    }
    await strapi.db.query('plugin::users-permissions.permission').create({
      data: { action, role: publicRole.id },
    });
  }
}
