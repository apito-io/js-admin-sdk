import {
  buildMutationConnectFromConnection,
  buildMutationConnectHasMany,
  buildMutationConnectHasOne,
  mutationConnectHasOneKey,
  normalizeApitoRelationConnectMap,
  normalizeApitoRelationConnectValue,
} from "../headless/mutationConnect";

describe("mutation connect", () => {
  it("mutationConnectHasOneKey prefers known_as (owner_id not users_id)", () => {
    expect(
      mutationConnectHasOneKey({
        known_as: "owner",
        to_model: "users",
        relation_type: "has_one",
      }),
    ).toBe("owner_id");
  });

  it("buildMutationConnectFromConnection matches upsertUserProfileList connect shape", () => {
    expect(
      buildMutationConnectFromConnection(
        {
          known_as: "owner",
          to_model: "users",
          relation_type: "has_one",
        },
        "01USER",
      ),
    ).toEqual({ owner_id: "01USER" });
  });

  it("buildMutationConnectHasOne uses stored model id key when no known_as", () => {
    expect(buildMutationConnectHasOne("users", "01USER")).toEqual({
      users_id: "01USER",
    });
    expect(buildMutationConnectHasOne("user", "01USER")).toEqual({
      user_id: "01USER",
    });
  });

  it("buildMutationConnectHasMany uses stored model ids key", () => {
    expect(buildMutationConnectHasMany("class", ["01A", "01B"])).toEqual({
      class_ids: ["01A", "01B"],
    });
  });

  it("normalizeApitoRelationConnectValue flattens nested id objects", () => {
    expect(normalizeApitoRelationConnectValue({ id: "01OWNER" })).toBe("01OWNER");
    expect(normalizeApitoRelationConnectValue("01OWNER")).toBe("01OWNER");
    expect(
      normalizeApitoRelationConnectValue([{ id: "01A" }, "01B"]),
    ).toEqual(["01A", "01B"]);
  });

  it("normalizeApitoRelationConnectMap drops empty values", () => {
    expect(
      normalizeApitoRelationConnectMap({
        owner_id: { id: "01USER" },
        class_id: "",
      }),
    ).toEqual({ owner_id: "01USER" });
  });
});
