import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.ho5ho-v2.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);
function hostFor(body) {
  return createHost(result.stdout, {
    transport(request) {
      return { status: 200, url: request.url, headers: {}, body: Buffer.from(body) };
    },
  });
}
test("HO5HO 新卡片与原卡片均可解析标识、标题和封面", () => {
  for (const body of [
    '<article class="ho5ho-v2-card"><a class="ho5ho-v2-card-cover" href="https://www.ho5ho.com/category/sample/" aria-label="Sample"><img src="https://example.org/cover.webp"></a></article>',
    '<div class="c-image-hover"><a href="https://www.ho5ho.com/category/sample/" title="Sample"><img data-src="https://example.org/cover.webp"></a></div>',
  ]) {
    const list = hostFor(body).call("get_manga_list", []);
    assert.equal(list.manga[0].id, "sample");
    assert.equal(list.manga[0].title, "Sample");
    assert.equal(list.manga[0].cover, "https://example.org/cover.webp");
  }
});
test("HO5HO 新详情使用页面元信息和新简介区", () => {
  const host = hostFor(
    '<meta property="og:title" content="Sample"><meta property="og:image" content="https://example.org/cover.webp"><section class="ho5ho-v3-story"><p>Synopsis</p></section>',
  );
  const detail = host.call("get_manga_details", { id: "sample" });
  assert.equal(detail.title, "Sample");
  assert.equal(detail.cover, "https://example.org/cover.webp");
  assert.equal(detail.description, "Synopsis");
});
test("HO5HO 章节和预加载图片继续保持零基页序与 Referer", () => {
  const chapters = hostFor(
    '<li class="wp-manga-chapter"><a href="https://www.ho5ho.com/category/sample/one/">Chapter 1</a></li>',
  ).call("get_chapter_list", { id: "sample" });
  assert.equal(chapters[0].id, "one");
  const host = hostFor(
    '<script>var chapter_preloaded_images = ["https://example.org/1.webp","https://example.org/2.webp"], chapter_images_per_page = 3;</script>',
  );
  const pages = host.call("get_page_list", { id: "one", mangaId: "sample" });
  assert.deepEqual(
    pages.map(({ index, url }) => ({ index, url })),
    [
      { index: 0, url: "https://example.org/1.webp" },
      { index: 1, url: "https://example.org/2.webp" },
    ],
  );
  assert.equal(host.imageRequest(pages[0].url).headers.Referer, "https://www.ho5ho.com");
});
