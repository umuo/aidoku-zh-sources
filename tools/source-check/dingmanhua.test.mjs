import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.dingmanhua-v1.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);
const base = "https://www.dingmanhua.com";
function hostFor(body) {
  return createHost(result.stdout, {
    transport(request) {
      return {
        status: 200,
        url: request.url,
        headers: {},
        body: Buffer.from(typeof body === "function" ? body(request) : body),
      };
    },
  });
}
const card = `<div class="manga-grid"><article class="manga-card"><a href="/comic/367.html"><img data-src="//image1.dingmanhua.com/cover.webp" src="/resource/image/loading.svg"><div class="manga-title">一人之下</div></a></article></div>`;

test("顶漫画分类、懒加载封面、精确分页和特殊字符搜索", () => {
  const host = hostFor(`${card}<nav class="pagination"><a href="?category=14&amp;tag=93&amp;page=3">下一页</a></nav>`);
  const list = host.call(
    "get_manga_list",
    [
      { type: 4, name: "地区", value: 4 },
      { type: 4, name: "题材", value: 93 },
    ],
    2,
  );
  assert.equal(host.requests[0].url, `${base}/sort?category=14&tag=93&page=2`);
  assert.equal(list.hasMore, true);
  assert.equal(list.manga[0].id, "367");
  assert.equal(list.manga[0].title, "一人之下");
  assert.equal(list.manga[0].cover, "https://image1.dingmanhua.com/cover.webp");
  host.call(
    "get_manga_list",
    [
      { type: 7, name: "标题", value: "一人 & #" },
      { type: 4, name: "地区", value: 4 },
    ],
    2,
  );
  const url = new URL(host.requests[1].url);
  assert.equal(url.pathname, "/search");
  assert.deepEqual(Object.fromEntries(url.searchParams), { query: "一人 & #", page: "2" });
  assert.equal(
    hostFor(`${card}<nav class="pagination"><a href="?page=20">末页</a><a class="disable">下一页</a></nav>`).call(
      "get_manga_list",
      [],
    ).hasMore,
    false,
  );
  assert.deepEqual(hostFor('<div class="manga-grid"></div>').call("get_manga_list", []).manga, []);
  for (const [name, value] of [
    ["地区", 6],
    ["地区", -1],
    ["题材", 94],
  ]) {
    assert.throws(() => hostFor(card).call("get_manga_list", [{ type: 4, name, value }]));
  }
});

test("顶漫画详情保留作者、题材、简介与状态", () => {
  for (const [status, expected] of [
    ["连载中", 1],
    ["已完结", 2],
  ]) {
    const host = hostFor(
      `<h1 id="mangaTitle">一人之下</h1><img id="mangaCover" src="/cover.webp"><span id="mangaAuthor">米二</span><div class="meta-status"><span>状态:</span><span>${status}</span></div><div id="mangaTags"><a><span class="tag">热血</span></a><span class="tag">冒险</span></div><p id="mangaDescription">介绍 &amp; 后续</p>`,
    );
    const detail = host.call("get_manga_details", { id: "367" });
    assert.equal(detail.author, "米二");
    assert.equal(detail.title, "一人之下");
    assert.equal(detail.cover, `${base}/cover.webp`);
    assert.equal(detail.description, "介绍 & 后续");
    assert.deepEqual(detail.categories, ["热血", "冒险"]);
    assert.equal(detail.status, expected);
    assert.equal(detail.viewer, 4);
  }
});

