import { buildSchema, parse, validate } from "graphql";

describe("codegen document validation contract", () => {
  const schema = buildSchema(`
    type Query {
      foodOrder(_id: String!): FoodOrder
    }
    type FoodOrder {
      id: ID
      food_list: [Food]
    }
    type Food {
      id: ID
      data: FoodData
    }
    type FoodData {
      name: String
      price: Float
    }
  `);

  it("rejects invalid nested selections on connections", () => {
    const doc = parse(`
      query GetFoodOrder {
        foodOrder(_id: "1") {
          food_list {
            test_label_list { id }
          }
        }
      }
    `);
    const errors = validate(schema, doc);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toMatch(/test_label_list/);
  });

  it("accepts valid connection selections", () => {
    const doc = parse(`
      query GetFoodOrder {
        foodOrder(_id: "1") {
          food_list {
            id
            data { name price }
          }
        }
      }
    `);
    expect(validate(schema, doc)).toEqual([]);
  });
});
