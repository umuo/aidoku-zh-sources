import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import test from "node:test";

const execute = promisify(execFile);
async function probe(spec, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const child = execute("python3", ["tools/source-check/http-probe.py"]);
    child.child.stdin.end(JSON.stringify({ ...spec, url: `http://127.0.0.1:${server.address().port}/probe` }));
    return JSON.parse((await child).stdout);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("诊断 HTTP 传输保留 401 认证错误正文，不伪装成请求成功", async () => {
  const response = await probe({}, (_request, result) => {
    result.writeHead(401, { "Content-Type": "application/json" });
    result.end('{"message":"unauthorized"}');
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers["content-type"], "application/json");
  assert.equal(Buffer.from(response.body, "base64").toString(), '{"message":"unauthorized"}');
});

test("诊断 HTTP 传输保留 POST 正文和读取所需请求头", async () => {
  const response = await probe(
    { method: "POST", body: Buffer.from("page=1").toString("base64"), headers: { Referer: "https://example.org/" } },
    (request, result) => {
      assert.equal(request.method, "POST");
      assert.equal(request.headers.referer, "https://example.org/");
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        assert.equal(body, "page=1");
        result.end("ok");
      });
    },
  );
  assert.equal(Buffer.from(response.body, "base64").toString(), "ok");
});

test("诊断 HTTP 传输设置图片 Range 并保留解压后的真实字节", async () => {
  const bytes = Buffer.from("524946460000000057454250", "hex");
  const response = await probe({ imageProbe: true }, (request, result) => {
    assert.equal(request.headers.range, "bytes=0-511");
    result.writeHead(206, { "Content-Encoding": "gzip", "Content-Type": "image/webp" });
    result.end(gzipSync(bytes));
  });
  assert.equal(response.status, 206);
  assert.deepEqual(Buffer.from(response.body, "base64"), bytes);
});
