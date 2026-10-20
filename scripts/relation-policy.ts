/**
 * Bounded relation selections shared by apito-codegen and the Apito CLI.
 *
 * Only these keys are expanded, and only when the published model actually
 * has that field. Reverse relations that are not listed here are left out.
 * A full reverse fan-out (for example ledger_account.order_list) makes the
 * generated documents too large to compile.
 *
 * Apps do not ship their own copy of this list. Add a relation here when a
 * consumer needs it.
 */
export const boundedRelationSelections: Record<string, Record<string, string>> = {
  order: {
    customer: 'id data { name phone has_whatsapp address { full_address } }',
    category_list: 'id data { name }',
    ledger_account: 'id data { name }',
    warehouse: 'id data { name code }',
    returnable_item_list: 'id data { name average_price stock_quantity }',
  },
  ledger: {
    customer: 'id data { name phone }',
    supplier: 'id data { name phone }',
    import: 'id data { invoice_no }',
    transaction_category: 'id data { name }',
    ledger_account: 'id data { name }',
    category_list: 'id data { name }',
  },
  import: {
    supplier: 'id data { name phone }',
    category_list: 'id data { name }',
    ledger_account: 'id data { name }',
    ledger_list:
      'id data { price_adjusted item_type payment_amount collectable_due giveable_due }',
    returnable_item_list: 'id data { name average_price stock_quantity }',
    production_run: 'id data { title }',
    warehouse: 'id data { name code }',
  },
  variant: {
    category: 'id data { name }',
    returnable_item: 'id data { name average_price stock_quantity }',
    ledger_account: 'id data { name }',
    stock: 'id data { current_stock auto_stock }',
  },
  category: {
    brand: 'id data { name }',
    returnable_item: 'id data { name average_price stock_quantity }',
    ledger_account: 'id data { name }',
    variant_list: 'id data { identifier }',
  },
  customer: {
    ledger_list:
      'id data { collectable_due giveable_due payment_amount transaction_amount date }',
  },
  supplier: {
    ledger_list:
      'id data { collectable_due giveable_due payment_amount transaction_amount date }',
  },
  brand: {
    ledger_account: 'id data { name }',
  },
  returnable_item: {
    ledger_account: 'id data { name }',
    stock: 'id data { current_stock auto_stock }',
  },
  production_run: {
    ledger_account: 'id data { name }',
    import: 'id data { invoice_no }',
    variant_list: 'id data { identifier }',
  },
  warranty: {
    category_list: 'id data { name }',
    ledger_account: 'id data { name }',
  },
  employee: {
    role: 'id data { name }',
  },
  stock: {
    variant: 'id data { identifier }',
    returnable_item: 'id data { name }',
    warehouse: 'id data { name code }',
  },
  stock_movement: {
    warehouse: 'id data { name code }',
    destination_warehouse: 'id data { name code }',
  },
  sales_return: {
    order:
      'id data { invoice_no date } customer { id data { name phone has_whatsapp address { full_address } } }',
  },
  purchase_return: {
    import: 'id data { invoice_no date }',
  },
};
