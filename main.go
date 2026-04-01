package main

import (
	"crypto/rand"
	"embed"
	"encoding/hex"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/session"
	"github.com/noteos/noteos/internal/api"
	"github.com/noteos/noteos/internal/db"
	"golang.org/x/crypto/bcrypt"
)

//go:embed web/dist web/static
var webFS embed.FS

var version = "dev"

var sessionStore *session.Store

// ── 登录限速：IP 级别，5次失败锁定5分钟 ──────────────────
type loginAttempt struct {
	count     int
	lockedAt  time.Time
	lastTry   time.Time
}

var (
	loginMu       sync.Mutex
	loginAttempts = make(map[string]*loginAttempt)
)

const (
	maxLoginFails   = 5
	lockDuration    = 5 * time.Minute
	attemptWindow   = 15 * time.Minute
)

func checkLoginRate(ip string) (allowed bool, remaining int, lockLeft time.Duration) {
	loginMu.Lock()
	defer loginMu.Unlock()

	a, ok := loginAttempts[ip]
	if !ok {
		loginAttempts[ip] = &loginAttempt{}
		return true, maxLoginFails, 0
	}
	// 超过尝试窗口，重置
	if time.Since(a.lastTry) > attemptWindow {
		a.count = 0
		a.lockedAt = time.Time{}
	}
	// 检查是否被锁定
	if !a.lockedAt.IsZero() {
		left := lockDuration - time.Since(a.lockedAt)
		if left > 0 {
			return false, 0, left
		}
		// 锁定已到期，重置
		a.count = 0
		a.lockedAt = time.Time{}
	}
	return true, maxLoginFails - a.count, 0
}

func recordLoginFail(ip string) {
	loginMu.Lock()
	defer loginMu.Unlock()
	a, ok := loginAttempts[ip]
	if !ok {
		a = &loginAttempt{}
		loginAttempts[ip] = a
	}
	a.count++
	a.lastTry = time.Now()
	if a.count >= maxLoginFails {
		a.lockedAt = time.Now()
		log.Printf("🔐 登录锁定: IP %s 失败 %d 次，锁定 %v", ip, a.count, lockDuration)
	}
}

func resetLoginAttempt(ip string) {
	loginMu.Lock()
	defer loginMu.Unlock()
	delete(loginAttempts, ip)
}

