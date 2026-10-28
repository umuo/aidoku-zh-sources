import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHost, curlRequest } from "./host.mjs";

const id = process.argv[2];
if (!id?.startsWith("zh.")) {
  throw new Error("Usage: node tools/source-check/audit.mjs zh.source [path/to/plugin.wasm]");
}
const index = JSON.parse(readFileSync("public/index.min.json", "utf8"));
const directory = [`src/rust/${id}`, `src/as/${id}`].find((path) => existsSync(`${path}/res/source.json`));
const metadata = directory ? JSON.parse(readFileSync(`${directory}/res/source.json`, "utf8")) : null;
const entry = index.find((source) => source.id === (metadata?.info.id ?? id));
const filterConfig =
  directory && existsSync(`${directory}/res/filters.json`)
    ? JSON.parse(readFileSync(`${directory}/res/filters.json`, "utf8"))
    : [];
// Aidoku 会发送选择器和排序的默认值，不能用空数组把合法默认筛选误判为站点失败。
const filters = filterConfig.flatMap((filter) => {
  if (filter.type === "select") {
    return [{ name: filter.name, type: 4, value: filter.default ?? 0 }];
  }
  if (filter.type === "sort") {
    return [{ name: filter.name, type: 5, value: filter.default ?? { index: 0, ascending: false } }];
  }
  return [];
});
const defaults = {};
if (directory && existsSync(`${directory}/res/settings.json`)) {
  const settings = JSON.parse(readFileSync(`${directory}/res/settings.json`, "utf8"));
  for (const setting of settings.flatMap((group) => group.items ?? [group])) {
    if (setting.key && setting.default !== undefined) {
      defaults[setting.key] = setting.default;
    }
  }
}
let wasm;
if (process.argv[3]) {
  wasm = readFileSync(process.argv[3]);
} else {
  if (!entry) {
    throw new Error("Deprecated/unpublished source: build it and supply its WASM path explicitly");
  }
  const result = spawnSync(
    "python3",
    [
      "-c",
      'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("Payload/main.wasm"))',
      `public/sources/${entry.file}`,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr.toString());
  }
  wasm = result.stdout;
}
const report = {
  source: id,
  version: process.argv[3] ? metadata?.info.version : entry?.version,
  checkedAt: new Date().toISOString(),
  checks: {},
};
let host;
try {
  host = createHost(wasm, { defaults });
  const list = host.call("get_manga_list", filters);
  if (!list?.manga?.length) {
    throw new Error("Empty manga list");
  }
  report.checks.list = { count: list.manga.length };
  const sample = list.manga[0];
  const search = host.call("get_manga_list", [...filters, { name: "标题", type: 7, value: sample.title }]);
  if (!search?.manga?.length) {
    throw new Error("Empty search result");
  }
  report.checks.search = { count: search.manga.length };
  const manga = host.call("get_manga_details", sample);
  if (!manga?.title || !manga.id) {
    throw new Error("Missing manga details");
  }
  report.checks.details = { id: manga.id, hasCover: Boolean(manga.cover) };
  const chapters = host.call("get_chapter_list", manga);
  if (!chapters?.length) {
    throw new Error("Empty chapter list");
  }
  report.checks.chapters = { count: chapters.length };
  const pages = host.call("get_page_list", { ...chapters.at(-1), mangaId: manga.id });
  if (!pages?.length || !pages.every((page) => page.url || page.base64)) {
    throw new Error("Empty or incomplete page list");
  }
  report.checks.pages = { count: pages.length };
  if (pages[0].url) {
    const response = curlRequest(host.imageRequest(pages[0].url), { imageProbe: true });
    const signature = response.body.subarray(0, 16).toString("hex");
    const avif =
      response.body.subarray(4, 8).toString() === "ftyp" && /avif|avis/.test(response.body.subarray(8, 40).toString());
    const image =
      /^(ffd8ff|89504e470d0a1a0a|47494638)/.test(signature) ||
      (signature.startsWith("52494646") && response.body.subarray(8, 12).toString() === "WEBP") ||
      avif;
    if (![200, 206].includes(response.status) || !image) {
      throw new Error(`Image probe did not return recognized image bytes (HTTP ${response.status})`);
    }
    report.checks.image = { status: response.status, contentType: response.headers["content-type"], signature };
  } else {
    report.checks.image = { embeddedBase64: true };
  }
  report.result = "PASS";
} catch (error) {
  report.result = "FAILED";
  report.error = error.message;
  process.exitCode = 1;
}
report.requests = host?.requests ?? [];
console.log(JSON.stringify(report, null, 2));
