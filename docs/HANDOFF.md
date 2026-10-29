# 当前进度与交接

> 新电脑上的 Codex 请先读根目录 `AGENTS.md`，再读本文件。每次推送前更新本文件并随代码一起提交；实际状态以 Git、代码和 Actions 为准。

## 当前状态

- 更新时间：2026-10-29 23:01（北京时间）。
- 当前任务：根据用户实际反馈修正健康报告。**包子漫画 1：在 Aidoku 手动完成浏览器验证后可正常使用；包子漫画 2：用户明确确认正常使用。两者均从待修清单移除。**
- 修改：`docs/SOURCE_HEALTH.md`、两份包子漫画 JSON 和 README 使用说明；原 CLI 检查步骤、请求和包指纹保留不变，自动结论转存 `automatedAssessment`，当前结论为 `USER_CONFIRMED`，记录用户确认时间与证据来源。不能将用户确认冒充自动检查通过。
- 当前 25 个索引源结合用户反馈：可用 5（3 个实站通过、2 个用户确认）；部分可读 1；访问受限待验证 5；登录受限 3；网络受限待验证 10；接口异常 1。原检测快照保留，9 个弃用源及已下架韩漫库单独记录。
- 验证：两份 JSON 可解析，原 `checks`、`requests`、`package` 与上次提交完全一致；报告状态、统计及维修清单与用户反馈一致，差异检查通过。本轮仅文档更新，未重新进行网络/设备测试，不需编译或修改发布包。
- 最近发布：韩漫库移出双索引的 `61da947` [Actions 成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40896067100)，CDN 两份索引均已复查为 25 项且无 `zh.se8`。顶漫画 v1 `0040a94` 已发布且用户确认可用。本轮 `public/` 无变更，无需同步索引或安装包。
- 推送：本次文档修正待提交推送与 Actions 核对；此前健康报告 `09382e1` 已成功发布。原 35 / 35 源检测已完成，检查工具 42 组回归已通过。
- 环境：本轮仅需 Python 3 更新与验证文档；未读取用户凭据、改变 App 设置或本机服务。
- 下一步：核对本次记录推送和 CI；此反馈修正无其他待办。其余维修留待后续，详见健康报告，包子漫画 1/2 无需维修。

## 已完成的原逐源审计（保留远程最终交接）

- 更新时间：2026-10-29 09:02（北京时间）。
- 任务状态：**本轮全部图源审计已完成**。33 个源码图源中，包子漫画 2（`zh.baozimh2` v7）按用户要求排除，其余 **32 / 32** 均已处理；结果为 PASS 4 / FIXED 6 / SKIP 22，无待检查源。
- 结果说明：PASS/FIXED 均有代表性完整阅读证据；SKIP 为已调查并记录无法恢复的访问、认证、地区或上游异常，不代表可用，也不一概认定永久关闭。每项证据和未验证范围见 [逐源审计记录](SOURCE_AUDIT.md)。
- 修复并验证：包子漫画1 v6、哔哩漫画 v5、HO5HO v2、漫小肆韩漫 v7（实际 ID `zh.msxhm`）、绅士漫画 v5、zero搬运网 v9。巴卡 v3、拷贝 v13、G站 v10 仅部分兼容修复，仍计 SKIP，完整阅读受限。
- 无需修改而通过：Komiic v3、漫画人 v2、漫客栈 v1、再漫画 v1。动漫狂原域名出售，已弃用并移出当前索引；其他弃用源未经完整验证不恢复发布。
- 最后修复：zero v9 兼容官方新域名、新旧布局及图片脚本；精确迁移失效旧默认地址，保留用户自定义地址和书架 ID。关键文件为该源 `src/lib.rs`、`src/helper.rs`、资源、`tools/source-check/zerobywns.test.mjs` 和 `public/`。
- 最终验证：33 个源码目录与审计表、32 条详细记录逐一对应，无 PENDING/IN_PROGRESS；34 组实际 WASM 回归通过（含既有包子漫画 2 的 6 组 CI 回归，未重新审计或修改该源）；24 个发布包 ZIP/版本/ID/图标/索引一致性通过，相关 Rustfmt、Prettier、差异检查通过。
- 实站边界：按源取代表性列表/搜索、详情、章节及首图，不批量下载漫画。绅士漫画等个别站点 CLI 被拦截时，以正常浏览器真实图片加载交叉验证；设备端仅包子漫画 2 有用户明确确认，不把服务器检查等同于所有设备可读。
- 已确认发布：zero v9 提交 `5192214`，[Actions 成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40797580302)；绅士漫画 v5 `19ab802`，[Actions 成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40796551643)；漫小肆 v7 `b51cb4a`，[Actions 成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40795138367)。三份部署后安装包 SHA-256 与本地测试包一致，包内版本/ID 正确；`public/` 已同步。
- 更新检测：用户实际订阅本仓库 jsDelivr `@main/public/`，地址正确。最终两份索引 purge 均 finished，CF/FY 返回成功，复查 CDN 索引含漫小肆 v7、绅士漫画 v5、zero v9。CDN 清理不清除 App 本地缓存；README 已补正确入口及缓存说明，仍未收到设备刷新结果。
- 环境与工具：Node.js 22、Python 3.11+、Rust nightly + wasm 目标；命令见下文。检查器已补日期 ABI、禁止 curl URL 展开和查询参数脱敏。普通浏览器现可用；工具差异不能直接当成站点失败。
- 后续待办：**无**。将来如需重试 SKIP 项，先提供正常访问或有效认证条件，再按具体记录复核；不自动重新启动长期任务。本次仅提交最终结果和交接收尾，发布产物不再变更。

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

