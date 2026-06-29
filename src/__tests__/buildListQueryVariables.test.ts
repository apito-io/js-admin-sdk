import {
  buildListQueryVariables,
  relationEqFilter,
} from "../headless/filterVariables";
import {
  antdSorterToCrudSort,
  crudSortToAntdOrder,
  resolveSortField,
} from "../headless/tableSort";

describe("buildListQueryVariables", () => {
  it("merges relation, where, sort, and pagination", () => {
    const vars = buildListQueryVariables({
      resource: "student",
      filters: [
        relationEqFilter("class", "01CLASS"),
        { field: "section_code", operator: "eq", value: "A" },
      ],
      sorters: [{ field: "roll_no", order: "asc" }],
      pagination: { current: 2, pageSize: 25 },
    });

    expect(vars).toEqual({
      relation: { class: { _id: { eq: "01CLASS" } } },
      where: { section_code: { eq: "A" } },
      whereCount: { section_code: { eq: "A" } },
      sort: { roll_no: "asc" },
      page: 2,
      limit: 25,
    });
  });

  it("omits relation when supportsRelation is false", () => {
    const vars = buildListQueryVariables({
      resource: "student",
      filters: [relationEqFilter("class", "01CLASS")],
      supportsRelation: false,
    });

    expect(vars.relation).toBeUndefined();
    expect(vars.page).toBe(1);
    expect(vars.limit).toBe(10);
  });
});

describe("tableSort helpers", () => {
  it("antdSorterToCrudSort maps ascend/descend", () => {
    expect(antdSorterToCrudSort("roll_no", "ascend")).toEqual({
      field: "roll_no",
      order: "asc",
    });
    expect(antdSorterToCrudSort("roll_no", "descend")).toEqual({
      field: "roll_no",
      order: "desc",
    });
    expect(antdSorterToCrudSort("roll_no", null)).toBeNull();
  });

  it("resolveSortField uses map or last dataIndex segment", () => {
    expect(resolveSortField(["data", "roll_no"])).toBe("roll_no");
    expect(
      resolveSortField(["data", "roll_no"], { "data.roll_no": "roll_no" }),
    ).toBe("roll_no");
  });

  it("crudSortToAntdOrder maps back to antd order", () => {
    expect(
      crudSortToAntdOrder([{ field: "name", order: "desc" }], "name"),
    ).toBe("descend");
    expect(crudSortToAntdOrder([], "name")).toBeNull();
  });
});
