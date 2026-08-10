import { describe, expect, it } from "@jest/globals";
import {
  atLeast,
  buildCasbinPolicyFromSnapshot,
  canFromSnapshot,
  graceModelsFromSnapshot,
  isPlanQuotaError,
  parsePlanTier,
  annotateMenuItemsByPlan,
} from "../access";

describe("access plan tiers", () => {
  it("parses aliases and ranks", () => {
    expect(parsePlanTier("paid+")).toBe("paid_plus");
    expect(atLeast("paid", "free")).toBe(true);
    expect(atLeast("free", "paid")).toBe(false);
  });
});

describe("access permissions", () => {
  const snap = {
    role_id: "manager",
    plan_clamped: true,
    api_permissions: {
      student: { read: "all", create: "all", update: "all", delete: "none" },
      staff: { read: "all", create: "none", update: "none", delete: "none" },
    },
  };

  it("canFromSnapshot maps refine actions", () => {
    expect(canFromSnapshot(snap, "student", "list")).toBe(true);
    expect(canFromSnapshot(snap, "staff", "create")).toBe(false);
  });

  it("builds casbin csv with extras", () => {
    const csv = buildCasbinPolicyFromSnapshot(snap, {
      extraListResources: ["students_menu"],
    });
    expect(csv).toContain("p, manager, student, list");
    expect(csv).toContain("p, manager, students_menu, list");
    expect(csv).not.toContain("p, manager, staff, create");
  });

  it("graceModelsFromSnapshot", () => {
    expect(
      graceModelsFromSnapshot({
        api_permissions: { ledger: { read: "all", grace: true } },
      }),
    ).toEqual(["ledger"]);
  });
});

describe("quota + menu", () => {
  it("detects plan quota errors", () => {
    expect(isPlanQuotaError("plan quota exceeded: max_records.student")).toBe(
      true,
    );
  });

  it("annotates locked menu items", () => {
    const out = annotateMenuItemsByPlan(
      [{ name: "staff", key: "staff", list: "/staff" }],
      "free",
      [{ name: "staff", meta: { minPlan: "paid" } }],
    );
    expect(out[0].meta?.planLocked).toBe(true);
  });
});
