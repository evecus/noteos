package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/basicauth"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/noteos/noteos/internal/api"
	"github.com/noteos/noteos/internal/db"
	"golang.org/x/crypto/bcrypt"
)

//go:embed web/*
var webFS embed.FS

var version = "dev"

func main() {
	var (
		port    = flag.Int("port", 2344, "监听端口")
		dir     = flag.String("dir", "./data", "数据目录")
		auth    = flag.String("auth", "", "启用登录，格式: 用户名:密码  例: noteos:mypass")
		showVer = flag.Bool("version", false, "显示版本号")
	)
	flag.Parse()

	if *showVer {
		fmt.Println("NoteOS", version)
		os.Exit(0)
	}

	// ── 解析 --auth user:pass ──────────────────────────────
	var authUser, authPass string
	if *auth != "" {
		parts := strings.SplitN(*auth, ":", 2)
		if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
			log.Fatal("--auth 格式错误，应为  用户名:密码  例: noteos:mypass")
		}
		authUser = parts[0]
		authPass = parts[1]
	}

	// ── 初始化数据库 ───────────────────────────────────────
	database, err := db.New(*dir)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	// ── 处理密码：存入 / 更新 DB（bcrypt 哈希） ────────────
	if authUser != "" {
		if err := database.SetCredential(authUser, authPass); err != nil {
			log.Fatalf("保存登录信息失败: %v", err)
		}
		log.Printf("🔒 已启用登录保护  用户名: %s", authUser)
	}

	h := api.NewHandler(database, *dir)

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			msg := "internal server error"
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
				msg = e.Message
			}
			return c.Status(code).JSON(fiber.Map{"error": msg})
		},
		BodyLimit: 50 * 1024 * 1024,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${method} ${path} ${status} ${latency}\n",
	}))
	app.Use(cors.New())

	// ── Basic Auth 中间件：从 DB 验证 bcrypt 哈希 ──────────
	// 只要 DB 里存有凭据就启用（无论本次启动是否传 --auth）
	if database.HasCredential() {
		app.Use(basicauth.New(basicauth.Config{
			Authorizer: func(user, pass string) bool {
				hash, err := database.GetCredentialHash(user)
				if err != nil {
					return false
				}
				return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pass)) == nil
			},
			Unauthorized: func(c *fiber.Ctx) error {
				c.Set("WWW-Authenticate", `Basic realm="NoteOS"`)
				return c.Status(fiber.StatusUnauthorized).SendString("请输入用户名和密码")
			},
		}))
	}

	// ── 静态文件：上传目录 ─────────────────────────────────
	uploadsDir := filepath.Join(*dir, "uploads")
	os.MkdirAll(uploadsDir, 0755)
	app.Static("/uploads", uploadsDir)

	// ── 嵌入的 Web UI ──────────────────────────────────────
	webSub, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}
	app.Use("/", func(c *fiber.Ctx) error {
		if strings.HasPrefix(c.Path(), "/api") {
			return c.Next()
		}
		if c.Path() != "/" {
			if f, err := webSub.Open(c.Path()[1:]); err == nil {
				f.Close()
			} else {
				c.Set("Content-Type", "text/html")
				data, _ := webFS.ReadFile("web/index.html")
				return c.Send(data)
			}
		}
		_ = http.FS(webSub)
		data, err := webFS.ReadFile("web" + c.Path())
		if err != nil {
			data, _ = webFS.ReadFile("web/index.html")
		}
		switch filepath.Ext(c.Path()) {
		case ".js":
			c.Set("Content-Type", "application/javascript")
		case ".css":
			c.Set("Content-Type", "text/css")
		default:
			c.Set("Content-Type", "text/html")
		}
		return c.Send(data)
	})

	// ── API 路由 ───────────────────────────────────────────
	apiv1 := app.Group("/api/v1")
	apiv1.Get("/notes", h.ListNotes)
	apiv1.Post("/notes", h.CreateNote)
	apiv1.Get("/notes/:id", h.GetNote)
	apiv1.Put("/notes/:id", h.UpdateNote)
	apiv1.Delete("/notes/:id", h.DeleteNote)
	apiv1.Post("/notes/:id/images", h.UploadImage)
	apiv1.Post("/notes/:id/files", h.UploadFile)
	apiv1.Delete("/notes/:id/files/:filename", h.DeleteFile)
	apiv1.Get("/tags", h.ListTags)
	apiv1.Get("/export/markdown", h.ExportMarkdown)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("🚀 NoteOS %s  http://0.0.0.0%s", version, addr)
	log.Printf("📁 数据目录: %s", *dir)
	log.Fatal(app.Listen(addr))
}

