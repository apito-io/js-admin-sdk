import {
  acceptAllowsOnlyImages,
  fileMatchesAccept,
  inferMediaFileKind,
  isPdfMediaUrl,
  resolveMediaAccept,
} from "../headless/mediaUpload/mediaAccept";

describe("mediaAccept", () => {
  it("resolves image-only accept by default", () => {
    expect(resolveMediaAccept({})).toBe("image/*");
    expect(acceptAllowsOnlyImages("image/*")).toBe(true);
  });

  it("resolves mixed kinds", () => {
    const accept = resolveMediaAccept({ kinds: ["image", "pdf"] });
    expect(accept).toContain("image/*");
    expect(accept).toContain("application/pdf");
    expect(acceptAllowsOnlyImages(accept)).toBe(false);
  });

  it("matches files against accept", () => {
    expect(fileMatchesAccept(new File(["x"], "a.pdf", { type: "application/pdf" }), "application/pdf,.pdf")).toBe(true);
    expect(fileMatchesAccept(new File(["x"], "a.png", { type: "image/png" }), "image/*")).toBe(true);
    expect(fileMatchesAccept(new File(["x"], "a.pdf", { type: "application/pdf" }), "image/*")).toBe(false);
  });

  it("detects pdf urls", () => {
    expect(isPdfMediaUrl("https://cdn.example.com/docs/report.pdf")).toBe(true);
    expect(inferMediaFileKind(new File(["x"], "scan.PDF", { type: "application/pdf" }))).toBe("pdf");
  });
});
