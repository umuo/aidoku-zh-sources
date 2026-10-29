# 全部漫画源健康检测

更新时间：2026-10-29 22:38（北京时间）。已完成 35 / 35。

本轮仅检测并标注原因，修复留待后续统一安排。覆盖当前 26 个发布源和 9 个已弃用源；使用实际发布包、仓库默认地址及匿名配置，不读取用户设备凭据。顶漫画用户已确认可用，包子漫画 2 也有既往设备确认；本轮依然复查。

“可读”表示代表性作品的真实图片响应通过，不代表站内每部作品/付费章节可读。“访问防护拦截”和“网络受限”均不能推断图源逻辑损坏；“已弃用/未发布”仅复查原入口，未重新编译恢复。“部分可读”保留失败步骤，不掩盖搜索或章节限制。

## 结果总表

| 图源 | 版本 | 发布 | 本轮状态 | 原因与证据 |
| --- | --- | --- | --- | --- |
| [139漫画](source-health/2026-10-29/zh.139mh.json) | v1 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP 410  |
| [18漫画](source-health/2026-10-29/zh.18mh.json) | v1 | 是 | 链路失败，待排查 | list: 漫画列表为空 |
| [无敌漫画](source-health/2026-10-29/zh.55dmh.json) | v2 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.55dmh.com:443; OpenSSL 复查：<urlopen error [Errno 54] Connection reset by peer> |
| [巴卡漫画](source-health/2026-10-29/zh.bakamh.json) | v3 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to bakamh.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [包子漫画1](source-health/2026-10-29/zh.baozimh1.json) | v6 | 是 | 访问防护拦截 | 访问防护/Cloudflare 验证 |
| [包子漫画2](source-health/2026-10-29/zh.baozimh2.json) | v7 | 是 | 网络受限，未验证 | search: HTTP request failed: curl: (28) Connection timed out after 25010 milliseconds; OpenSSL 复查：<urlopen error _ssl.c:1064: The handshake operation timed out>；sample1.details: 详情缺少标题或漫画 ID；sample2.chapters: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to baozimh.org:443; OpenSSL 复查：<urlopen error _ssl.c:1064: The handshake operation timed out> |
| [哔哩漫画](source-health/2026-10-29/zh.bilicomic.json) | v5 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.bilimanga.net:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [动漫狂](source-health/2026-10-29/zh.cartoonmad.json) | v2 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.cartoonmad.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [拷贝漫画](source-health/2026-10-29/zh.copymanga.json) | v13 | 是 | 网络受限，未验证 | sample1.details: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.mangacopy.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)>；sample2.details: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.mangacopy.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [顶漫画](source-health/2026-10-29/zh.dingmanhua.json) | v1 | 是 | 可读 | 代表性列表、搜索、详情、目录与真实图片通过 |
| [漫画狗](source-health/2026-10-29/zh.dogemanga.json) | v1 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP 200  |
| [G站漫画](source-health/2026-10-29/zh.godamanga.json) | v10 | 是 | 访问防护拦截 | HTTP 403 访问被拒绝 |
| [瓜子漫画](source-health/2026-10-29/zh.guazimanhua.json) | v1 | 是 | 可读 | 代表性列表、搜索、详情、目录与真实图片通过 |
| [古风漫画](source-health/2026-10-29/zh.gufengmh.json) | v3 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.gufengmh.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [Hanime1.me](source-health/2026-10-29/zh.hanime1.json) | v3 | 是 | 访问防护拦截 | 访问防护/Cloudflare 验证 |
| [嗨皮漫画](source-health/2026-10-29/zh.happymh.json) | v1 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to m.happymh.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [HO5HO](source-health/2026-10-29/zh.ho5ho.json) | v2 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.ho5ho.com:443; OpenSSL 复查：<urlopen error [Errno 54] Connection reset by peer> |
| [ISEKAI](source-health/2026-10-29/zh.isekai.json) | v1 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to isekai.ch:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [Komiic漫画](source-health/2026-10-29/zh.komiic.json) | v3 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to komiic.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [哔咔漫画](source-health/2026-10-29/zh.manhuabika.json) | v1 | 是 | 需登录验证 | 现有源要求账号/会话；未使用默认示例账号或用户凭据，登录后的完整阅读未验证 |
| [漫画DB](source-health/2026-10-29/zh.manhuadb.json) | v1 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.manhuadb.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [漫画人](source-health/2026-10-29/zh.manhuaren.json) | v2 | 是 | 链路失败，待排查 | 业务接口错误：服务器内部错误 |
| [喵上漫画](source-health/2026-10-29/zh.miaoshangmanhua.json) | v5 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.miaoshangmanhua.cc:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [漫客栈](source-health/2026-10-29/zh.mkzhan.json) | v1 | 是 | 部分可读 | 部分阅读通过，存在失败步骤，详见记录 |
| [漫小肆韩漫](source-health/2026-10-29/zh.mxshm.json) | v7 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to www.mxs13.cc:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [MYCOMIC](source-health/2026-10-29/zh.mycomic.json) | v2 | 是 | 访问防护拦截 | 访问防护/Cloudflare 验证 |
| [Nico](source-health/2026-10-29/zh.nicohub.json) | v1 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP 401 要求登录/认证 |
| [NoyAcg](source-health/2026-10-29/zh.noy1.json) | v3 | 是 | 需登录验证 | 现有源要求账号/会话；未使用默认示例账号或用户凭据，登录后的完整阅读未验证 |
| [韩漫库](source-health/2026-10-29/zh.se8.json) | v3 | 是 | 站点暂停 | 站点暂停 |
| [vomic漫画](source-health/2026-10-29/zh.vomicmh.json) | v1 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP 200  |
| [绅士漫画](source-health/2026-10-29/zh.wnacg.json) | v5 | 是 | 网络受限，未验证 | sample1.oldest: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to img5.wnimg2.cfd:443; OpenSSL 复查未完成；sample2.oldest: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to img5.wnimg2.cfd:443; OpenSSL 复查未完成 |
| [言耽社](source-health/2026-10-29/zh.yandanshe.json) | v1 | 是 | 网络受限，未验证 | list: HTTP request failed: curl: (35) LibreSSL SSL_connect: SSL_ERROR_SYSCALL in connection to yandanshe.com:443; OpenSSL 复查：<urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING] EOF occurred in violation of protocol (_ssl.c:1082)> |
| [野蛮漫画](source-health/2026-10-29/zh.yemancomic.json) | v1 | 否 | 已弃用/未发布 | 已弃用，当前订阅列表无安装包；仅复查原入口，未将首页可访问视为阅读正常；原入口 HTTP 200  |
| [再漫画](source-health/2026-10-29/zh.zaimanhua.json) | v1 | 是 | 可读 | 代表性列表、搜索、详情、目录与真实图片通过 |
| [zero搬运网](source-health/2026-10-29/zh.zerobywns.json) | v9 | 是 | 需登录验证 | 要求登录/认证 |

## 证据与维修安排

- 逐源 JSON 保存检查时间、当前包 SHA-256、每个步骤结果和脱敏请求信息；网络异常时不伪造成功。
- 可安装源从列表和搜索推进到详情、完整目录、首章/最新章及真实图片。首个样本失败时最多换第二部作品；图片只做小范围探测，不下载整章。
- 无账号条件的哔咔、NoyAcg 仅作匿名接口检查，认证后的阅读待用户在 App 配置有效账号后复测。
- 维修优先级：先处理有正常站点响应但解析/目录/图片失败的源；认证、访问防护、网络和上游停站分别处理，勿用猜测域名替换。
- 旧审计及修复历史保留在 [SOURCE_AUDIT.md](SOURCE_AUDIT.md)，不把旧 PASS 直接当作本轮检测结果。

## 当前接续位置

- 已处理：35 / 35。
- 最近完成：`zh.mxshm`。
- 下一项：无。
- 汇总：已弃用/未发布 9；访问防护拦截 4；网络受限，未验证 12；可读 3；链路失败，待排查 2；需登录验证 3；站点暂停 1；部分可读 1。
