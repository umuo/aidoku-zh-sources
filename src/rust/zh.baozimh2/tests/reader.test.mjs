import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 先构建图源，再使用 Node.js 20+ 运行 node tests/reader.test.mjs。
// 使用实际 WASM 导出和模拟宿主验证阅读流程，不访问网络。
const wasm = new WebAssembly.Module(
  readFileSync(
    process.env.BAOZIMH2_WASM_PATH ??
      new URL("../target/wasm32-unknown-unknown/release/aidoku_baozimh2.wasm", import.meta.url),
  ),
);
// 固定编码样本已与站点 chapter-decoder.js 的输出交叉核对。
const fixtures = JSON.parse(readFileSync(new URL("fixtures/images.json", import.meta.url), "utf8"));

function reader(response, mid = "5") {
  const values = new Map();
  const requests = [];
  let nextId = 1;
  let instance;
  const put = (value) => {
    const id = nextId++;
    values.set(id, value);
    return id;
  };
  const get = (id) => values.get(id);
  const read = (pointer, length) =>
    new TextDecoder().decode(new Uint8Array(instance.exports.memory.buffer, pointer, length));
  const kind = (id) => {
    const value = get(id);
    if (value == null) {
      return 0;
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? 1 : 2;
    }
    if (typeof value === "string") {
      return 3;
    }
    if (typeof value === "boolean") {
      return 4;
    }
    if (Array.isArray(value)) {
      return 5;
    }
    return value.node ? 8 : 6;
  };
  const imports = {
    std: {
      typeof: kind,
      destroy: (id) => values.delete(id),
      copy: (id) => put(get(id)),
      read_int: (id) => BigInt(get(id)),
      object_get: (id, pointer, length) => put(get(id)[read(pointer, length)]),
      array_len: (id) => get(id).length,
      array_get: (id, index) => put(get(id)[index]),
      create_array: () => put([]),
      array_append: (id, value) => get(id).push(get(value)),
      string_len: (id) => new TextEncoder().encode(get(id)).length,
      read_string: (id, pointer, length) => {
        const bytes = new TextEncoder().encode(get(id));
        assert.equal(length, bytes.length);
        new Uint8Array(instance.exports.memory.buffer, pointer, length).set(bytes);
      },
    },
    net: {
      init: () => {
        const request = { headers: {} };
        requests.push(request);
        return put(request);
      },
      set_url: (id, pointer, length) => {
        get(id).url = read(pointer, length);
      },
      set_header: (id, key, keyLength, value, valueLength) => {
        get(id).headers[read(key, keyLength)] = read(value, valueLength);
      },
      send: () => {},
      close: () => {},
      json: () => put(typeof response === "function" ? response(requests.at(-1)) : response),
      html: () => put({ node: true }),
    },
    html: {
      select: (id, pointer, length) => {
        assert.equal(read(pointer, length), "#mangachapters");
        return put({ node: true });
      },
      attr: (id, pointer, length) => {
        assert.equal(read(pointer, length), "data-mid");
        return put(mid);
      },
    },
    json: {
      parse: (pointer, length) => {
        try {
          return put(JSON.parse(read(pointer, length)));
        } catch {
          return -1;
        }
      },
    },
    aidoku: {
      create_page: (index, pointer, length) => put({ index, url: read(pointer, length) }),
      create_chapter: (
        id,
        idLength,
        title,
        titleLength,
        volume,
        chapter,
        date,
        scanlator,
        scanlatorLength,
        url,
        urlLength,
      ) => put({ id: read(id, idLength), title: read(title, titleLength), chapter, url: read(url, urlLength) }),
    },
  };
  for (const entry of WebAssembly.Module.imports(wasm)) {
    imports[entry.module] ??= {};
    if (!imports[entry.module][entry.name]) {
      imports[entry.module][entry.name] = () => {
        throw new Error(`Unexpected host call: ${entry.module}.${entry.name}`);
      };
    }
  }
  instance = new WebAssembly.Instance(wasm, imports);
  return {
    requests,
    pages(mangaId = "example/5") {
      const result = instance.exports.get_page_list(put({ id: "1758522", mangaId }));
      return result === -1 ? -1 : get(result);
    },
    chapters(mangaId = "example/5") {
      const result = instance.exports.get_chapter_list(put({ id: mangaId }));
      return result === -1 ? -1 : get(result);
    },
    imageRequest() {
      const request = { headers: {} };
      instance.exports.modify_image_request(put(request));
      return request;
    },
  };
}

function response(images, line = 1) {
  return { status: true, data: { info: { images: { images, line } } } };
}

