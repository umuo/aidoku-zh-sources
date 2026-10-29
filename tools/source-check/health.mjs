// 单源只读复查：使用当前发布包与公开匿名请求，不读取用户 App 配置。
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createHost, curlRequest } from "./host.mjs";

const key = process.argv[2];
if (!/^zh\.[a-z0-9]+$/.test(key ?? "")) {
  throw new Error("Usage: node tools/source-check/health.mjs zh.source");
}
const directories = ["src/rust", "src/as"].flatMap(root => readdirSync(root).map(name => join(root, name)));
const directory = directories.find(path => path.endsWith(`/${key}`) && existsSync(`${path}/res/source.json`));
if (!directory) {
  throw new Error("Unknown source directory");
}
const metadata = JSON.parse(readFileSync(`${directory}/res/source.json`));
const info = metadata.info;
const index = JSON.parse(readFileSync("public/index.min.json"));
const entry = index.find(item => item.id === info.id);
const report = { source: info.id, directory: key, name: info.name, version: info.version, published: Boolean(entry), deprecated: Boolean(metadata.deprecated), checkedAt: new Date().toISOString(), checks: {}, requests: [] };
const defaults = {};
if (existsSync(`${directory}/res/settings.json`)) {
  const settings = JSON.parse(readFileSync(`${directory}/res/settings.json`));
  for (const item of settings.flatMap(group => group.items ?? [group])) {
    if (item.key && item.default !== undefined) {
      defaults[item.key] = /password|username|email|cookie|token|session/i.test(item.key) ? "" : item.default;
    }
  }
}
const config = existsSync(`${directory}/res/filters.json`) ? JSON.parse(readFileSync(`${directory}/res/filters.json`)) : [];
const filters = config.flatMap(filter => filter.type === "select" ? [{name:filter.name, type:4, value:filter.default ?? 0}] : filter.type === "sort" ? [{name:filter.name, type:5, value:filter.default ?? {index:0,ascending:false}}] : []);
function safeUrl(raw) {
  const url = new URL(raw);
  url.username = "";
  url.password = "";
  for (const name of url.searchParams.keys()) {
    if (/uid|gui|sign|gsn|token|auth|pass|email|user|key|session|subid/i.test(name)) {
      url.searchParams.set(name, "[redacted]");
    }
  }
  return url.toString();
}
function markers(response) {
  const body = response.body.toString("utf8");
  const hints = [];
  if (/cf-mitigated|challenge/i.test(response.headers["cf-mitigated"] ?? "") || /Just a moment|cf-chl-|Attention Required|正在进行安全验证|challenge_required/i.test(body)) {
    hints.push("访问防护/Cloudflare 验证");
  }
  if (/站点已暂停|站点暂停|暂停服务/.test(body)) {
    hints.push("站点暂停");
  }
  if (/domain.{0,30}(sale|park)|域名.{0,12}(出售|售卖)|sedoparking|buy this domain/i.test(body)) {
    hints.push("域名停放/出售");
  }
  if (/region has been denied/i.test(body)) {
    hints.push("地区拒绝");
  }
  if (/\[\s*"login"\s*\]|"message"\s*:\s*"unauthorized"|请先登录/i.test(body) || response.status === 401) {
    hints.push("要求登录/认证");
  }
  return hints;
}
function request(req, options) {
  if (/\/auth\/sign-in|\/api\/login(?:\?|$)/i.test(req.url)) {
    throw new Error("检测仅使用匿名请求：未发起登录");
  }
  const record = {method:req.method ?? "GET", url:safeUrl(req.url)};
  report.requests.push(record);
  try {
    const response = curlRequest(req, options);
    Object.assign(record, {status:response.status, contentType:response.headers["content-type"], hints:markers(response)});
    if (process.env.AIDOKU_HEALTH_CACHE && !options?.imageProbe) {
      const cache = join(process.env.AIDOKU_HEALTH_CACHE, key);
      mkdirSync(cache, {recursive:true});
      writeFileSync(join(cache, `${report.requests.length}.body`), response.body);
    }
    return response;
  } catch (error) {
    record.error = error.message;
    throw error;
  }
}
function check(name, action) {
  try {
    const value = action();
    report.checks[name] = {status:"PASS", ...value};
    return value;
  } catch (error) {
    report.checks[name] = {status:"FAILED", error:error.message};
    return null;
  }
}
function image(req) {
  const response = request(req, {imageProbe:true});
  const bytes = response.body;
  const signature = bytes.subarray(0,16).toString("hex");
  const valid = /^(ffd8ff|89504e470d0a1a0a|47494638)/.test(signature) || (signature.startsWith("52494646") && bytes.subarray(8,12).toString() === "WEBP") || (bytes.subarray(4,8).toString() === "ftyp" && /avif|avis/.test(bytes.subarray(8,40).toString()));
  if (![200,206].includes(response.status) || !valid) {
    throw new Error(`非有效漫画图片：HTTP ${response.status}`);
  }
  return {httpStatus:response.status, contentType:response.headers["content-type"], signature};
}
if (!entry) {
  check("homepage", () => {
    const response = request({url:info.url, method:"GET", headers:{}});
    return {httpStatus:response.status, hints:markers(response)};
  });
  report.result = "UNPUBLISHED";
  report.reason = "已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常";
} else if (key === "zh.manhuabika" || key === "zh.noy1") {
  check("anonymous", () => {
    const response = key === "zh.noy1" ? request({url:"https://noy1.top/api/booklist_v2", method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},body:Buffer.from("page=1")}) : request({url:"https://picaapi.picacomic.com/comics?page=1&s=dd",method:"GET",headers:{Accept:"application/vnd.picacomic.com.v1+json"}});
    return {httpStatus:response.status, hints:markers(response)};
  });
  report.result = "AUTH_REQUIRED";
  report.reason = "现有源要求账号/会话；未使用默认示例账号或用户凭据，登录后的完整阅读未验证";
} else {
  const packed = spawnSync("python3", ["-c", 'import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("Payload/main.wasm"))',`public/sources/${entry.file}`], {maxBuffer:10*1024*1024});
  if (packed.status !== 0) {
    throw new Error("Unable to read published package");
  }
  report.package = {file:entry.file,sha256:createHash("sha256").update(readFileSync(`public/sources/${entry.file}`)).digest("hex")};
  const host = createHost(packed.stdout, {defaults,transport:request});
  let list;
  check("list", () => {
    list = host.call("get_manga_list", filters);
    if (!list?.manga?.length) {
      throw new Error("漫画列表为空");
    }
    return {count:list.manga.length};
  });
  if (list?.manga?.length) {
    check("search", () => {
      const title = list.manga[0].title;
      let found = host.call("get_manga_list", [...filters,{name:"标题",type:7,value:title}]);
      if (found?.manga?.length) {
        return {count:found.manga.length,keyword:title};
      }
      const short = Array.from(title).slice(0,2).join("");
      found = host.call("get_manga_list", [...filters,{name:"标题",type:7,value:short}]);
      if (!found?.manga?.length) {
        throw new Error("完整标题与短关键词搜索均为空");
      }
      return {count:found.manga.length,keyword:short,note:"完整标题无结果，短关键词可搜索（上游搜索限制）"};
    });
    for (let sampleIndex=0; sampleIndex<Math.min(2,list.manga.length); sampleIndex++) {
      const prefix = `sample${sampleIndex+1}`;
      let manga;
      check(`${prefix}.details`, () => {
        manga = host.call("get_manga_details",list.manga[sampleIndex]);
        if (!manga?.id || !manga.title) {
          throw new Error("详情缺少标题或漫画 ID");
        }
        return {id:manga.id,title:manga.title,hasCover:Boolean(manga.cover)};
      });
      if (!manga?.id || !manga.title) {
        continue;
      }
      let chapters;
      check(`${prefix}.chapters`, () => {
        chapters=host.call("get_chapter_list",manga);
        if (!chapters?.length) {
          throw new Error("章节目录为空");
        }
        return {count:chapters.length};
      });
      if (!chapters?.length) {
        continue;
      }
      let readable = 0;
      for (const [label,chapter] of [["oldest",chapters.at(-1)],["latest",chapters[0]]]) {
        const result = check(`${prefix}.${label}`, () => {
          const pages=host.call("get_page_list",{...chapter,mangaId:manga.id});
          if (!pages?.length || !pages.every(page=>page.url || page.base64)) {
            throw new Error("正文图片列表为空或缺页");
          }
          if (!pages[0].url) {
            throw new Error("内嵌图片尚需宿主验证");
          }
          return {chapter:chapter.title,pages:pages.length,...image(host.imageRequest(pages[0].url))};
        });
        if (result) {
          readable++;
        }
        if (chapters.length === 1) {
          break;
        }
      }
      if (readable > 0) {
        break;
      }
    }
  }
  const checks=Object.entries(report.checks);
  const readable=checks.some(([name,value])=>/\.(oldest|latest)$/.test(name)&&value.status==="PASS");
  const failed=checks.some(([,value])=>value.status!=="PASS");
  const hints=report.requests.flatMap(req=>req.hints ?? []);
  report.result=readable ? (failed ? "PARTIAL" : "PASS") : hints.includes("访问防护/Cloudflare 验证") ? "ACCESS_BLOCKED" : hints.includes("要求登录/认证") ? "AUTH_REQUIRED" : hints.includes("站点暂停") ? "SITE_PAUSED" : report.requests.some(req=>req.error) ? "NETWORK_UNVERIFIED" : "FAILED";
  report.reason=readable ? (failed ? "部分阅读通过，存在失败步骤，详见记录" : "代表性列表、搜索、详情、目录与真实图片通过") : hints.length ? [...new Set(hints)].join("；") : checks.filter(([,value])=>value.status==="FAILED").map(([name,value])=>`${name}: ${value.error}`).join("；");
}
console.log(JSON.stringify(report,null,2));
