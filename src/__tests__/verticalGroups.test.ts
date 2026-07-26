import {
  blankVerticalAnchorFields,
  groupVerticalImportRows,
  isVerticalAnchorRow,
  isVerticalImportCellEditable,
  validateVerticalContinuationRows,
} from "../headless/importExport/verticalGroups";
import type { ApitoValidatedImportRow } from "../headless/importExport/types";

function row(
  index: number,
  data: Record<string, string>,
): ApitoValidatedImportRow {
  return {
    _rowIndex: index,
    _errors: [],
    _isValid: true,
    _operation: "create",
    ...data,
  };
}

describe("verticalGroups", () => {
  const anchor = ["_id", "name", "code", "subject_codes", "divisions"];

  test("isVerticalAnchorRow", () => {
    expect(isVerticalAnchorRow({ name: "A", code: "" }, ["name", "code"])).toBe(
      true,
    );
    expect(isVerticalAnchorRow({ name: "", code: "" }, ["name", "code"])).toBe(
      false,
    );
  });

  test("blankVerticalAnchorFields clears non-anchor rows", () => {
    const full = {
      _id: "1",
      name: "Class",
      code: "C",
      section_code: "A",
    };
    expect(blankVerticalAnchorFields(full, ["_id", "name", "code"], true)).toEqual(
      full,
    );
    expect(
      blankVerticalAnchorFields(full, ["_id", "name", "code"], false),
    ).toEqual({
      _id: "",
      name: "",
      code: "",
      section_code: "A",
    });
  });

  test("validateVerticalContinuationRows rejects filled continuation identity", () => {
    const rows = [
      row(0, {
        _id: "1",
        name: "Class",
        code: "C",
        subject_codes: "",
        divisions: "",
        section_code: "A",
      }),
      row(1, {
        _id: "",
        name: "DUP",
        code: "",
        subject_codes: "",
        divisions: "",
        section_code: "B",
      }),
    ];
    // Second row has name filled → treated as new anchor missing code
    const out = validateVerticalContinuationRows(rows, {
      anchorColumns: anchor,
      requiredOnAnchor: ["name", "code"],
      requiredEveryRow: ["section_code"],
    });
    expect(out[1]._isValid).toBe(false);
    expect(out[1]._errors.some((e) => e.field === "code")).toBe(true);
  });

  test("validateVerticalContinuationRows accepts blank continuation", () => {
    const rows = [
      row(0, {
        _id: "1",
        name: "Class",
        code: "C",
        subject_codes: "101",
        divisions: "",
        section_code: "A",
      }),
      row(1, {
        _id: "",
        name: "",
        code: "",
        subject_codes: "",
        divisions: "",
        section_code: "B",
      }),
    ];
    const out = validateVerticalContinuationRows(rows, {
      anchorColumns: anchor,
      requiredOnAnchor: ["name", "code"],
      requiredEveryRow: ["section_code"],
    });
    expect(out.every((r) => r._isValid)).toBe(true);
  });

  test("validateVerticalContinuationRows accepts mid-level division start", () => {
    const rows = [
      row(0, {
        _id: "1",
        name: "C11",
        code: "C11",
        subject_codes: "",
        division_name: "SCIENCE",
        division_subject_codes: "101,102",
        division_practical_subject_codes: "",
        section_code: "A",
      }),
      row(1, {
        _id: "",
        name: "",
        code: "",
        subject_codes: "",
        division_name: "",
        division_subject_codes: "",
        division_practical_subject_codes: "",
        section_code: "B",
      }),
      row(2, {
        _id: "",
        name: "",
        code: "",
        subject_codes: "",
        division_name: "ARTS",
        division_subject_codes: "101,108",
        division_practical_subject_codes: "",
        section_code: "D",
      }),
    ];
    const out = validateVerticalContinuationRows(rows, {
      anchorColumns: ["_id", "name", "code", "subject_codes"],
      midLevelColumns: [
        "division_name",
        "division_subject_codes",
        "division_practical_subject_codes",
      ],
      requiredOnAnchor: ["name", "code"],
      requiredOnMid: ["division_name"],
      requiredEveryRow: ["section_code"],
    });
    expect(out.every((r) => r._isValid)).toBe(true);
  });

  test("validateVerticalContinuationRows inherits update operation on continuations", () => {
    const rows = [
      row(0, {
        _id: "1",
        name: "C11",
        code: "C11",
        subject_codes: "",
        division_name: "SCIENCE",
        division_subject_codes: "101",
        division_practical_subject_codes: "",
        section_code: "A",
      }),
      row(1, {
        _id: "",
        name: "",
        code: "",
        subject_codes: "",
        division_name: "",
        division_subject_codes: "",
        division_practical_subject_codes: "",
        section_code: "B",
      }),
      row(2, {
        _id: "",
        name: "",
        code: "",
        subject_codes: "",
        division_name: "ARTS",
        division_subject_codes: "108",
        division_practical_subject_codes: "",
        section_code: "D",
      }),
    ];
    rows[0]._operation = "update";
    rows[1]._operation = "create";
    rows[2]._operation = "create";

    const out = validateVerticalContinuationRows(rows, {
      anchorColumns: ["_id", "name", "code", "subject_codes"],
      midLevelColumns: [
        "division_name",
        "division_subject_codes",
        "division_practical_subject_codes",
      ],
      requiredOnAnchor: ["name", "code"],
      requiredOnMid: ["division_name"],
      requiredEveryRow: ["section_code"],
    });
    expect(out.every((r) => r._isValid)).toBe(true);
    expect(out.map((r) => r._operation)).toEqual([
      "update",
      "update",
      "update",
    ]);
  });

  test("isVerticalImportCellEditable disables blanked identity cells", () => {
    const opts = {
      anchorColumns: ["_id", "name", "code", "subject_codes"],
      midLevelColumns: [
        "division_name",
        "division_subject_codes",
        "division_practical_subject_codes",
      ],
    };
    const parent = {
      _id: "1",
      name: "C11",
      code: "C11",
      subject_codes: "",
      division_name: "SCIENCE",
      division_subject_codes: "101",
      section_code: "A",
    };
    const continuation = {
      _id: "",
      name: "",
      code: "",
      subject_codes: "",
      division_name: "",
      division_subject_codes: "",
      section_code: "B",
    };
    const midStart = {
      _id: "",
      name: "",
      code: "",
      subject_codes: "",
      division_name: "ARTS",
      division_subject_codes: "108",
      section_code: "D",
    };

    expect(isVerticalImportCellEditable(parent, "name", opts)).toBe(true);
    expect(isVerticalImportCellEditable(parent, "division_name", opts)).toBe(
      true,
    );
    expect(isVerticalImportCellEditable(parent, "section_code", opts)).toBe(
      true,
    );

    expect(isVerticalImportCellEditable(continuation, "name", opts)).toBe(
      false,
    );
    expect(
      isVerticalImportCellEditable(continuation, "division_name", opts),
    ).toBe(false);
    expect(
      isVerticalImportCellEditable(continuation, "section_code", opts),
    ).toBe(true);

    expect(isVerticalImportCellEditable(midStart, "name", opts)).toBe(false);
    expect(isVerticalImportCellEditable(midStart, "division_name", opts)).toBe(
      true,
    );
    expect(isVerticalImportCellEditable(midStart, "section_code", opts)).toBe(
      true,
    );
  });

  test("groupVerticalImportRows sequential", () => {
    const rows = [
      row(0, { name: "A", code: "a", section_code: "1" }),
      row(1, { name: "", code: "", section_code: "2" }),
      row(2, { name: "B", code: "b", section_code: "1" }),
    ];
    const groups = groupVerticalImportRows(rows, ["name", "code"]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });
});