// 定期清理过期记录（防内存泄漏）
func startCleanup() {
	go func() {
		for range time.Tick(10 * time.Minute) {
			loginMu.Lock()
			for ip, a := range loginAttempts {
				expired := a.lockedAt.IsZero() && time.Since(a.lastTry) > attemptWindow
				lockExpired := !a.lockedAt.IsZero() && time.Since(a.lockedAt) > lockDuration*2
				if expired || lockExpired {
					delete(loginAttempts, ip)
				}
			}
			loginMu.Unlock()
		}
	}()
}

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

	// ── 解析 --auth user:pass，优先用环境变量 NOTEOS_AUTH ──
	if *auth == "" {
		*auth = os.Getenv("NOTEOS_AUTH")
	}
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

	// ── Session Store（SQLite 持久化，重启后会话不丢失） ───
	sessionStore = session.New(session.Config{
		Expiration:     24 * time.Hour,
		CookieName:     "noteos_sid",
		CookieSecure:   false,
		CookieHTTPOnly: true,
		CookieSameSite: "Lax",
		KeyGenerator:   func() string { return randomToken() },
	})

	startCleanup()

	h := api.NewHandler(database, *dir)

	app := fiber.New(fiber.Config{
		// 生产环境：统一返回模糊错误，避免泄露内部信息
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			msg := "服务器内部错误"
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
				// 4xx 错误可以返回具体信息，5xx 只返回通用提示
				if code < 500 {
					msg = e.Message
				} else {
					log.Printf("SERVER ERROR %s %s: %s", c.Method(), c.Path(), e.Message)
				}
			}
			return c.Status(code).JSON(fiber.Map{"error": msg})
		},
		BodyLimit: 50 * 1024 * 1024,
	})

	app.Use(recover.New())
	app.Use(cors.New())

	// ── CSRF 中间件（保护状态变更接口） ────────────────────
	app.Use(csrfMiddleware)

	// ── 上传目录 ───────────────────────────────────────────
	uploadsDir := filepath.Join(*dir, "uploads")
	os.MkdirAll(uploadsDir, 0755)

	// ── 登录 / 登出 API（无需认证） ────────────────────────
	app.Post("/api/auth/login", makeLoginHandler(database))
	app.Post("/api/auth/logout", makeLogoutHandler())
	app.Get("/api/auth/status", makeStatusHandler(database))

	// ── 预加载 dist 子 FS ──────────────────────────────────
	distSub, err := fs.Sub(webFS, "web/dist")
	if err != nil {
		log.Fatal(err)
	}
	staticSub, err := fs.Sub(webFS, "web/static")
	if err != nil {
		log.Fatal(err)
	}
	indexHTML, _ := fs.ReadFile(distSub, "index.html")

	// ── 无需认证：静态资源 + /login ───────────────────────
	// /static/* → web/static（icons、manifest 等）
	app.Use("/static", func(c *fiber.Ctx) error {
		p := strings.TrimPrefix(c.Path(), "/static/")
		data, err2 := fs.ReadFile(staticSub, p)
		if err2 != nil {
			return c.Status(404).SendString("not found")
		}
		setMime(c, p)
		return c.Send(data)
	})

	// /assets/* → web/dist/assets（Vite hash 文件）
	app.Use("/assets", func(c *fiber.Ctx) error {
		p := strings.TrimPrefix(c.Path(), "/")
		data, err2 := fs.ReadFile(distSub, p)
		if err2 != nil {
			return c.Status(404).SendString("not found")
		}
		setMime(c, p)
		return c.Send(data)
	})

	// /login → index.html（Vue Router 渲染 LoginView，无需认证）
	app.Get("/login", func(c *fiber.Ctx) error {
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(indexHTML)
	})

	// ── 认证中间件（只在 DB 有凭据时启用） ────────────────
	if database.HasCredential() {
		app.Use(authMiddleware)
	}

	// ── 静态上传目录（认证后） ─────────────────────────────
	app.Static("/uploads", uploadsDir)

	// ── 所有其他前端路由 → index.html（SPA fallback） ─────
	app.Use("/", func(c *fiber.Ctx) error {
		if strings.HasPrefix(c.Path(), "/api") {
			return c.Next()
		}
		c.Set("Content-Type", "text/html; charset=utf-8")
		return c.Send(indexHTML)
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

// ── CSRF 中间件 ────────────────────────────────────────────────────────────
// 登录后在 cookie 里写一个 csrf_token，前端每次状态变更请求带上
// X-CSRF-Token header，服务端比对。
// 放行：GET/HEAD/OPTIONS（幂等）、/api/auth/*（登录本身不需要）
func csrfMiddleware(c *fiber.Ctx) error {
	method := c.Method()
	// 幂等方法放行
	if method == "GET" || method == "HEAD" || method == "OPTIONS" {
		return c.Next()
	}
	// 认证接口放行（登录时还没有 CSRF token）
	if strings.HasPrefix(c.Path(), "/api/auth/") {
		return c.Next()
	}
	// 无需认证时也不需要 CSRF（没有保护的意义）
	if c.Path() == "/login" {
		return c.Next()
	}

	// 获取 cookie 里的 token
	cookieToken := c.Cookies("csrf_token")
	// 获取 header 里的 token
	headerToken := c.Get("X-CSRF-Token")

	if cookieToken == "" || headerToken == "" || cookieToken != headerToken {
		return c.Status(403).JSON(fiber.Map{"error": "CSRF 验证失败"})
	}
	return c.Next()
}

// ── Auth handlers ──────────────────────────────────────────────────────────

func makeLoginHandler(database *db.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()

		// 限速检查
		allowed, _, lockLeft := checkLoginRate(ip)
		if !allowed {
			return c.Status(429).JSON(fiber.Map{
				"error": fmt.Sprintf("登录失败次数过多，请 %.0f 分钟后再试", lockLeft.Minutes()+1),
			})
		}

		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BodyParser(&body); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "参数错误"})
		}

		hash, err := database.GetCredentialHash(body.Username)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)) != nil {
			recordLoginFail(ip)
			// 固定延迟防时序攻击
			time.Sleep(300 * time.Millisecond)
			return c.Status(401).JSON(fiber.Map{"error": "用户名或密码错误"})
		}

		// 登录成功，重置限速
		resetLoginAttempt(ip)

		// 生成 session
		sess, err := sessionStore.Get(c)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "session 错误"})
		}
		sess.Set("user", body.Username)
		if err := sess.Save(); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "session 保存失败"})
		}

		// 生成 CSRF token 写入 cookie（非 HttpOnly，JS 需要读取）
		csrfToken := randomToken()
		c.Cookie(&fiber.Cookie{
			Name:     "csrf_token",
			Value:    csrfToken,
			Path:     "/",
			HTTPOnly: false, // JS 必须能读取
			SameSite: "Lax",
			MaxAge:   86400,
		})

		return c.JSON(fiber.Map{"ok": true, "username": body.Username})
	}
}

func makeLogoutHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		sess, _ := sessionStore.Get(c)
		sess.Destroy()
		// 清除 CSRF cookie
		c.Cookie(&fiber.Cookie{
			Name:    "csrf_token",
			Value:   "",
			MaxAge:  -1,
			Path:    "/",
		})
		return c.JSON(fiber.Map{"ok": true})
	}
}

func makeStatusHandler(database *db.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
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

// authMiddleware 保护所有路由
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

func setMime(c *fiber.Ctx, path string) {
	switch filepath.Ext(path) {
	case ".js":
		c.Set("Content-Type", "application/javascript; charset=utf-8")
	case ".css":
		c.Set("Content-Type", "text/css; charset=utf-8")
	case ".svg":
		c.Set("Content-Type", "image/svg+xml")
	case ".png":
		c.Set("Content-Type", "image/png")
	case ".ico":
		c.Set("Content-Type", "image/x-icon")
	case ".json":
		c.Set("Content-Type", "application/json")
	case ".webmanifest":
		c.Set("Content-Type", "application/manifest+json")
	default:
		c.Set("Content-Type", "text/html; charset=utf-8")
	}
}

func randomToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
