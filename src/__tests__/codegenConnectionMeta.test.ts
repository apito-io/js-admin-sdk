import { formatApitoConnectionSubselections } from '../naming/apitoGraphqlNames';
import { buildConnectionMetaTypes } from '../../scripts/codegen-meta';

describe('buildConnectionMetaTypes', () => {
  it('emits relation types and list meta for foodOrder-style connections', () => {
    const model = {
      name: 'foodOrder',
      fields: ['order_no', 'total_amount'],
      connectionFields: {
        foodList: 'id data { name price sizes { size price } }',
        customer: 'id data { name phone age gender }',
        location: 'id data { name type }',
      },
    };

    const { relationTypeLines, relationFieldLines, metaExports } =
      buildConnectionMetaTypes(model);

    expect(relationTypeLines).toContain('export type FoodListRelation');
    expect(relationTypeLines).toContain('GetFoodOrderQuery["foodOrder"]');
    expect(relationFieldLines).toContain('foodList?: FoodListRelation');
    expect(relationFieldLines).toContain('customer?: CustomerRelation');
    expect(metaExports).toContain('foodOrderConnectionFields');
    expect(metaExports).toContain('foodOrderListMeta');
  });
});

describe('formatApitoConnectionSubselections (foodOrder fixture)', () => {
  it('renders has_many and has_one relation blocks for list/one documents', () => {
    const block = formatApitoConnectionSubselections({
      foodList: 'id data { name price sizes { size price } }',
      customer: 'id data { name phone age gender }',
      chef: 'id data { full_name degrees }',
      waiter: 'id data { full_name }',
      location: 'id data { name type }',
    });

    expect(block).toContain('foodList { id data { name price sizes { size price } } }');
    expect(block).toContain('customer { id data { name phone age gender } }');
    expect(block).toContain('chef { id data { full_name degrees } }');
    expect(block).toContain('waiter { id data { full_name } }');
    expect(block).toContain('location { id data { name type } }');
  });
});
