# 当前进度与交接

> 新电脑上的 Codex 请先读根目录 `AGENTS.md`，再读本文件。每次推送前更新本文件并随代码一起提交；实际状态以 Git、代码和 Actions 为准。

## 当前状态

- 更新时间：2026-10-28 16:12（北京时间）。
- 任务状态：**已按用户要求暂停**。用户因额度不足，要求完成当前 HO5HO 后结束本轮；不得自动继续检查下一个源，等待用户重新授权接续。
- 审计范围：33 个源码图源，包含已弃用源；排除用户已实测可用的包子漫画 2（`zh.baozimh2` v7），其余 32 个逐源处理，详见 [逐源审计记录](SOURCE_AUDIT.md)。
- 已处理：14 / 32（PASS 0 / FIXED 3 / SKIP 11），剩余 18 个；下一待处理源为 `src/as/zh.isekai`，尚未开始检查。
- 最近完成：HO5HO v2 修复新列表卡片和详情结构，保留旧结构兼容。关键文件为该源 `src/lib.rs`、`res/source.json`、`tools/source-check/ho5ho.test.mjs` 及 `public/` 对应包、图标和两份索引。
- 验证：release 构建、3 组实际 WASM 回归、24 个发布包一致性校验通过；真实 WASM 请求通过列表 16 项、搜索 1 项、详情、目录 1 章、60 个图片地址，首图 Range 为 JPEG / HTTP 206。未逐一覆盖所有筛选及作品，未做用户设备复测。
- 发布：HO5HO v2 已随 `9a3ec02` 推送，`public/` 已同步，[Actions 发布成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40655056360)。G站 v10 部分修复 `c203232` 也已发布成功，但章节 API Cloudflare 403，仍为 SKIP，不能声称整体可读。
- 已知限制：若干源受 Cloudflare、连接超时或上游关闭影响；SKIP 的证据与未验证项见审计记录。当前普通浏览器工具不可用；构建仍需旧 SDK、nightly wasm 目标和完整仓库检出，命令见下文。
- 接续约定：仅在用户要求继续后，从 ISEKAI 开始串行处理；每完成一个源立即更新交接、提交并推送。不得把仅首页可访问或离线测试通过记为整体可用。
- 本轮收尾：只记录停止位置和已确认发布结果，不新增源检查或功能修改。

## 项目地图

本仓库为 Aidoku 中文图源集合，各站点独立编译为 WebAssembly，再与资源文件一起打包成 `.aix`。

| 位置                                         | 用途                                                 |
| -------------------------------------------- | ---------------------------------------------------- |
| `src/rust/zh.*`                              | 独立 Rust 图源 crate，主体实现使用旧版 Aidoku SDK    |
| `src/as/zh.*`                                | 两份已标记弃用的 AssemblyScript 图源                 |
| `res/source.json`                            | 图源 ID、名称、发布版本、站点地址等资源信息          |
| `public/sources/`                            | 实际供用户下载的 `.aix` 安装包                       |
| `public/icons/`                              | 索引引用的图标                                       |
| `public/index.json`、`public/index.min.json` | 两种格式的图源索引，解析后内容必须一致               |
| `.github/workflows/build.yml`                | 校验发布文件、测试包子漫画 2 插件、部署到 `gh-pages` |

当前有 33 个图源源码目录，其中 24 个未弃用、9 个弃用；发布索引包含 24 个图源。动漫狂经核实已跳转域名出售页，本轮新增弃用并移出当前索引。这是本次检查时的状态，后续增减时同步更新。

## 包子漫画 2 修复背景

症状：漫画详情能显示，进入阅读失败。详情走网页解析，阅读则依赖独立章节 API 和图片服务器。

已完成：

1. API 域名从 `api-get-v2.mgsearcher.com` 更新为 `v2.apikk.top`。
2. 章节图片接口从 `/api/chapter/getinfo` 更新为 `/api/v2/chapter/getinfo`。
3. 支持新图片列表编码：分段重排、每 7 字符交替反转、自定义字符表替换和 Base64 解码；保留旧明文数组兼容。
4. 按返回的 `line` 选择图片域名：`2` 使用 `c-nd2-1.6wm.top`，其他线路使用 `c-nd3-1.6wm.top`；不再使用写死的 `f40-1-4.g-mh.online`。
5. 对旧书架条目缺少数字漫画 ID 的情况，从详情补齐；对空列表、损坏编码和错误图片数据返回错误，避免崩溃或悄悄丢页。

关键文件：

- `src/rust/zh.baozimh2/src/lib.rs`：章节请求、ID 补齐、图片数据解析。
- `src/rust/zh.baozimh2/src/decoder.rs`：解码和图片 URL 生成。
- `src/rust/zh.baozimh2/tests/reader.test.mjs`：直接调用实际 WASM 导出的阅读接口，模拟宿主响应。
- `src/rust/zh.baozimh2/tests/fixtures/images.json`：已与站点原始解码器交叉核对的固定编码样本。
- `src/rust/zh.baozimh2/res/source.json`：版本 7。
- `public/sources/zh.baozimh2-v7.aix`、`public/icons/zh.baozimh2-v7.png`：已发布产物。

## 已完成的验证与发布

