import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.godamanga-v10.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);
// 这些样本也已与 G站当前公开解码器交叉核对，协议相同才复用。
const fixtures = JSON.parse(readFileSync("src/rust/zh.baozimh2/tests/fixtures/images.json", "utf8"));

function hostFor(images, line = 1) {
  return createHost(result.stdout, {
    transport(request) {
      let data;
      if (request.url.startsWith("https://godamh.com/manga/")) {
        data = '<div id="mangachapters" data-mid="12"></div>';
      } else {
        assert.equal(request.headers.Origin, "https://godamh.com");
        assert.equal(request.headers.Referer, "https://godamh.com");
        assert.ok(request.url.startsWith("https://v2.apikk.top/api/v2/"));
        data = request.url.includes("/manga/get")
          ? { data: { chapters: [{ id: 101, attributes: { title: "Chapter 1", slug: "0_0" } }] } }
          : { data: { info: { images: { images, line } } } };
      }
      return {
        status: 200,
        url: request.url,
        headers: {},
        body: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
      };
    },
  });
}

test("G站使用现站 v2 目录和图片接口，保持已有书架标识", () => {
  const host = hostFor([{ url: "/first.webp" }]);
  const chapters = host.call("get_chapter_list", { id: "sample/12" });
  assert.equal(host.requests[0].url, "https://v2.apikk.top/api/v2/manga/get?mid=12&mode=all");
  assert.equal(chapters[0].id, "101");
  const pages = host.call("get_page_list", { id: "101", mangaId: "sample/12" });
  assert.equal(host.requests[1].url, "https://v2.apikk.top/api/v2/chapter/getinfo?m=12&c=101");
  assert.equal(pages[0].url, "https://c-nd3-1.6wm.top/first.webp");
});

test("G站按当前编码协议解析图片并选择实际线路", () => {
  for (const fixture of fixtures.filter((item) => item.images.length > 0)) {
    for (const line of [1, 2]) {
      const host = hostFor(fixture.encoded, line);
      const pages = host.call("get_page_list", { id: "101", mangaId: "sample/12" });
      const prefix = line === 2 ? "https://c-nd2-1.6wm.top" : "https://c-nd3-1.6wm.top";
      assert.deepEqual(
        pages.map(({ index, url }) => ({ index, url })),
        fixture.images.map((image, index) => ({ index, url: prefix + image.url })),
      );
    }
  }
});

test("G站兼容旧书架缺少数字 ID，异常图片列表不返回空成功", () => {
  const host = hostFor([{ url: "/first.webp" }]);
  assert.equal(host.call("get_page_list", { id: "101", mangaId: "sample" }).length, 1);
  assert.equal(host.requests[0].url, "https://godamh.com/manga/sample");
  for (const value of [[], "bad-encoding", [{ url: "" }]]) {
    assert.throws(() => hostFor(value).call("get_page_list", { id: "101", mangaId: "sample/12" }), /returned an error/);
  }
});
