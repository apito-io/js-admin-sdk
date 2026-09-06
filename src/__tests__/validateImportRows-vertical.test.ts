import { validateImportRows } from "../headless/importExport/validation";
import { validateVerticalContinuationRows } from "../headless/importExport/verticalGroups";
import type { ApitoImportConfig } from "../headless/importExport/types";

describe("validateImportRows vertical groups", () => {
  const config: ApitoImportConfig = {
    resource: "lab_test",
    columns: [
      { id: "_id", label: "Record ID", isId: true },
      { id: "name", label: "Name", required: true },
      { id: "short_code", label: "Short Code", required: true },
      { id: "price", label: "Price", required: true, type: "number" },
      { id: "sample_type", label: "Sample Type", required: true },
      { id: "label", label: "Label" },
      { id: "accessory", label: "Accessory" },
    ],
    idColumn: "_id",
    verticalGroups: {
      anchorColumns: ["_id", "name", "short_code", "price", "sample_type"],
    },
    validateAllRows: (rows) =>
      validateVerticalContinuationRows(rows, {
        anchorColumns: ["_id", "name", "short_code", "price", "sample_type"],
        requiredOnAnchor: ["name", "short_code", "price", "sample_type"],
      }),
  };

  it("accepts blank identity on flattened continuation rows", () => {
    const result = validateImportRows(
      [
        {
          _id: "",
          name: "Complete B",
          short_code: "CBC051412",
          price: "850",
          sample_type: "blood",
          label: "RBC",
          accessory: "Test Tube",
        },
        {
          _id: "",
          name: "",
          short_code: "",
          price: "",
          sample_type: "",
          label: "WBC",
          accessory: "Syrenge",
        },
        {
          _id: "",
          name: "",
          short_code: "",
          price: "",
          sample_type: "",
          label: "PLATLET",
          accessory: "Butter Fly Kit",
        },
      ],
      config,
    );

    expect(result.errorCount).toBe(0);
    expect(result.validCount).toBe(3);
    expect(result.rows.every((row) => row._isValid)).toBe(true);
    expect(result.rows[1]?._errors).toEqual([]);
    expect(result.rows[2]?._errors).toEqual([]);
  });

  it("still requires identity on the first row of a group", () => {
    const result = validateImportRows(
      [
        {
          _id: "",
          name: "CBC",
          short_code: "",
          price: "",
          sample_type: "",
          label: "RBC",
          accessory: "",
        },
      ],
      config,
    );

    expect(result.errorCount).toBe(1);
    const fields = result.rows[0]?._errors.map((error) => error.field) ?? [];
    expect(fields).toEqual(
      expect.arrayContaining(["short_code", "price", "sample_type"]),
    );
    expect(fields).not.toContain("name");
  });
});
