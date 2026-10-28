import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.bilicomic-v5.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);

function hostFor(html) {
  return createHost(result.stdout, {
    transport(request) {
      return { status: 200, url: request.url, headers: { "content-type": "text/html" }, body: Buffer.from(html) };
    },
  });
}

test("哔哩漫画使用新版筛选参数格式，并保留页码", () => {
  const host = hostFor("");
  host.call("get_manga_list", [], 2);
  assert.equal(host.requests[0].url, "https://www.bilimanga.net/filter/lastupdate_0_0_0_0_0_0_0_2_0_0_0.html");
});

test("哔哩漫画搜索直接跳转详情时仍生成漫画结果", () => {
  const host = hostFor(
    '<link rel="alternate" href="https://www.bilicomic.net/detail/1722.html"><img class="book-cover" src="https://images.example/cover.jpg"><h1 class="book-title">Sample</h1>',
  );
  const result = host.call("get_manga_list", [{ name: "标题", type: 7, value: "Sample" }]);
  assert.equal(result.manga[0].id, "1722");
  assert.equal(result.manga[0].title, "Sample");
});

test("哔哩漫画保留 AVIF 懒加载图片真实地址，不返回占位图", () => {
  const host = hostFor(
    '<div id="acontentz"><img data-src="https://images.example/page.avif" src="/images/sloading.svg"></div>',
  );
  const pages = host.call("get_page_list", { id: "140068", mangaId: "1722" });
  assert.equal(pages[0].url, "https://images.example/page.avif");
  const request = host.imageRequest(pages[0].url);
  assert.equal(request.headers.Referer, "https://www.bilimanga.net");
  assert.ok(request.headers["User-Agent"].includes("iPhone"));
});
