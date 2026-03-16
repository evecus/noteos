package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/session"
	"github.com/noteos/noteos/internal/api"
	"github.com/noteos/noteos/internal/db"
	"golang.org/x/crypto/bcrypt"
)

//go:embed web/*
var webFS embed.FS

var version = "dev"

// sessionStore is the global session store (in-memory, sufficient for single-user).
var sessionStore *session.Store

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

	// ── 存储凭据 ───────────────────────────────────────────
	if authUser != "" {
		if err := database.SetCredential(authUser, authPass); err != nil {
			log.Fatalf("保存登录信息失败: %v", err)
		}
		log.Printf("🔒 已启用登录保护  用户名: %s", authUser)
	}

	// ── Session Store（内存，24h 过期） ────────────────────
	sessionStore = session.New(session.Config{
		Expiration:   24 * time.Hour,
		CookieName:   "noteos_sid",
		CookieSecure: false, // 局域网 HTTP 也能用
		CookieHTTPOnly: true,
		CookieSameSite: "Lax",
	})

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
	app.Use(cors.New())

	// ── 上传目录 ───────────────────────────────────────────
	uploadsDir := filepath.Join(*dir, "uploads")
	os.MkdirAll(uploadsDir, 0755)

	// ── 登录 / 登出 API（无需认证） ────────────────────────
	app.Post("/api/auth/login", makeLoginHandler(database))
	app.Post("/api/auth/logout", makeLogoutHandler())
	app.Get("/api/auth/status", makeStatusHandler(database))

	// ── 登录页静态资源（无需认证） ─────────────────────────
	app.Get("/login", serveLogin)
	app.Get("/static/login.css", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "text/css")
		data, _ := webFS.ReadFile("web/static/login.css")
		return c.Send(data)
	})

	// ── 认证中间件（只在 DB 有凭据时启用） ────────────────
	if database.HasCredential() {
		app.Use(authMiddleware)
	}

	// ── 上传目录 & Web UI（需认证） ────────────────────────
	app.Static("/uploads", uploadsDir)

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

// ── Auth handlers ──────────────────────────────────────────────────────────

func makeLoginHandler(database *db.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "参数错误"})
		}
		hash, err := database.GetCredentialHash(body.Username)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
			// 固定延迟防止枚举
			time.Sleep(300 * time.Millisecond)
			return c.Status(401).JSON(fiber.Map{"error": "用户名或密码错误"})
		}
		// 生成 session
		sess, err := sessionStore.Get(c)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "session 错误"})
		}
		token := randomToken()
		sess.Set("user", body.Username)
		sess.Set("token", token)
		if err := sess.Save(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "session 保存失败"})
		}
		return c.JSON(fiber.Map{"ok": true, "username": body.Username})
	}
}

func makeLogoutHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		sess, _ := sessionStore.Get(c)
		sess.Destroy()
		return c.JSON(fiber.Map{"ok": true})
	}
}

func makeStatusHandler(database *db.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 无凭据 = 未开启保护
		if !database.HasCredential() {
			return c.JSON(fiber.Map{"protected": false})
		}
		sess, _ := sessionStore.Get(c)
		user := sess.Get("user")
		if user == nil {
			return c.JSON(fiber.Map{"protected": true, "loggedIn": false})
		}
		return c.JSON(fiber.Map{"protected": true, "loggedIn": true, "username": user})
	}
}

// authMiddleware 保护所有路由。
// 放行：/api/auth/*、/login、/static/*（登录页需要加载 CSS 和图标）
func authMiddleware(c *fiber.Ctx) error {
	path := c.Path()
	if strings.HasPrefix(path, "/api/auth/") ||
		path == "/login" ||
		strings.HasPrefix(path, "/static/") {
		return c.Next()
	}
	sess, err := sessionStore.Get(c)
	if err != nil || sess.Get("user") == nil {
		if strings.HasPrefix(path, "/api/") {
			return c.Status(401).JSON(fiber.Map{"error": "未登录"})
		}
		return c.Redirect("/login", fiber.StatusFound)
	}
	return c.Next()
}

func serveLogin(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/html")
	data, _ := webFS.ReadFile("web/login.html")
	return c.Send(data)
}

func randomToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
