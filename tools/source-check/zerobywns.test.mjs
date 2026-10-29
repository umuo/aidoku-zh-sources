import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";
const archive = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("Payload/main.wasm"))',
  process.env.ZERO_AIX_PATH ?? "public/sources/zh.zerobywns-v10.aix",
]);
assert.equal(archive.status, 0);
function hostFor(body, url = "http://www.zerobywav.com") {
  const pageUserAgents = [];
  const host = createHost(archive.stdout, {
    defaults: { url, cookie: "", username: "", password: "" },
    transport(request) {
      // 对应 Aidoku WasmNet 的默认浏览器 UA 注入，不覆盖图源显式设置。
      request.headers["User-Agent"] ??= "Fixture iPhone WebView";
      pageUserAgents.push(request.headers["User-Agent"]);
      return { status: 200, url: request.url, headers: {}, body: Buffer.from(body) };
    },
  });
  return Object.assign(host, { pageUserAgents });
}
test("zero 新列表和详情读取正确字段，旧默认域名自动迁移", () => {
  const host = hostFor(
    '<div class="col-50"><a href="/Android2/details/?kuid=23185"><div><img src="http://example.org/cover.jpg"></div><div class="image-title">Sample</div></a></div>',
  );
  const list = host.call("get_manga_list", []);
  assert.equal(list.manga[0].id, "23185");
  assert.equal(list.manga[0].title, "Sample");
  assert.equal(new URL(host.requests[0].url).hostname, "www.zerobyw33.com");
  const detail = hostFor(
    '<div class="col-33"><img src="http://example.org/cover.jpg"></div><div class="col-66"><h3>Sample</h3><p class="shuxinglabel"><span>作者:Alice</span><a href="?category_id=1">Genre</a><span>已完结</span></p></div><div class="summary">Synopsis</div>',
  ).call("get_manga_details", { id: "23185" });
  assert.equal(detail.id, "23185");
  assert.equal(detail.title, "Sample");
  assert.equal(detail.author, "Alice");
  assert.equal(detail.description, "Synopsis");
});
test("zero 保留用户自定义地址和旧布局，兼容新目录", () => {
  const host = hostFor(
    '<div class="uk-card"><div><a href="?kuid=23185"><img src="http://example.org/cover.jpg"></a></div><div><p><a>Old</a></p></div></div>',
    "https://custom.example",
  );
  assert.equal(host.call("get_manga_list", []).manga[0].title, "Old");
  assert.equal(new URL(host.requests[0].url).hostname, "custom.example");
  const chapters = hostFor(
    '<div class="zjlist"><a href="/Android2/view/?zjid=10">1</a><a href="/Android2/view/?zjid=20">2</a></div>',
  ).call("get_chapter_list", { id: "23185" });
  assert.deepEqual(
    chapters.map((c) => c.id),
    ["20", "10"],
  );
});
test("zero 新旧图片格式、转义和零基页序均有效，不执行 JS", () => {
  for (const body of [
    '<script>window.imagelist=[];window.imagelist.push("http://example.org/1.jpg");window.imagelist.push("https:\\/\\/example.org/2.jpg");</script>',
    '<script>let listimg=[{"file":"http://example.org/1.jpg"},{"file":"https://example.org/2.jpg"}];</script>',
  ]) {
    const pages = hostFor(body).call("get_page_list", { id: "10", mangaId: "23185" });
    assert.deepEqual(
      pages.map(({ index, url }) => ({ index, url })),
      [
        { index: 0, url: "http://example.org/1.jpg" },
        { index: 1, url: "https://example.org/2.jpg" },
      ],
    );
  }
  for (const body of [
    "",
    "<script>window.imagelist.push(runCode());</script>",
    '<script>window.imagelist.push("javascript:alert(1)");</script>',
  ]) {
    assert.throws(() => hostFor(body).call("get_page_list", { id: "10", mangaId: "23185" }), /returned an error/);
  }
});

test("zero 图片与页面使用相同 UA、规范 Referer，保留客户端 Cookie", () => {
  const body = '<script>window.imagelist.push("http://tupa.zerobyw33.com/manhua/test/1/001.jpg");</script>';
  const host = hostFor(body);
  const [page] = host.call("get_page_list", { id: "10", mangaId: "23185" });
  const nativeHeaders = {
    Cookie: "fixture_browser_session=1",
    "User-Agent": "Fixture iPhone WebView",
    "X-Test": "keep",
  };
  const image = host.imageRequest(page.url, nativeHeaders);
  assert.equal(image.url, page.url);
  assert.equal(image.headers["User-Agent"], host.pageUserAgents[0]);
  assert.equal(image.headers["User-Agent"], "Fixture iPhone WebView");
  assert.equal(image.headers.Referer, "http://www.zerobyw33.com/");
  assert.equal(image.headers.Cookie, nativeHeaders.Cookie);
  assert.equal(image.headers["X-Test"], "keep");
  assert.equal(nativeHeaders["User-Agent"], "Fixture iPhone WebView");
});

test("zero 图片请求保留自定义站点，去除重复斜线且不注入空 Cookie", () => {
  for (const url of ["https://custom.example/base", "https://custom.example/base/"]) {
    const request = hostFor("", url).imageRequest("https://images.example/page.jpg", {
      "User-Agent": "Fixture iPhone WebView",
    });
    assert.equal(request.headers.Referer, "https://custom.example/base/");
    assert.equal(request.headers["User-Agent"], "Fixture iPhone WebView");
    assert.equal("Cookie" in request.headers, false);
  }
});
