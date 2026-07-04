import {
  buildListRelationFilter,
  isRelationCrudFilter,
  listRelationFilterKey,
  relationEqFilter,
  relationEqFilterFromConnection,
  transformRelationFilters,
} from "../headless/filterVariables";
import { buildListConnectionScope } from "../headless/listConnectionFilters";

describe("list relation filters", () => {
  it("relationEqFilter builds explicit relation crud filter", () => {
    expect(relationEqFilter("class", "01CLASS")).toEqual({
      relation: "class",
      operator: "eq",
      value: "01CLASS",
    });
    expect(isRelationCrudFilter(relationEqFilter("class", "01CLASS"))).toBe(true);
  });

  it("buildListRelationFilter maps to GraphQL relation shape", () => {
    expect(buildListRelationFilter("class", "01CLASS")).toEqual({
      class: { _id: { eq: "01CLASS" } },
    });
  });

  it("listRelationFilterKey prefers known_as over target model (owner not users)", () => {
    expect(
      listRelationFilterKey({
        known_as: "owner",
        to_model: "users",
        relation_type: "has_one",
      }),
    ).toBe("owner");
  });

  it("listRelationFilterKey falls back to public relation field name from to_model", () => {
    expect(
      listRelationFilterKey({
        to_model: "food_category",
        relation_type: "has_one",
      }),
    ).toBe("foodCategory");
  });

  it("relationEqFilterFromConnection builds owner-scoped filter for user_profile", () => {
    expect(
      relationEqFilterFromConnection(
        {
          known_as: "owner",
          to_model: "users",
          relation_type: "has_one",
        },
        "01USER",
      ),
    ).toEqual({
      relation: "owner",
      operator: "eq",
      value: "01USER",
    });
    expect(
      buildListRelationFilter(
        listRelationFilterKey({
          known_as: "owner",
          to_model: "users",
          relation_type: "has_one",
        }),
        "01USER",
      ),
    ).toEqual({ owner: { _id: { eq: "01USER" } } });
  });

  it("transformRelationFilters splits relation and where field filters", () => {
    const result = transformRelationFilters([
      relationEqFilter("class", "01CLASS"),
      { field: "section_code", operator: "eq", value: "A" },
    ]);

    expect(result.filters).toEqual([
      { field: "section_code", operator: "eq", value: "A" },
    ]);
    expect(result.relation).toEqual({
      class: { _id: { eq: "01CLASS" } },
    });
  });

  it("merges multiple relation filters", () => {
    const result = transformRelationFilters([
      relationEqFilter("class", "01CLASS"),
      relationEqFilter("exam", "01EXAM"),
    ]);

    expect(result.filters).toEqual([]);
    expect(result.relation).toEqual({
      class: { _id: { eq: "01CLASS" } },
      exam: { _id: { eq: "01EXAM" } },
    });
  });
});

describe("list connection scope", () => {
  it("buildListConnectionScope is explicit parent-document scope only", () => {
    expect(buildListConnectionScope("01CLASS")).toEqual({
      _id: "01CLASS",
      connection_type: "forward",
      relation_type: "has_many",
    });
  });
});
