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

test("宿主按页面声明识别 Big5，避免将编码差异误判为图源故障", () => {
  const body = Buffer.concat([
    Buffer.from('<meta charset="big5"><div class="pb-2"><a href="/manga/sample"><div><img src="cover.png"><h3>'),
    Buffer.from("a4a4a4e5", "hex"),
    Buffer.from("</h3></div></a></div>"),
  ]);
  const host = createHost(result.stdout, {
    transport(request) {
      return { status: 200, url: request.url, headers: { "content-type": "text/html" }, body };
    },
  });
  assert.equal(host.call("get_manga_list", []).manga[0].title, "中文");
});

test("日期 ABI 为实际哔咔插件生成秒级签名时间，测试不发起登录或真实网络", () => {
  const archive = spawnSync("python3", [
    "-c",
    'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.manhuabika-v1.aix").read("Payload/main.wasm"))',
  ]);
  assert.equal(archive.status, 0);
  const now = Math.floor(Date.now() / 1000);
  const host = createHost(archive.stdout, {
    defaults: { token: "fixture-token" },
    transport(request) {
      assert.equal(request.method, "GET");
      assert.equal(new URL(request.url).pathname, "/comics");
      assert.ok(Math.abs(Number(request.headers.time) - now) < 5);
      assert.match(request.headers.signature, /^[a-f0-9]{64}$/);
      return {
        status: 200,
        url: request.url,
        headers: { "content-type": "application/json" },
        body: Buffer.from(JSON.stringify({ data: { comics: { docs: [], page: 1, pages: 1 } } })),
      };
    },
  });
  assert.equal(host.call("get_manga_list", []).manga.length, 0);
  assert.equal(host.requests.length, 1);
});

test("报告隐藏账号和签名查询参数，真实请求仍保持原值", () => {
  const archive = spawnSync("python3", [
    "-c",
    'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.manhuaren-v2.aix").read("Payload/main.wasm"))',
  ]);
  assert.equal(archive.status, 0);
  const host = createHost(archive.stdout, {
    defaults: { uid: "fixture-user", token: "fixture-token" },
    transport(request) {
      assert.equal(new URL(request.url).searchParams.get("gui"), "fixture-user");
      return { status: 200, url: request.url, headers: {}, body: Buffer.from('{"response":{"mangas":[]}}') };
    },
  });
  host.call("get_manga_list", []);
  const url = new URL(host.requests[0].url);
  assert.equal(url.searchParams.get("gui"), "[redacted]");
  assert.equal(url.searchParams.get("gsn"), "[redacted]");
  assert.ok(!host.requests[0].url.includes("fixture-user"));
});
