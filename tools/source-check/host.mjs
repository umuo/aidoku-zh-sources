import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "cheerio";

// 只模拟旧版 Aidoku 宿主 ABI；网络和图片仍走真实 HTTP，不模拟可用结果。
export function curlRequest(request, { imageProbe = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), "aidoku-audit-"));
  try {
    const output = join(directory, "body");
    const headers = join(directory, "headers");
    const args = [
      "--silent",
      "--show-error",
      "--location",
      "--compressed",
      "--max-time",
      "25",
      "--dump-header",
      headers,
      "--output",
      output,
      "--write-out",
      "%{http_code}\n%{url_effective}",
    ];
    if (imageProbe) {
      args.push("--range", "0-511", "--max-filesize", "10485760");
    }
    if (request.method === "HEAD") {
      args.push("--head");
    } else if (request.method && request.method !== "GET") {
      args.push("--request", request.method);
    }
    for (const [key, value] of Object.entries(request.headers ?? {})) {
      args.push("--header", `${key}: ${value}`);
    }
    if (request.body) {
      const body = join(directory, "request");
      writeFileSync(body, request.body);
      args.push("--data-binary", `@${body}`);
    }
    args.push(request.url);
    const result = spawnSync("curl", args, { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) {
      throw new Error(`HTTP request failed: ${result.error?.message ?? result.stderr.trim()}`);
    }
    const [status, url] = result.stdout.trim().split("\n");
    const rawHeaders = readFileSync(headers, "utf8");
    const lastHeaders = rawHeaders
      .trim()
      .split(/\r?\n\r?\n/)
      .at(-1);
    const parsed = {};
    for (const line of lastHeaders.split(/\r?\n/).slice(1)) {
      const separator = line.indexOf(":");
      if (separator > 0) {
        parsed[line.slice(0, separator).toLowerCase()] = line.slice(separator + 1).trim();
      }
    }
    return { status: Number(status), url, headers: parsed, body: readFileSync(output) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function createHost(wasm, { transport = curlRequest, defaults = {} } = {}) {
  const values = new Map();
  const requests = [];
  const nodes = new WeakSet();
  let nextId = 1;
  let instance;
  const put = (value) => {
    const id = nextId++;
    values.set(id, value);
    return id;
  };
  const get = (id) => values.get(id);
  const bytes = (pointer, length) => new Uint8Array(instance.exports.memory.buffer, pointer, length);
  const read = (pointer, length) => new TextDecoder().decode(bytes(pointer, length));
  const node = (selection, base = "") => {
    const value = { selection, base };
    nodes.add(value);
    return value;
  };
  const parseHtml = (html, base = "") => node(load(html).root(), base);
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
    return nodes.has(value) ? 8 : 6;
  };
  const parseJson = (text) => {
    try {
      return put(JSON.parse(text));
    } catch {
      return -1;
    }
  };
  const send = (id) => {
    const request = get(id);
    if (!request.response) {
      request.response = transport(request);
      requests.push({
        method: request.method,
        url: request.url,
        status: request.response.status,
        contentType: request.response.headers["content-type"],
        challenge: request.response.headers["cf-mitigated"],
      });
    }
  };
  const imports = {
    std: {
      typeof: kind,
      destroy: (id) => values.delete(id),
      copy: (id) => put(get(id)),
      create_null: () => put(null),
      create_string: (pointer, length) => put(read(pointer, length)),
      create_int: (value) => put(Number(value)),
      create_float: (value) => put(value),
      create_bool: (value) => put(Boolean(value)),
      create_array: () => put([]),
      create_object: () => put({}),
      object_get: (id, pointer, length) => put(get(id)?.[read(pointer, length)]),
      object_set: (id, pointer, length, value) => {
        get(id)[read(pointer, length)] = get(value);
      },
      object_len: (id) => Object.keys(get(id)).length,
      object_keys: (id) => put(Object.keys(get(id))),
      object_values: (id) => put(Object.values(get(id))),
      array_len: (id) => get(id).length,
      array_get: (id, index) => put(get(id)[index]),
      array_append: (id, value) => get(id).push(get(value)),
      array_set: (id, index, value) => {
        get(id)[index] = get(value);
      },
      array_remove: (id, index) => get(id).splice(index, 1),
      string_len: (id) => Buffer.byteLength(get(id)),
      read_string: (id, pointer, length) => bytes(pointer, length).set(Buffer.from(get(id))),
      read_int: (id) => BigInt(Math.trunc(Number(get(id)) || 0)),
      read_float: (id) => Number(get(id)) || 0,
      read_bool: (id) => Boolean(get(id)),
      read_date_string: (id) => Date.parse(get(id)) / 1000 || 0,
    },
    json: { parse: (pointer, length) => parseJson(read(pointer, length)) },
    defaults: {
      get: (pointer, length) => {
        const key = read(pointer, length);
        return key in defaults ? put(defaults[key]) : -1;
      },
      set: (pointer, length, value) => {
        defaults[read(pointer, length)] = get(value);
      },
    },
    net: {
      init: (method) => put({ method: ["GET", "POST", "PUT", "HEAD", "DELETE"][method], headers: {} }),
      set_url: (id, pointer, length) => {
        get(id).url = read(pointer, length);
      },
      set_header: (id, key, keyLength, value, valueLength) => {
        get(id).headers[read(key, keyLength)] = read(value, valueLength);
      },
      set_body: (id, pointer, length) => {
        get(id).body = Buffer.from(bytes(pointer, length));
      },
      send,
      close: () => {},
      get_status_code: (id) => get(id).response?.status ?? 0,
      get_url: (id) => put(get(id).response?.url ?? get(id).url),
      get_header: (id, pointer, length) => put(get(id).response?.headers[read(pointer, length).toLowerCase()]),
      get_data_size: (id) => get(id).response.body.length,
      get_data: (id, pointer, length) => bytes(pointer, length).set(get(id).response.body),
      html: (id) => put(parseHtml(get(id).response.body.toString("utf8"), get(id).response.url)),
      json: (id) => parseJson(get(id).response.body.toString("utf8")),
      set_rate_limit: () => {},
      set_rate_limit_period: () => {},
    },
    html: {
      parse: (pointer, length) => put(parseHtml(read(pointer, length))),
      parse_with_uri: (pointer, length, uri, uriLength) => put(parseHtml(read(pointer, length), read(uri, uriLength))),
      parse_fragment: (pointer, length) => put(parseHtml(read(pointer, length))),
      select: (id, pointer, length) => put(node(get(id).selection.find(read(pointer, length)), get(id).base)),
      array: (id) =>
        put(
          get(id)
            .selection.toArray()
            .map((element, index) => node(get(id).selection.eq(index), get(id).base)),
        ),
      attr: (id, pointer, length) => {
        let key = read(pointer, length);
        const absolute = key.startsWith("abs:");
        if (absolute) {
          key = key.slice(4);
        }
        let value = get(id).selection.first().attr(key) ?? "";
        if (absolute && value) {
          value = new URL(value, get(id).base).href;
        }
        return put(value);
      },
      text: (id) => put(get(id).selection.text().replace(/\s+/g, " ").trim()),
      untrimmed_text: (id) => put(get(id).selection.text()),
      data: (id) => put(get(id).selection.text()),
      html: (id) => put(get(id).selection.html() ?? ""),
      outer_html: (id) => put(get(id).selection.toString()),
      has_attr: (id, pointer, length) => get(id).selection.first().attr(read(pointer, length)) !== undefined,
      first: (id) => put(node(get(id).selection.first(), get(id).base)),
      last: (id) => put(node(get(id).selection.last(), get(id).base)),
      base_uri: (id) => put(get(id).base),
    },
    aidoku: {
      create_manga: (
        id,
        idLength,
        cover,
        coverLength,
        title,
        titleLength,
        author,
        authorLength,
        artist,
        artistLength,
        description,
        descriptionLength,
        url,
        urlLength,
      ) =>
        put({
          id: read(id, idLength),
          cover: read(cover, coverLength),
          title: read(title, titleLength),
          author: read(author, authorLength),
          artist: read(artist, artistLength),
          description: read(description, descriptionLength),
          url: read(url, urlLength),
        }),
      create_manga_result: (id, hasMore) => put({ manga: get(id), hasMore: Boolean(hasMore) }),
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
      create_page: (index, url, urlLength, base64, base64Length) =>
        put({ index, url: read(url, urlLength), base64: read(base64, base64Length) }),
    },
    env: {
      abort: (message) => {
        throw new Error(`WASM abort at ${message}`);
      },
      print: () => {},
    },
  };
  const module = new WebAssembly.Module(wasm);
  for (const entry of WebAssembly.Module.imports(module)) {
    imports[entry.module] ??= {};
    if (!imports[entry.module][entry.name]) {
      imports[entry.module][entry.name] = () => {
        throw new Error(`Unsupported host import: ${entry.module}.${entry.name}`);
      };
    }
  }
  instance = new WebAssembly.Instance(module, imports);
  if (instance.exports.initialize) {
    instance.exports.initialize();
  }
  return {
    requests,
    call(name, value, page = 1) {
      if (!instance.exports[name]) {
        throw new Error(`Missing export: ${name}`);
      }
      const result = instance.exports[name](put(value), page);
      if (result === -1) {
        throw new Error(`${name} returned an error`);
      }
      return get(result);
    },
    imageRequest(url) {
      const request = { method: "GET", url, headers: {} };
      if (instance.exports.modify_image_request) {
        instance.exports.modify_image_request(put(request));
      }
      return request;
    },
  };
}
