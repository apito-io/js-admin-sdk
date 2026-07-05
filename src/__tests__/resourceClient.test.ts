import { createApitoResourceClient } from "../headless/resourceClient";
import type { ApitoResourceRegistry } from "../headless/resourceClient";
import type { ApitoFetcher } from "../headless/fetcher";

const registry: ApitoResourceRegistry = {
  getListDocument: () => "query List { items { data { id } } }",
  getOneDocument: () => "query One($id: String!) { item(id: $id) { data { id } } }",
  getCreateDocument: () =>
    "mutation Create($payload: JSON!) { createItem(payload: $payload) { data { id } } }",
  getUpdateDocument: () =>
    "mutation Update($id: String!, $payload: JSON!) { updateItem(id: $id, payload: $payload) { data { id } } }",
  getDeleteDocument: () => "mutation Delete($ids: [String!]!) { deleteItem(ids: $ids) }",
  getListKey: () => "itemList",
  getCountKey: () => "itemListCount",
  getOneKey: () => "item",
  supportsConnection: () => true,
};

describe("createApitoResourceClient", () => {
  it("getList returns data and total from connection shape", async () => {
    const fetcher: ApitoFetcher = async () => ({
      data: {
        itemList: [{ id: "1", data: { name: "A" } }],
        itemListCount: 1,
      },
    });

    const client = createApitoResourceClient(fetcher, registry);
    const result = await client.getList({ resource: "item" });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("listAllPages walks pages until total is reached", async () => {
    let page = 0;
    const fetcher: ApitoFetcher = async () => {
      page += 1;
      if (page === 1) {
        return {
          data: {
            itemList: [{ id: "1" }, { id: "2" }],
            itemListCount: 3,
          },
        };
      }
      return {
        data: {
          itemList: [{ id: "3" }],
          itemListCount: 3,
        },
      };
    };

    const client = createApitoResourceClient(fetcher, registry);
    const rows = await client.listAllPages({
      resource: "item",
      pageSize: 2,
    });

    expect(rows).toHaveLength(3);
  });
});
