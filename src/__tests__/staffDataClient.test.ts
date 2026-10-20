import {
  ApitoStaffDataClient,
  createVerifiedStaffApitoFetcher,
  type ApitoResourceRegistry,
} from "../index";

const registry: ApitoResourceRegistry = {
  getListDocument: () =>
    "query OrderList($page: Int, $limit: Int) { orderList { id data { name } } orderListCount }",
  getOneDocument: () =>
    "query Order($id: String!) { order(id: $id) { id data { name } } }",
  getCreateDocument: () =>
    "mutation CreateOrder($payload: JSON!) { createOrder(payload: $payload) { id data { name } } }",
  getUpdateDocument: () =>
    "mutation UpdateOrder($id: String!, $payload: JSON!) { updateOrder(id: $id, payload: $payload) { id data { name } } }",
  getDeleteDocument: () =>
    "mutation DeleteOrder($ids: [String!]!) { deleteOrder(ids: $ids) }",
  getListKey: () => "orderList",
  getCountKey: () => "orderListCount",
  getOneKey: () => "order",
};

describe("verified staff data client", () => {
  it("always sends a project-user bearer and verified tenant scope", async () => {
    let request: Request | undefined;
    const fetcher = createVerifiedStaffApitoFetcher({
      graphqlUrl: "https://engine.example/secured/graphql",
      bearerToken: "ak_project_user_session",
      projectId: "project-1",
      tenantId: "tenant-1",
      fetcher: async (input, init) => {
        request = new Request(input, init);
        return Response.json({ data: { orderList: [], orderListCount: 0 } });
      },
    });

    await fetcher("query Orders { orderList { id } }");

    expect(request).toBeDefined();
    expect(request?.headers.get("Authorization")).toBe(
      "Bearer ak_project_user_session",
    );
    expect(request?.headers.get("X-Apito-Key")).toBeNull();
    expect(request?.headers.get("X-Use-Cookies")).toBe("false");
    expect(request?.headers.get("X-Apito-Project-Id")).toBe("project-1");
    expect(request?.headers.get("X-Apito-Tenant-ID")).toBe("tenant-1");
  });

  it("rejects operator credentials before they can reach secured GraphQL", () => {
    expect(() =>
      createVerifiedStaffApitoFetcher({
        graphqlUrl: "https://engine.example/secured/graphql",
        bearerToken: "apt_operator_secret",
        projectId: "project-1",
        tenantId: "tenant-1",
        fetcher: async () => Response.json({ data: {} }),
      }),
    ).toThrow(/rejects operator/);
  });

  it("uses generated secured documents for CRUD and propagates GraphQL errors", async () => {
    const requests: Array<{ query: string; variables: Record<string, unknown> }> =
      [];
    const client = new ApitoStaffDataClient({
      graphqlUrl: "https://engine.example/secured/graphql",
      bearerToken: "project-user-session",
      projectId: "project-1",
      tenantId: "tenant-1",
      registry,
      fetcher: async (input, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          query: string;
          variables: Record<string, unknown>;
        };
        requests.push(body);
        if (body.query.includes("OrderList")) {
          return Response.json({
            data: {
              orderList: [{ id: "order-1", data: { name: "First" } }],
              orderListCount: 1,
            },
          });
        }
        if (body.query.includes("CreateOrder")) {
          return Response.json({
            data: {
              createOrder: { id: "order-2", data: { name: "Created" } },
            },
          });
        }
        if (body.query.includes("UpdateOrder")) {
          return Response.json({
            data: {
              updateOrder: { id: "order-2", data: { name: "Updated" } },
            },
          });
        }
        if (body.query.includes("DeleteOrder")) {
          return Response.json({ data: { deleteOrder: true } });
        }
        return Response.json({
          data: { order: { id: "order-1", data: { name: "First" } } },
        });
      },
    });

    await expect(
      client.searchResources("order", { where: { status: { eq: "open" } } }),
    ).resolves.toMatchObject({
      count: 1,
      results: [{ id: "order-1" }],
    });
    await expect(
      client.getSingleResource("order", "order-1"),
    ).resolves.toMatchObject({ id: "order-1" });
    await expect(
      client.createNewResource({
        model: "order",
        payload: { name: "Created" },
      }),
    ).resolves.toMatchObject({ id: "order-2" });
    await expect(
      client.updateResource({
        model: "order",
        id: "order-2",
        payload: { name: "Updated" },
      }),
    ).resolves.toMatchObject({ id: "order-2" });
    await expect(client.deleteResource("order", "order-2")).resolves.toBeUndefined();

    expect(requests).toHaveLength(5);
    expect(requests[0].variables).toMatchObject({
      where: { status: { eq: "open" } },
    });
  });

  it("does not turn a denied secured operation into a system retry", async () => {
    const client = new ApitoStaffDataClient({
      graphqlUrl: "https://engine.example/secured/graphql",
      bearerToken: "project-user-session",
      projectId: "project-1",
      tenantId: "tenant-1",
      registry,
      fetcher: async () =>
        Response.json({
          data: { order: null },
          errors: [{ message: "CAPABILITY_DENIED: database.read" }],
        }),
    });

    await expect(client.getSingleResource("order", "order-1")).rejects.toThrow(
      /CAPABILITY_DENIED/,
    );
  });
});