当前有 35 个图源源码目录，其中 26 个未弃用、9 个弃用；当前发布索引包含 25 个图源（顶漫画 v1 已发布，韩漫库因站点暂停移出索引）。动漫狂经核实已跳转域名出售页，本轮新增弃用并移出当前索引。这是本次检查时的状态，后续增减时同步更新。

## 顶漫画 v1 本轮记录

- 2026-10-29：候选网站去重后仅新增 `zh.dingmanhua`，跳过 Aidoku Community 已有的 MangaBZ 及已有的再漫画。
- 完整目录通过 `POST /comic/{id}` 获取，避免网页 25 章限制；不执行站点 JavaScript，根据阅读页字面量生成图片 URL，零起始页序并设置 Referer。拼音地址保留书架 ID，并从详情章节链接解析数字 ID，用于完整目录和正文请求。
- 真实安装包已完成代表性完整阅读检查；首次自动化测试发现脚本文本接口合并换行，改用 `Node::data()` 后 6 组新增测试及实站完整链路通过。
- 拼音地址作品《十歲的最強魔導師》实站通过详情、25 章完整目录、首章 18 页及 HTTP 206 / WebP 首图。
- 已发布：提交 `0040a94`（`feat: add Dingmanhua source`），[Actions 成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40887549188)，部署包与本地测试包一致。2026-10-29 用户明确确认此源可用；包、图标与双索引已同步。

## 瓜子漫画 v1 本轮记录


- 2026-10-29：根据用户指定网站新增 `zh.guazimanhua`，仅执行本次接入；同步远程后确认原逐源审计已完成。图标取自站点公开 favicon。
- 《从姑获鸟开始》（ID `14109`）的实际 WASM 完整链路通过；图片扩展名虽为 `.webp`，实站返回 JPEG，验证依据真实字节而非扩展名。
- 额外实站抽查：第二页 36 项、热血/更新组合筛选和《一人之下》搜索/详情通过；其目录为 812 个不重复章节，首章 18 页、最新章 19 页，两章首图均 HTTP 206 / JPEG。首次扩展抽查的图片 CDN 出现一次 TLS 连接错误，随后定向重试成功；这属于网络波动，不能保证所有网络环境稳定。
- 已发布：安装包为 `public/sources/zh.guazimanhua-v1.aix`，图标和两份索引均已同步。提交 `2b0ce76`（`feat: add Guazi Manga source`）已推送，[Actions 成功](https://github.com/umuo/aidoku-zh-sources/actions/runs/40865229467)，设备验证待用户进行。
- 新源编译使用 `nightly-2025-01-01`；不要直接套用下文其他源的滚动 nightly 命令。设置好外置盘 `CARGO_HOME` / `RUSTUP_HOME` 并将 Cargo 的 `bin` 加入 PATH 后，在仓库根目录执行：

```sh
RUSTC="$(rustup which --toolchain nightly-2025-01-01 rustc)" \
    cargo +nightly-2025-01-01 build \
    --manifest-path src/rust/zh.guazimanhua/Cargo.toml \
    --target wasm32-unknown-unknown --release --locked
node --test tools/source-check/guazimanhua.test.mjs
node tools/source-check/audit.mjs zh.guazimanhua
```

回归测试和默认实站检查读取 `public/` 的包；修改后需要先重新打包，避免误测旧产物。正式新版本用 `tools/source-check/package.py` 同步版本、安装包、图标和索引。

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

README 的“如何使用”已更正为本仓库 `umuo` 的添加链接和手动订阅地址。此前链接指向上游 `suiyuran`，已添加的旧订阅仍需在 App 中自行切换；不能把上游订阅当成本仓库发布地址。

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
- 2026-10-29：完成全部 32 项逐源审计，4 PASS / 6 FIXED / 22 SKIP；最终发布、远端安装包和 CDN 索引核对通过。

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
