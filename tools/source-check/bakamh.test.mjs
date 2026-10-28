import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.bakamh-v3.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);

function hostFor(html) {
  return createHost(result.stdout, {
    transport(request) {
      return { status: 200, url: request.url, headers: { "content-type": "text/html" }, body: Buffer.from(html) };
    },
  });
}

test("巴卡漫画从 meta content 获取标题，而不是读取空文本", () => {
  const host = hostFor(
    '<meta property="og:title" content="Sample"><meta property="og:image" content="https://images.example/cover.png"><div class="post-content"><div></div><div><div class="summary-content">OnGoing</div></div><div></div><div><div><p>Summary</p></div></div></div>',
  );
  assert.equal(host.call("get_manga_details", { id: "sample" }).title, "Sample");
});

test("巴卡漫画兼容站点的新旧章节类名，不丢失顺序或重复章节", () => {
  for (const classes of ["mkjp-chapter", "wp-manga-chapter", "mkjp-chapter wp-manga-chapter"]) {
    const host = hostFor(
      `<ul><li class="${classes}"><a href="https://bakamh.com/manga/sample/c-2/">Chapter 2</a></li><li class="${classes}"><a href="https://bakamh.com/manga/sample/c-1/">Chapter 1</a></li></ul>`,
    );
    const chapters = host.call("get_chapter_list", { id: "sample" });
    assert.deepEqual(
      chapters.map(({ id, chapter }) => ({ id, chapter })),
      [
        { id: "c-2", chapter: 2 },
        { id: "c-1", chapter: 1 },
      ],
    );
  }
});

test("巴卡漫画默认列表 URL 不含双斜杠路径，空章节返回错误", () => {
  const host = hostFor("");
  host.call("get_manga_list", []);
  assert.equal(host.requests[0].url, "https://bakamh.com/page/1/");
  assert.throws(() => host.call("get_chapter_list", { id: "sample" }), /returned an error/);
});
