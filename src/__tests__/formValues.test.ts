import {
  apitoRecordToFormValues,
  buildConnectFromApitoRecord,
  isApitoDateString,
  normalizeApitoFormSaveInput,
  serializeApitoDateValue,
  serializeApitoPayloadValues,
} from "../headless/formValues";

describe("serializeApitoDateValue", () => {
  it("converts YYYY-MM-DD to ISO midnight UTC", () => {
    expect(serializeApitoDateValue("2026-06-16")).toBe(
      "2026-06-16T00:00:00.000Z",
    );
  });

  it("passes through full ISO strings", () => {
    expect(serializeApitoDateValue("2026-06-27T00:00:00Z")).toBe(
      "2026-06-27T00:00:00.000Z",
    );
  });

  it("detects apito date strings", () => {
    expect(isApitoDateString("2026-06-16")).toBe(true);
    expect(isApitoDateString("2026-06-16T12:00:00Z")).toBe(true);
    expect(isApitoDateString("teacher")).toBe(false);
  });
});

describe("serializeApitoPayloadValues", () => {
  it("serializes date fields in payload", () => {
    expect(
      serializeApitoPayloadValues({
        name: "Fatema",
        join_date: "2026-06-16",
      }),
    ).toEqual({
      name: "Fatema",
      join_date: "2026-06-16T00:00:00.000Z",
    });
  });
});

describe("apitoRecordToFormValues", () => {
  it("maps has_one and has_many relation nodes to connect ids", () => {
    expect(
      apitoRecordToFormValues({
        id: "01ORDER",
        data: { order_no: "O1" },
        customer: { id: "01CUST", data: { name: "Walk-In" } },
        class: { id: "01CLASS", data: { name: "Six" } },
        foodList: [
          { id: "01FOOD1", data: { name: "Sprite" } },
          { id: "01FOOD2", data: { name: "Biryani" } },
        ],
      }),
    ).toEqual({
      id: "01ORDER",
      data: { order_no: "O1" },
      connect: {
        customer_id: "01CUST",
        class_id: "01CLASS",
        food_ids: ["01FOOD1", "01FOOD2"],
      },
    });
  });

  it("buildConnectFromApitoRecord skips data/meta roots", () => {
    expect(
      buildConnectFromApitoRecord({
        id: "01",
        data: { name: "x" },
        meta: { status: true },
        waiter: { id: "01W", data: { full_name: "Waiter" } },
      }),
    ).toEqual({ waiter_id: "01W" });
  });

  it("maps camelCase has_one relations to snake_case connect keys", () => {
    expect(
      apitoRecordToFormValues({
        id: "01FOOD",
        data: { name: "Sprite" },
        foodCategory: { id: "01CAT", data: { name: "Beverage" } },
      }),
    ).toEqual({
      id: "01FOOD",
      data: { name: "Sprite" },
      connect: {
        food_category_id: "01CAT",
      },
    });
  });
});

describe("normalizeApitoFormSaveInput", () => {
  it("passes connect alongside payload", () => {
    expect(
      normalizeApitoFormSaveInput({
        payload: { name: "Demo", section_code: "B" },
        connect: { class_id: "01CLASS" },
      }),
    ).toEqual({
      payload: { name: "Demo", section_code: "B" },
      connect: { class_id: "01CLASS" },
      disconnect: undefined,
    });
  });

  it("flattens nested { id } connect values to plain document ids", () => {
    expect(
      normalizeApitoFormSaveInput({
        payload: { phone: "017" },
        connect: { owner_id: { id: "01USER" } },
      }),
    ).toEqual({
      payload: { phone: "017" },
      connect: { owner_id: "01USER" },
      disconnect: undefined,
    });
  });
});