| 验证层次               | 结果                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| Rust release 构建      | 通过，目标为 `wasm32-unknown-unknown`                                      |
| 实际 WASM 入口回归测试 | 6 组通过，覆盖编码/明文图片、线路、异常数据、旧书架 ID、章节列表和 Referer |
| 格式与差异检查         | Rustfmt、相关文件 Prettier、`git diff --check` 通过                        |
| 发布文件校验           | 25 个包的 ZIP 完整性、资源版本、图源 ID、语言、图标及 WASM 文件头通过      |
| GitHub Actions         | 发布任务成功，见下方链接                                                   |
| 公开安装包             | 已下载校验，与本地测试包一致                                               |
| 用户设备实测           | 用户确认阅读已恢复                                                         |

相关提交：

- `61d8f02`：阅读修复、回归测试和 v7 安装包。
- `6a7deb6`：修复发布流程，校验并部署已提交的旧版图源包；同步此前不一致的索引。
- 已确认成功的 [Actions 发布任务](https://github.com/umuo/aidoku-zh-sources/actions/runs/40643795880)。交接文档机制已于 `778bf81` 同步；第一阶段逐源审计及包子漫画 1 v6、巴卡漫画 v3 已于 `e002a3c` 发布，Actions 成功：https://github.com/umuo/aidoku-zh-sources/actions/runs/40647224330 。后续本轮变更的发布结果以实际 Actions 为准。

发布仓库为 `umuo/aidoku-zh-sources`。用户订阅入口：

- [添加本仓库图源](https://aidoku.app/add-source-list/?url=https%3A%2F%2Fraw.githubusercontent.com%2Fumuo%2Faidoku-zh-sources%2Fmain%2Fpublic%2F)。
- [公开图源索引](https://raw.githubusercontent.com/umuo/aidoku-zh-sources/main/public/index.min.json)。

README 原有“如何使用”链接仍指向上游 `suiyuran` 仓库。排查用户收不到本仓库更新时，先确认其订阅地址，不能把上游订阅当成本仓库发布地址。

## 新电脑上的验证方式

不要依赖上一台电脑的 `target/`、`node_modules/`、临时文件、绝对路径或聊天记录。`Cargo.lock`、测试样本和 `public/` 中的发布包均已提交到 Git。

先查看实际状态：

```sh
git status --short
git branch --show-current
git remote -v
git log -5 --oneline
```

**直接验证已发布的包**：需要 Python 3 和 Node.js 22，无需重新编译 Rust。在仓库根目录运行：

```sh
python3 - <<'PY'
import os
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZipFile

with tempfile.TemporaryDirectory() as directory:
    wasm = Path(directory) / "baozimh2.wasm"
    with ZipFile("public/sources/zh.baozimh2-v7.aix") as package:
        wasm.write_bytes(package.read("Payload/main.wasm"))
    env = dict(os.environ, BAOZIMH2_WASM_PATH=str(wasm))
    subprocess.run(
        ["node", "src/rust/zh.baozimh2/tests/reader.test.mjs"],
        env=env,
        check=True,
    )
PY
```

**修改 Rust 后重新编译**：需要 Rust nightly、WASM 目标及对应依赖。在仓库根目录运行：

```sh
rustup target add --toolchain nightly wasm32-unknown-unknown
RUSTC="$(rustup which --toolchain nightly rustc)" rustup run nightly cargo build \
    --manifest-path src/rust/zh.baozimh2/Cargo.toml \
    --target wasm32-unknown-unknown --release --locked
node src/rust/zh.baozimh2/tests/reader.test.mjs
rustup run nightly rustfmt --check src/rust/zh.baozimh2/src/lib.rs src/rust/zh.baozimh2/src/decoder.rs
git diff --check
```

显式设置 `RUSTC` 是为了避免部分电脑优先使用其他安装渠道的 `rustc`，导致 nightly 与 WASM 目标不匹配。若尚未安装 nightly，先通过 rustup 安装；不要因为新电脑缺少工具而无依据地更新 SDK 或锁文件。

发布包必须包含 `Payload/main.wasm` 和该图源 `res/` 内的资源。更新图源时同步版本号、`public/sources/`、`public/icons/` 及两份索引，然后按 CI 执行发布校验。只提交 Rust 源码不会自动生成新安装包。

## 已知限制与接续注意

- 本次调试时，命令行访问站点 API 曾触发 Cloudflare 验证；不能仅据此认定设备端不可用，用户实测已确认此次修复有效。
- 当前 CI 部署的是 Git 中的 `public/`，旧根目录 `build.sh` 仍保留原全量构建方式，未经重新验证，不应作为可靠的发布流程直接执行。
- 工作流使用自动提供的 `GITHUB_TOKEN` 和 `contents: write`，本次发布无需手动配置个人 Token。
- 本次只验证了包子漫画 2 阅读，不能据此声称其他 24 个发布图源均可正常访问。

## 里程碑

- 2026-10-28：完成包子漫画 2 v7 修复和发布；用户确认设备端可读。
- 2026-10-28：建立跨电脑交接文档与每次推送前更新规则。

## 后续更新模板

每次推送前更新上面的“当前状态”，并按任务需要更新相关小节；可用下面的条目追加简洁记录：

```text
日期（北京时间）：
当前任务与完成状态：
本轮完成 / 关键文件：
决策及原因：
验证命令与结果 / 未验证项：
已确认的发布版本与提交 / 本轮待发布内容：
已知问题与阻塞：
下一步（没有则写“无”）：
```
