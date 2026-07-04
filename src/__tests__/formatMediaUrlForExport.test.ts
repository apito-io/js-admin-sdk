import {
  extractMediaUrlFromValue,
  formatMediaUrlForExport,
  isHttpMediaUrl,
} from "../headless/mediaUpload/formatMediaUrlForExport";
import { buildExportRows, mapRecordToExportRowDefault } from "../headless/importExport/exporter";
import type { ApitoImportColumn } from "../headless/importExport/types";

describe("formatMediaUrlForExport", () => {
  it("exports extensionless CDN urls", () => {
    const url =
      "https://cdn.rosna.live/rosna_v2_jpn6o/media/01KS4SFEX7BVH7FP09FYASAPF9";
    expect(formatMediaUrlForExport({ url })).toBe(url);
    expect(isHttpMediaUrl(url)).toBe(true);
  });

  it("exports plain https url strings", () => {
    const url = "https://cdn.example.com/food.png";
    expect(formatMediaUrlForExport(url)).toBe(url);
    expect(extractMediaUrlFromValue(url)).toBe(url);
  });

  it("never exports data urls or raw base64 blobs", () => {
    const dataUrl = "data:image/jpeg;base64,QUJDREVGRw==";
    const rawBase64 = "A".repeat(600);
    expect(formatMediaUrlForExport(dataUrl)).toBe("");
    expect(formatMediaUrlForExport({ url: dataUrl })).toBe("");
    expect(formatMediaUrlForExport(rawBase64)).toBe("");
  });

  it("reads url from media object shapes and arrays", () => {
    expect(
      formatMediaUrlForExport({
        file_name: "food.jpg",
        id: "01KS4SFEX7BVH7FP09FYASAPF9",
        url: "https://cdn.example.com/media/01KS4SFEX7BVH7FP09FYASAPF9",
      }),
    ).toBe("https://cdn.example.com/media/01KS4SFEX7BVH7FP09FYASAPF9");

    expect(
      formatMediaUrlForExport([
        { url: "https://cdn.example.com/a.png" },
        { url: "data:image/png;base64,abc" },
      ]),
    ).toBe("https://cdn.example.com/a.png");
  });
});

describe("mapRecordToExportRowDefault media columns", () => {
  const columns: ApitoImportColumn[] = [
    { id: "_id", label: "Record ID", isId: true },
    { id: "category_name", label: "Name" },
    { id: "image_url", label: "Image URL", type: "media" },
  ];

  it("maps image_url column from nested image field", () => {
    const row = mapRecordToExportRowDefault(
      {
        id: "cat_1",
        data: {
          name: "Fast",
          image: {
            url: "https://cdn.rosna.live/rosna_v2_jpn6o/media/01KS4SFEX7BVH7FP09FYASAPF9",
          },
        },
      },
      columns,
    );

    expect(row.image_url).toBe(
      "https://cdn.rosna.live/rosna_v2_jpn6o/media/01KS4SFEX7BVH7FP09FYASAPF9",
    );
  });

  it("buildExportRows strips inline image content from custom mappers", () => {
    const rows = buildExportRows(
      [
        {
          id: "food_1",
          data: {
            image: {
              url: "data:image/jpeg;base64,QUJDREVGRw==",
            },
          },
        },
      ],
      {
        resource: "food",
        columns: [{ id: "image_url", label: "Image URL", type: "media" }],
        mapRecordToRow: (record) => ({
          image_url: (record.data as { image?: { url?: string } }).image,
        }),
      },
    );

    expect(rows[0]?.image_url).toBe("");
  });
});
