import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";
const archive = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.msxhm-v7.aix").read("Payload/main.wasm"))',
]);
assert.equal(archive.status, 0);
function hostFor(body) {
  return createHost(archive.stdout, {
    defaults: { url: "https://www.mxs13.cc" },
    transport(request) {
      return { status: 200, url: request.url, headers: {}, body: Buffer.from(body) };
    },
  });
}
test("漫小肆新详情区区分别名、作者与地区，读取实际懒加载封面", () => {
  const host = hostFor(
    '<div class="detail-main-cover"><img data-original="https://example.org/cover.webp"></div><div class="detail-main-info"><p class="detail-main-info-title">Sample</p><p class="detail-main-info-author">别名：Alternate</p><p class="detail-main-info-author">作者：Alice&amp;Bob</p><p class="detail-main-info-author">地区：Region</p><p class="detail-main-info-class"><a>Genre</a></p></div><div class="detail-desc">Synopsis</div>',
  );
  const detail = host.call("get_manga_details", { id: "1257" });
  assert.equal(detail.title, "Sample");
  assert.equal(detail.cover, "https://example.org/cover.webp");
  assert.equal(detail.author, "Alice, Bob");
  assert.equal(detail.description, "Synopsis");
});
test("漫小肆保留旧详情结构及既有书架 ID", () => {
  const host = hostFor(
    '<div class="banner_detail_form"><div class="cover"><img src="https://example.org/old.webp"></div><div class="info"><h1>Old</h1><p></p><p>作者：Alice</p><div class="content">Old synopsis</div></div></div>',
  );
  const detail = host.call("get_manga_details", { id: "1257" });
  assert.equal(detail.id, "1257");
  assert.equal(detail.title, "Old");
  assert.equal(detail.author, "Alice");
  assert.equal(detail.cover, "https://example.org/old.webp");
});
