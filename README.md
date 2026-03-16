# 📝 NoteOS

轻量级网页笔记应用，类 Memos 卡片流，单二进制文件，开箱即用。

## ✨ 功能

- 📋 Markdown 渲染卡片流
- 🔍 全文搜索
- 🏷️ 标签系统
- 📌 置顶笔记
- 🖼️ 图片上传
- 📦 导出为 Markdown ZIP
- 🔒 密码保护（Basic Auth）
- 🌙 暗色模式
- 💾 SQLite 单文件存储

## 🚀 快速开始

### 下载预编译版本

从 [Releases](../../releases) 下载对应平台的二进制文件。

```bash
chmod +x noteos-linux-amd64
./noteos-linux-amd64
```

访问 http://localhost:2344

### 命令行参数

```
--port      监听端口 (默认: 2344)
--data      数据目录 (默认: ./data)
--password  启用密码保护 (用户名固定为 noteos)
--version   显示版本号
```

### 示例

```bash
# 基础启动
./noteos-linux-amd64

# 带密码
./noteos-linux-amd64 --password mysecret

# 自定义路径和端口
./noteos-linux-amd64 --port 8080 --data /var/lib/noteos
```

## 🔧 从源码编译

需要 Go 1.21+ 和 GCC（sqlite3 依赖 CGO）：

```bash
git clone https://github.com/yourname/noteos
cd noteos
go build -o noteos .
./noteos
```

## 🗂️ 数据目录结构

```
data/
├── noteos.db       # SQLite 数据库
└── uploads/        # 上传的图片
```

## 🔌 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/notes | 列出笔记（支持 ?q= ?tag= ?page= ?limit=）|
| POST | /api/v1/notes | 创建笔记 |
| GET | /api/v1/notes/:id | 获取单条笔记 |
| PUT | /api/v1/notes/:id | 更新笔记 |
| DELETE | /api/v1/notes/:id | 删除笔记 |
| POST | /api/v1/notes/:id/images | 上传图片 |
| GET | /api/v1/tags | 所有标签 |
| GET | /api/v1/export/markdown | 导出 ZIP |

## 📦 支持平台

| 平台 | 说明 |
|------|------|
| linux/amd64 | 主流 Linux 服务器 |
| linux/arm64 | 树莓派 4/5、NAS |
| linux/armv7 | 树莓派 3、软路由 |
| linux/mipsle | OpenWrt（MT7621 等）|
| darwin/amd64 | macOS Intel |
| darwin/arm64 | macOS Apple Silicon |
| windows/amd64 | Windows 64位 |

## 📜 License

MIT