test("新版编码图片列表按原顺序生成阅读页，并按线路选择图片域名", () => {
  for (const fixture of fixtures.filter((item) => item.images.length > 0)) {
    for (const line of [1, 2, 3]) {
      const source = reader(response(fixture.encoded, line));
      const host = line === 2 ? "https://c-nd2-1.6wm.top" : "https://c-nd3-1.6wm.top";
      assert.deepEqual(
        source.pages(),
        fixture.images.map((image, index) => ({ index, url: host + image.url })),
      );
      assert.equal(source.requests[0].url, "https://v2.apikk.top/api/v2/chapter/getinfo?m=5&c=1758522");
      assert.deepEqual(source.requests[0].headers, { Origin: "https://baozimh.org", Referer: "https://baozimh.org" });
    }
  }
});

test("兼容明文列表、缺省线路、绝对地址和没有前导斜杠的图片路径", () => {
  const data = response([
    { url: "/first.webp" },
    { url: "second.webp" },
    { url: "https://images.example/third.webp" },
    { url: "//images.example/fourth.webp" },
  ]);
  delete data.data.info.images.line;
  const source = reader(data);
  assert.deepEqual(source.pages(), [
    { index: 0, url: "https://c-nd3-1.6wm.top/first.webp" },
    { index: 1, url: "https://c-nd3-1.6wm.top/second.webp" },
    { index: 2, url: "https://images.example/third.webp" },
    { index: 3, url: "https://images.example/fourth.webp" },
  ]);
});

test("截断、非法字符、空列表和错误响应应返回错误，不能使插件崩溃", () => {
  const encoded = fixtures[0].encoded;
  const invalid = ["", "J7rnQ", "J7rkDW4snQ", "J7r中文kDW4snQ", "not-encoded", "J7r??kD??W4s??nQ"];
  for (let length = 1; length < encoded.length; length++) {
    invalid.push(encoded.slice(0, length));
  }
  for (const value of [...invalid, [], fixtures.at(-1).encoded, null, {}]) {
    assert.equal(reader(response(value)).pages(), -1);
  }
  assert.equal(reader({ status: false }).pages(), -1);
  assert.equal(reader(response([{ url: null }])).pages(), -1);
  assert.equal(reader(response([{ url: "" }])).pages(), -1);
  assert.equal(reader(response([{ url: "/first.webp" }, null])).pages(), -1);
});

test("旧书架条目缺少数字 ID 时，从详情补齐后请求章节图片", () => {
  const source = reader(response([{ url: "/first.webp" }]));
  assert.equal(source.pages("example").length, 1);
  assert.deepEqual(
    source.requests.map((request) => request.url),
    ["https://baozimh.org/manga/example", "https://v2.apikk.top/api/v2/chapter/getinfo?m=5&c=1758522"],
  );
  for (const mid of ["", "invalid"]) {
    assert.equal(reader(response([]), mid).pages("example"), -1);
  }
});

test("章节列表使用新 API，保留章节 ID、标题、顺序和网页链接", () => {
  const source = reader({
    data: {
      chapters: [
        { id: 101, attributes: { title: "第一话", slug: "chapter-1" } },
        { id: 102, attributes: { title: "第二话", slug: "chapter-2" } },
      ],
    },
  });
  assert.deepEqual(source.chapters(), [
    { id: "102", title: "第二话", chapter: 2, url: "https://baozimh.org/manga/example/chapter-2" },
    { id: "101", title: "第一话", chapter: 1, url: "https://baozimh.org/manga/example/chapter-1" },
  ]);
  assert.equal(source.requests[0].url, "https://v2.apikk.top/api/v2/manga/get?mid=5&mode=all");
});

test("图片下载保留站点 Referer", () => {
  assert.equal(reader(response([])).imageRequest().headers.Referer, "https://baozimh.org");
});

test("目录必须获取全部章节，不能使用只返回首尾共40章的旧接口", () => {
  const list = Array.from({ length: 85 }, (_, index) => ({
    id: index + 101,
    attributes: { title: `第${index + 1}话`, slug: `chapter-${index + 1}` },
  }));
  const source = reader((request) => ({
    data: {
      chapters:
        request.url === "https://v2.apikk.top/api/v2/manga/get?mid=5&mode=all"
          ? list
          : [...list.slice(0, 20), ...list.slice(-20)],
    },
  }));
  const chapters = source.chapters();
  assert.equal(source.requests[0].url, "https://v2.apikk.top/api/v2/manga/get?mid=5&mode=all");
  assert.equal(chapters.length, 85);
  assert.deepEqual(
    chapters.map((chapter) => chapter.id),
    list.map((chapter) => String(chapter.id)).reverse(),
  );
  assert.equal(chapters.find((chapter) => chapter.id === "143").title, "第43话");
});
