import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.guazimanhua-v1.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);
const base = "https://www.guazimanhua.com";
function hostFor(body) {
  return createHost(result.stdout, {
    transport(request) {
      return { status: 200, url: request.url, headers: {}, body: Buffer.from(body) };
    },
  });
}
const card = `<section class="grid"><article class="card">
  <a class="cover-wrap" href="/comic.php?id=26470"><img class="cover" src="//img.guazicdn.com/cover.webp"></a>
  <h3><a href="/comic.php?id=26470">一人之下</a></h3></article></section>`;

test("瓜子漫画列表分页、搜索和组合筛选传入正确参数", () => {
  const host = hostFor(`${card}<nav class="pager"><a href="/category.php?cid=13&amp;page=3">&gt;</a></nav>`);
  const list = host.call(
    "get_manga_list",
    [
      { type: 7, name: "标题", value: "一人 & #" },
      { type: 4, name: "题材", value: 16 },
      { type: 4, name: "地区", value: 5 },
      { type: 4, name: "状态", value: 2 },
      { type: 4, name: "排序", value: 3 },
    ],
    2,
  );
  const url = new URL(host.requests[0].url);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: "2",
    keyword: "一人 & #",
    cid: "13",
    city: "338",
    is_end: "1",
    sort: "update",
  });
  assert.equal(list.hasMore, true);
  assert.equal(list.manga[0].id, "26470");
  assert.equal(list.manga[0].title, "一人之下");
  assert.equal(list.manga[0].cover, "https://img.guazicdn.com/cover.webp");
  assert.equal(list.manga[0].url, `${base}/comic.php?id=26470`);
  assert.equal(hostFor(card).call("get_manga_list", []).hasMore, false);
  assert.equal(
    hostFor(`${card}<nav class="pager"><a href="?page=20">20</a></nav>`).call("get_manga_list", []).hasMore,
    false,
  );
  assert.deepEqual(hostFor('<section class="grid"></section>').call("get_manga_list", []).manga, []);
  assert.throws(() => hostFor(card).call("get_manga_list", [{ type: 4, name: "题材", value: 999 }]));
});

test("瓜子漫画详情只读取作品信息，不混入推荐和移动端内容", () => {
  for (const [status, expected] of [
    ["连载", 1],
    ["完结", 2],
  ]) {
    const host = hostFor(`<h1 id="cinema-title">一人之下</h1><img class="cinema-cover" src="/cover.webp">
      <div class="cinema-info"><div class="meta"><a class="badge">热血</a><a class="badge">冒险</a><span class="badge">${status}</span></div><p>作品简介 &amp; 后续</p></div>
      <div class="cinema-strip"><a href="/author.php?name=author">米橙子</a></div>`);
    const detail = host.call("get_manga_details", { id: "26470" });
    assert.equal(detail.title, "一人之下");
    assert.equal(detail.cover, `${base}/cover.webp`);
    assert.equal(detail.author, "米橙子");
    assert.equal(detail.description, "作品简介 & 后续");
    assert.deepEqual(detail.categories, ["热血", "冒险"]);
    assert.equal(detail.status, expected);
    assert.equal(detail.viewer, 4);
  }
});

test("瓜子漫画完整目录去重并保持最新在前和章节编号", () => {
  const host = hostFor(`<div data-mobile-chapter-list><a href="/chapter.php?id=1">重复</a></div>
    <div data-chapter-list><a href="/chapter.php?id=2">第二话</a><a href="/chapter.php?id=1">第一话</a></div>`);
  const chapters = host.call("get_chapter_list", { id: "26470" });
  assert.deepEqual(
    chapters.map(({ id, title, chapter }) => ({ id, title, chapter })),
    [
      { id: "2", title: "第二话", chapter: 2 },
      { id: "1", title: "第一话", chapter: 1 },
    ],
  );
  assert.equal(chapters[0].url, `${base}/chapter.php?id=2`);
});

test("瓜子漫画正文不混入广告，页序从零开始，设置图片 Referer", () => {
  const host = hostFor(`<img src="https://example.org/ad.jpg"><section class="reader-images">
    <img class="reading-image is-active" src="https://img.guazicdn.com/1.webp">
    <img class="reading-image" src="//img.guazicdn.com/2.webp"></section>`);
  const pages = host.call("get_page_list", { id: "1977711", mangaId: "26470" });
  assert.deepEqual(
    pages.map(({ index, url }) => ({ index, url })),
    [
      { index: 0, url: "https://img.guazicdn.com/1.webp" },
      { index: 1, url: "https://img.guazicdn.com/2.webp" },
    ],
  );
  assert.equal(host.imageRequest(pages[0].url).headers.Referer, `${base}/`);
});

test("瓜子漫画缺失详情、空目录、空正文或损坏图片返回错误", () => {
  assert.throws(() => hostFor("<h1>Not found</h1>").call("get_manga_details", { id: "1" }));
  assert.throws(() => hostFor("").call("get_chapter_list", { id: "1" }));
  for (const body of ["", '<section class="reader-images"><img class="reading-image" src=""></section>']) {
    assert.throws(() => hostFor(body).call("get_page_list", { id: "1", mangaId: "1" }));
  }
  assert.throws(() => hostFor("").call("get_manga_details", { id: "../bad" }));
});
