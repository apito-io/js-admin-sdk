import {
  buildApitoCompatOneResult,
  getSavedRecordId,
  getSavedRecordNode,
} from "../headless/recordCompat";

describe("buildApitoCompatOneResult", () => {
  it("wraps record in Refine-compatible query.data.data", () => {
    const record = { id: "01A", data: { name: "Demo" } };
    const result = buildApitoCompatOneResult(record, { isLoading: false });

    expect(result.data).toEqual(record);
    expect(result.query.data?.data).toEqual(record);
    expect(result.query.isLoading).toBe(false);
  });
});

describe("getSavedRecordId", () => {
  it("reads createFoodOrder id from mutation payload", () => {
    expect(
      getSavedRecordId(
        {
          createFoodOrder: { id: "01ORDER", data: { order_no: "O1" } },
        },
        "foodOrder",
      ),
    ).toBe("01ORDER");
  });

  it("reads nested data envelope", () => {
    expect(
      getSavedRecordNode(
        {
          data: {
            updateStudent: { id: "01STU", data: { name: "Ali" } },
          },
        },
        "student",
      )?.id,
    ).toBe("01STU");
  });
});
