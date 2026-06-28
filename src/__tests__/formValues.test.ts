import {
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
});