function chapterResponse(chapters) {
  return JSON.stringify({ code: 0, data: { chapters } });
}
test("顶漫画通过 POST 获取超过网页 25 章的完整目录，不把图片数当章节号", () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({
    id: 100 - i,
    contentId: 367,
    chapterName: `第${30 - i}话`,
    chapterNum: 99,
  }));
  const host = hostFor((request) => {
    assert.equal(request.method, "POST");
    assert.equal(request.url, `${base}/comic/367`);
    assert.equal(request.headers["Content-Type"], "application/json");
    assert.equal(Buffer.from(request.body).toString(), "{}");
    return chapterResponse(entries);
  });
  const chapters = host.call("get_chapter_list", { id: "367" });
  assert.equal(chapters.length, 30);
  assert.equal(chapters[0].chapter, 30);
  assert.equal(chapters[29].chapter, 1);
  assert.equal(chapters[29].id, "71");
  assert.equal(chapters[0].url, `${base}/chapter/367-100.html`);
});

test("顶漫画只读图片脚本字面量，页序从零开始并传递 Referer", () => {
  for (const script of [
    'var num =eval("3")\nvar pasd = "https://image1.dingmanhua.com/mh/abc/"\n',
    "var num = eval('3');var pasd='https:\\/\\/image1.dingmanhua.com/mh/abc/';",
  ]) {
    const host = hostFor(`<img src="https://example.org/ad.jpg"><script>${script}</script>`);
    const pages = host.call("get_page_list", { id: "100", mangaId: "367" });
    assert.equal(host.requests[0].url, `${base}/chapter/367-100.html`);
    assert.deepEqual(
      pages.map(({ index, url }) => ({ index, url })),
      [0, 1, 2].map((index) => ({ index, url: `https://image1.dingmanhua.com/mh/abc/${index + 1}.webp` })),
    );
    assert.equal(host.imageRequest(pages[0].url).headers.Referer, `${base}/`);
  }
});

test("顶漫画拼音地址可列出、读取详情并解析到数字目录和正文地址", () => {
  const slug = "shisuidezuiqiangmodaoshi";
  assert.equal(
    hostFor(card.replace("/comic/367.html", `/comic/${slug}.html`)).call("get_manga_list", []).manga[0].id,
    slug,
  );
  const host = hostFor((request) => {
    if (request.url.includes(`/comic/${slug}.html`)) {
      return `<h1 id="mangaTitle">十歲的最強魔導師</h1><img id="mangaCover" src="/cover.webp"><a href="/chapter/2255-100.html">第一话</a>`;
    }
    if (request.method === "POST") {
      assert.equal(request.url, `${base}/comic/2255`);
      return chapterResponse([{ id: 100, contentId: 2255, chapterName: "第一话" }]);
    }
    assert.equal(request.url, `${base}/chapter/2255-100.html`);
    return '<script>var num=eval("1");var pasd="https://image1.dingmanhua.com/mh/abc/";</script>';
  });
  assert.equal(host.call("get_manga_details", { id: slug }).id, slug);
  assert.equal(host.call("get_chapter_list", { id: slug })[0].id, "100");
  assert.equal(
    host.call("get_page_list", { id: "100", mangaId: slug })[0].url,
    "https://image1.dingmanhua.com/mh/abc/1.webp",
  );
});

test("顶漫画错误接口、异书目录、损坏脚本和非法 ID 均返回错误", () => {
  for (const body of [
    '{"code":1}',
    chapterResponse([]),
    chapterResponse([{ id: 1, contentId: 2, chapterName: "别的漫画" }]),
  ]) {
    assert.throws(() => hostFor(body).call("get_chapter_list", { id: "367" }));
  }
  for (const count of ["1+2", "0", "999999", "-1"]) {
    assert.throws(() =>
      hostFor(`<script>var num=eval("${count}");var pasd="https://image1.dingmanhua.com/mh/";</script>`).call(
        "get_page_list",
        { id: "100", mangaId: "367" },
      ),
    );
  }
  assert.throws(() => hostFor("").call("get_page_list", { id: "100", mangaId: "367" }));
  assert.throws(() => hostFor("").call("get_manga_details", { id: "367" }));
  assert.throws(() => hostFor("").call("get_chapter_list", { id: "../bad" }));
  assert.throws(() => hostFor("").call("get_page_list", { id: "100", mangaId: "../bad" }));
});
