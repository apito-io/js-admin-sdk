import {
  buildListRelationFilter,
  isRelationCrudFilter,
  relationEqFilter,
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
