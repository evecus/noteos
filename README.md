# NoteOS

轻量级个人网页笔记，单二进制文件，开箱即用，支持 Docker 部署。

---

## 功能特性

- **卡片流**：等高卡片网格，点击查看完整内容
- **Markdown**：编辑和渲染全面支持
- **标题**：每条笔记可设置独立标题
- **标签**：自由打标签，侧边栏快速筛选
- **置顶**：重要笔记固定置顶
- **附件**：支持图片、PDF、文档、压缩包等 20+ 种格式，最大 50MB
- **搜索**：标题 + 内容全文搜索
- **导出**：一键导出全部笔记为 Markdown ZIP
- **登录保护**：bcrypt 密码哈希，Session Cookie 认证，内置限速（5次失败锁定5分钟）
- **CSRF 防护**：所有状态变更接口验证 Token
- **暗色模式**：自动跟随系统或手动切换
- **PWA**：支持添加到手机桌面
- **数据库**：SQLite 单文件，WAL 模式

---

## 快速开始

### 二进制（推荐）

从 [Releases](../../releases) 下载对应平台的文件：

```bash
# Linux
chmod +x noteos-linux-amd64
./noteos-linux-amd64

# 带登录保护
./noteos-linux-amd64 --auth admin:mypassword

# 自定义端口和数据目录
./noteos-linux-amd64 --port 8080 --dir /var/lib/noteos --auth admin:mypassword
```

打开浏览器访问 `http://localhost:2344`

### Docker

```bash

# 带登录认证（推荐用环境变量，避免密码出现在进程列表）
docker run -d \
  --name noteos \
  -p 2344:2344 \
  -v ./data:/data \
  -e CF=true \       #可选
  -e TOKEN=xxx \       #可选
  -e NOTEOS_AUTH=admin:mypassword \
  evecus/noteos:latest
```

### Docker Compose

```yaml
services:
  noteos:
    image: evecus/noteos:latest
    container_name: noteos
    restart: unless-stopped
    ports:
      - "2344:2344"
    volumes:
      - ./data:/data
    environment:
      - NOTEOS_AUTH=admin:mypassword  # 不需要登录则删除此行
```

```bash
docker compose up -d
```

---

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--port` | `2344` | 监听端口 |
| `--dir` | `./data` | 数据目录（存放数据库和上传文件） |
| `--auth` | 无 | 启用登录，格式 `用户名:密码` |
| `--version` | — | 显示版本号并退出 |

**认证优先级**：环境变量 `NOTEOS_AUTH` > 命令行 `--auth` > 无认证

```bash
# 修改密码：重新传 --auth 即可，DB 里的哈希会自动更新
./noteos --auth admin:newpassword --dir /var/lib/noteos

# 取消登录：删除 data/noteos.db 里的 credentials 表记录
sqlite3 data/noteos.db "DELETE FROM credentials;"
```

---

## 数据目录

```
data/
├── noteos.db        # SQLite 数据库（笔记、标签、登录凭据）
└── uploads/         # 上传的附件文件
```

**备份**：只需备份整个 `data/` 目录，或单独备份 `noteos.db` 和 `uploads/`。

---

## API

所有接口前缀 `/api/v1`。启用登录后需要先通过 `/api/auth/login` 获取 Session，状态变更接口需携带 `X-CSRF-Token` Header。

### 笔记

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/notes` | 列出笔记，支持 `?q=` 搜索、`?tag=` 筛选、`?page=`、`?limit=`（最大 100） |
| `POST` | `/notes` | 创建笔记 |
| `GET` | `/notes/:id` | 获取单条笔记 |
| `PUT` | `/notes/:id` | 更新笔记 |
| `DELETE` | `/notes/:id` | 删除笔记 |
| `POST` | `/notes/:id/files` | 上传附件（multipart，字段名 `file`） |
| `DELETE` | `/notes/:id/files/:filename` | 删除附件 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/tags` | 获取所有标签 |
| `GET` | `/export/markdown` | 导出全部笔记为 ZIP（最多 500 条） |
| `POST` | `/api/auth/login` | 登录，Body `{"username":"","password":""}` |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/auth/status` | 获取认证状态 |

### 笔记数据结构

```json
{
  "id": 1,
  "title": "可选标题",
  "content": "Markdown 内容",
  "tags": ["标签1", "标签2"],
  "pinned": false,
  "files": [
    {
      "filename": "1_1700000000_report.pdf",
      "orig_name": "report.pdf",
      "size": 102400,
      "mime": "application/pdf"
    }
  ],
  "created_at": "2026-03-16T19:12:00Z",
  "updated_at": "2026-03-16T19:12:00Z"
}
```

---

## 支持平台

### 二进制

| 文件 | 平台 |
|------|------|
| `noteos-linux-amd64` | Linux x86_64（服务器、VPS） |
| `noteos-linux-arm64` | Linux ARM64（树莓派 4/5、NAS） |
| `noteos-linux-arm-armv7` | Linux ARMv7（树莓派 3、软路由） |
| `noteos-linux-mipsle` | OpenWrt MIPS soft-float（MT7621 等） |
| `noteos-darwin-amd64` | macOS Intel |
| `noteos-darwin-arm64` | macOS Apple Silicon |
| `noteos-windows-amd64.exe` | Windows 64 位 |

### Docker 镜像

| 架构 | 说明 |
|------|------|
| `linux/amd64` | x86_64 服务器 |
| `linux/arm64` | ARM64 服务器、树莓派 4/5 |

---

## 从源码构建

需要 Go 1.21+、GCC（sqlite3 依赖 CGO）：

```bash
git clone https://github.com/yourname/noteos
cd noteos
go mod tidy
go build -tags fts5 -o noteos .
./noteos
```

> `-tags fts5` 必须加，否则启动时报 `no such module: fts5`。

---

## 安全说明

- 密码使用 **bcrypt**（cost=12）哈希存储，数据库泄露也无法直接获取明文
- Session 基于随机 Token（256-bit），Cookie 设置 `HttpOnly` + `SameSite=Lax`
- 登录接口有**限速保护**：同一 IP 5次失败后锁定 5 分钟
- 所有状态变更 API 验证 **CSRF Token**
- 500 错误不向客户端返回内部细节，错误信息只记录在服务端日志
- 建议在公网部署时配合 Nginx/Caddy 添加 HTTPS

---

## License

MIT
