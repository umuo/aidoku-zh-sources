import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.baozimh1-v6.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);

test("包子漫画 1 使用完整封面选择器，并保留真实页面的元数据结构", () => {
  const html =
    '<meta name="og:image" content="https://static-tw.baozimh.com/cover/sample.jpg"><meta name="og:novel:read_url" content="https://www.baozimh.com/comic/sample"><meta name="og:novel:book_name" content="Sample"><meta name="og:novel:author" content="Author"><meta name="og:description" content="comic,sample,Summary"><meta name="og:novel:status" content="連載中">';
  const host = createHost(result.stdout, {
    transport(request) {
      return { status: 200, url: request.url, headers: { "content-type": "text/html" }, body: Buffer.from(html) };
    },
  });
  const details = host.call("get_manga_details", { id: "sample" });
  assert.equal(details.cover, "https://static-tw.baozimh.com/cover/sample.jpg");
  assert.equal(details.title, "Sample");
});

test("包子漫画 1 按零基页序拼接同章节分页，不跟随到下一章节", () => {
  const host = createHost(result.stdout, {
    transport(request) {
      const continuation = request.url.endsWith("/0_0_2.html");
      const next = continuation ? "0_1" : "0_0_2";
      const html = `<amp-img id="chapter-img-0" src="https://images.example/fcomic/${continuation ? 2 : 1}.jpg"></amp-img><a id="next-chapter" href="https://www.baozimh.com/comic/chapter/sample/${next}.html"></a>`;
      return { status: 200, url: request.url, headers: { "content-type": "text/html" }, body: Buffer.from(html) };
    },
  });
  const pages = host.call("get_page_list", { id: "0_0", mangaId: "sample" });
  assert.deepEqual(
    pages.map(({ index, url }) => ({ index, url })),
    [
      { index: 0, url: "https://images.example/scomic/1.jpg" },
      { index: 1, url: "https://images.example/scomic/2.jpg" },
    ],
  );
  assert.equal(host.requests.length, 2);
});
