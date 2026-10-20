import { buildCodegenConfigFromSchema } from './schema-model-plan';

function typeRef(kind: string, name?: string, ofType?: ReturnType<typeof typeRef>) {
  return { kind, name: name ?? null, ofType: ofType ?? null };
}

function field(name: string, type: ReturnType<typeof typeRef>, args: Array<{ name: string }> = []) {
  return { name, type, args };
}

function objectType(name: string, fields: ReturnType<typeof field>[]) {
  return { kind: 'OBJECT', name, fields };
}

const address = objectType('Address', [
  field('full_address', typeRef('SCALAR', 'String')),
  field('area', typeRef('SCALAR', 'String')),
]);

const productRaw = objectType('Product_Raw_Model', [
  field('title', typeRef('SCALAR', 'String')),
  field('tags', typeRef('LIST', undefined, typeRef('SCALAR', 'String'))),
  field('address', typeRef('OBJECT', 'Address')),
]);

const product = objectType('Product', [
  field('id', typeRef('SCALAR', 'ID')),
  field('category', typeRef('OBJECT', 'Category')),
  field('order_list', typeRef('LIST', undefined, typeRef('OBJECT', 'Order'))),
]);

const categoryRaw = objectType('Category_Raw_Model', [field('name', typeRef('SCALAR', 'String'))]);
const category = objectType('Category', [
  field('id', typeRef('SCALAR', 'ID')),
  field('name', typeRef('SCALAR', 'String')),
  field('brand', typeRef('OBJECT', 'Brand')),
  field('returnable_item', typeRef('OBJECT', 'ReturnableItem')),
  field('ledger_account', typeRef('OBJECT', 'LedgerAccount')),
  field('variant_list', typeRef('LIST', undefined, typeRef('OBJECT', 'Variant'))),
  field('order_list', typeRef('LIST', undefined, typeRef('OBJECT', 'Order'))),
]);

const ledgerAccountRaw = objectType('Ledger_Account_Raw_Model', [
  field('name', typeRef('SCALAR', 'String')),
]);
const ledgerAccount = objectType('LedgerAccount', [
  field('id', typeRef('SCALAR', 'ID')),
  field('order_list', typeRef('LIST', undefined, typeRef('OBJECT', 'Order'))),
]);

const schema = {
  data: {
    __schema: {
      queryType: { name: 'Query' },
      types: [
        objectType('Query', [
          field('productList', typeRef('OBJECT', 'ProductList'), [{ name: 'relation' }, { name: 'where' }]),
          field('productListCount', typeRef('OBJECT', 'Count')),
          field('categoryList', typeRef('OBJECT', 'CategoryList'), [{ name: 'where' }]),
          field('ledgerAccountList', typeRef('OBJECT', 'LedgerAccountList'), [{ name: 'relation' }]),
          field('shopDashboard', typeRef('OBJECT', 'ShopDashboard')),
        ]),
        productRaw,
        product,
        address,
        categoryRaw,
        category,
        ledgerAccountRaw,
        ledgerAccount,
        objectType('Shop_Dashboard_Raw_Model', [field('open_orders', typeRef('SCALAR', 'Int'))]),
        objectType('ShopDashboard', [field('id', typeRef('SCALAR', 'ID'))]),
      ],
    },
  },
};

describe('buildCodegenConfigFromSchema', () => {
  it('discovers models, nested fields, and only bounded relations', () => {
    const config = buildCodegenConfigFromSchema(schema, { schemaPath: 'schema.json' });
    const productModel = config.models.find((model) => model.name === 'product');
    const categoryModel = config.models.find((model) => model.name === 'category');
    const ledger = config.models.find((model) => model.name === 'ledger_account');

    expect(config.models.map((model) => model.name)).toEqual([
      'category',
      'ledger_account',
      'product',
      'shop_dashboard',
    ]);
    expect(config.models.find((model) => model.name === 'shop_dashboard')).toMatchObject({
      fields: ['open_orders'],
      supportsConnection: false,
    });
    expect(productModel?.fields).toEqual(['title', 'tags', 'address { full_address area }']);
    expect(productModel?.supportsConnection).toBe(true);
    expect(productModel?.connectionFields).toBeUndefined();
    expect(categoryModel?.supportsConnection).toBe(false);
    expect(categoryModel?.connectionFields).toEqual({
      brand: 'id data { name }',
      returnable_item: 'id data { name average_price stock_quantity }',
      ledger_account: 'id data { name }',
      variant_list: 'id data { identifier }',
    });
    expect(ledger?.connectionFields?.order_list).toBeUndefined();
    expect(JSON.stringify(config)).not.toContain('order_list');
  });

  it('rejects a model that is not in the published schema', () => {
    expect(() =>
      buildCodegenConfigFromSchema(schema, { schemaPath: 'schema.json', models: ['missing'] }),
    ).toThrow('published schema has no model: missing');
  });

  it('rejects an empty schema instead of emitting a partial client', () => {
    expect(() =>
      buildCodegenConfigFromSchema({ data: { __schema: { types: [{ name: 'Query', fields: [] }] } } }, {
        schemaPath: 'schema.json',
      }),
    ).toThrow('published schema did not contain any models');
  });

  it('omits relations when the caller turns them off', () => {
    const config = buildCodegenConfigFromSchema(schema, {
      schemaPath: 'schema.json',
      includeRelations: false,
    });
    expect(config.models.every((model) => !model.connectionFields)).toBe(true);
  });
});
