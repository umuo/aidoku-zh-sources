import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.18mh-v1.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);
const documents = {
  "/manga/page/1":
    '<div class="pb-2"><a href="/manga/sample"><div><img src="https://images.example/cover.png"><h3>Sample</h3></div></a></div>',
  "/manga/sample":
    '<title>Sample-18漫畫</title><meta property="og:image" content="https://images.example/cover.png"><div id="mangachapters" data-mid="5"></div>',
  "/manga/get":
    '<div id="allchapterlist"><div class="chapteritem"><a data-cs="101" href="manga/sample/first"><div><span>First chapter</span></div></a></div></div>',
  "/chapter/getcontent": '<div id="chapcontent"><div><img data-src="https://images.example/page.png"></div></div>',
};

test("模拟宿主执行真实旧版插件的 HTML 列表、详情、章节和图片解析", () => {
  const host = createHost(result.stdout, {
    transport(request) {
      const url = new URL(request.url);
      assert.ok(documents[url.pathname], `Unexpected URL: ${request.url}`);
      return {
        status: 200,
        url: request.url,
        headers: { "content-type": "text/html" },
        body: Buffer.from(documents[url.pathname]),
      };
    },
  });
  const list = host.call("get_manga_list", []);
  assert.equal(list.manga.length, 1);
  assert.equal(list.manga[0].id, "sample");
  const details = host.call("get_manga_details", list.manga[0]);
  assert.equal(details.id, "sample/5");
  assert.equal(details.title, "Sample");
  const chapters = host.call("get_chapter_list", details);
  assert.equal(chapters[0].id, "101");
  const pages = host.call("get_page_list", { ...chapters[0], mangaId: details.id });
  assert.equal(pages[0].url, "https://images.example/page.png");
  assert.equal(host.requests.length, 4);
});

test("宿主保留 HTTP 失败状态供插件处理，检查器不能把空列表误报为可用", () => {
  const host = createHost(result.stdout, {
    transport(request) {
      return {
        status: 403,
        url: request.url,
        headers: { "cf-mitigated": "challenge" },
        body: Buffer.from("challenge"),
      };
    },
  });
  assert.equal(host.call("get_manga_list", []).manga.length, 0);
  assert.equal(host.requests[0].status, 403);
  assert.equal(host.requests[0].challenge, "challenge");
});
