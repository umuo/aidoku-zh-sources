import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createCipheriv } from "node:crypto";
import test from "node:test";
import { createHost } from "./host.mjs";

const result = spawnSync("python3", [
  "-c",
  'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile("public/sources/zh.copymanga-v13.aix").read("Payload/main.wasm"))',
]);
assert.equal(result.status, 0);
const key = "0123456789abcdef";
const iv = "fedcba9876543210";
const uuid = "f47ac10b-58cc-11cf-a447-001122334455";
function encrypt(data) {
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(key), Buffer.from(iv));
  return iv + Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]).toString("hex");
}
function hostFor(resolve) {
  return createHost(result.stdout, {
    transport(request) {
      const data = resolve(request);
      return {
        status: 200,
        url: request.url,
        headers: {},
        body: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
      };
    },
  });
}

test("拷贝漫画使用服务器要求的 APP 3.0.0 请求头", () => {
  const host = hostFor((request) => {
    assert.equal(request.headers.version, "3.0.0");
    assert.equal(request.headers["User-Agent"], "COPY/3.0.0");
    return {
      code: 200,
      results: {
        list: [{ path_word: "sample", cover: "cover.jpg", name: "Sample", author: [] }],
        total: 1,
        limit: 50,
        offset: 0,
      },
    };
  });
  assert.equal(host.call("get_manga_list", []).manga[0].id, "sample");
});

test("拷贝漫画兼容新 ccz 和旧 ccx 密钥、单双引号及空白变化", () => {
  for (const declaration of [`var ccz = '${key}';`, `const ccz\t=\t"${key}";`, `var ccx = '${key}';`]) {
    const host = hostFor((request) =>
      request.url.includes("/comicdetail/")
        ? {
            code: 200,
            results: encrypt({
              build: { path_word: "sample" },
              groups: { default: { chapters: [{ id: uuid, name: "Chapter 1" }] } },
            }),
          }
        : `<script>${declaration}</script>`,
    );
    assert.equal(host.call("get_chapter_list", { id: "sample" })[0].id, uuid);
  }
});

test("拷贝漫画使用新 ccz 或旧 ccy 解密真实格式的图片列表", () => {
  for (const variable of ["ccz", "ccy"]) {
    const html = `<script>var ${variable} = '${key}';</script><div contentKey="${encrypt([{ url: "https://images.example/page.webp" }])}"></div>`;
    const host = hostFor(() => html);
    assert.equal(
      host.call("get_page_list", { id: uuid, mangaId: "sample" })[0].url,
      "https://images.example/page.webp",
    );
  }
});

test("拷贝漫画缺少密钥、无效密文和受限空目录返回错误，不触发 WASM 崩溃", () => {
  const host = hostFor(() => "<html>No key</html>");
  assert.throws(() => host.call("get_chapter_list", { id: "sample" }), /returned an error/);
  for (const payload of [
    "short",
    "invalidinvalid00not-hex",
    encrypt({ build: { path_word: "sample" }, groups: { default: { chapters: [] } } }),
  ]) {
    const host = hostFor((request) =>
      request.url.includes("/comicdetail/") ? { code: 200, results: payload } : `<script>var ccz='${key}';</script>`,
    );
    assert.throws(() => host.call("get_chapter_list", { id: "sample" }), /returned an error/);
  }
});
