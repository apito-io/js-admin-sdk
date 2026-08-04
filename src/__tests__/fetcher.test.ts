import {
  createBearerApitoFetcher,
  hasUsableGraphQLData,
} from "../headless/fetcher";
import { GraphQLError as ApitoGraphQLError } from "../types";

describe("hasUsableGraphQLData", () => {
  it("is false for null data and all-null mutation roots", () => {
    expect(hasUsableGraphQLData(null)).toBe(false);
    expect(hasUsableGraphQLData(undefined)).toBe(false);
    expect(hasUsableGraphQLData({ createImport: null })).toBe(false);
  });

  it("is true when any top-level field is non-null", () => {
    expect(hasUsableGraphQLData({ createImport: { id: "1" } })).toBe(true);
    expect(
      hasUsableGraphQLData({
        getProduct: { id: "1" },
        brokenNest: null,
      }),
    ).toBe(true);
  });
});

describe("createBearerApitoFetcher", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws on HTTP 200 mutation failure with null root + errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        data: { createImport: null },
        errors: [
          {
            message: "invalid dropdown value plate for import_measurement_unit",
            path: ["createImport"],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const fetcher = createBearerApitoFetcher({
      graphqlUrl: "http://localhost/graphql",
      token: "apt_test",
    });

    await expect(fetcher("mutation { createImport { id } }")).rejects.toEqual(
      expect.objectContaining({
        name: "GraphQLError",
        message: "invalid dropdown value plate for import_measurement_unit",
      }),
    );

    try {
      await fetcher("mutation { createImport { id } }");
    } catch (error) {
      expect(error).toBeInstanceOf(ApitoGraphQLError);
      expect((error as ApitoGraphQLError).graphQLErrors).toHaveLength(1);
    }
  });

  it("returns partial query data when a root field is present with errors", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        data: { getProduct: { id: "p1", name: "Rice" } },
        errors: [{ message: "nested field failed", path: ["getProduct", "tags"] }],
      }),
    }) as unknown as typeof fetch;

    const fetcher = createBearerApitoFetcher({
      graphqlUrl: "http://localhost/graphql",
      token: "apt_test",
    });

    await expect(fetcher("query { getProduct { id } }")).resolves.toEqual({
      data: { getProduct: { id: "p1", name: "Rice" } },
      errors: [{ message: "nested field failed", path: ["getProduct", "tags"] }],
    });
  });
});
