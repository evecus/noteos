package api

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/noteos/noteos/internal/db"
	"github.com/noteos/noteos/internal/model"
)

type Handler struct {
	db      *db.DB
	dataDir string
}

func NewHandler(d *db.DB, dataDir string) *Handler {
	return &Handler{db: d, dataDir: dataDir}
}

// ──────────────────────────────────────────────
// Notes CRUD
// ──────────────────────────────────────────────

func (h *Handler) ListNotes(c *fiber.Ctx) error {
	opts := db.ListOpts{
		Query: c.Query("q"),
		Tag:   c.Query("tag"),
		Page:  c.QueryInt("page", 1),
		Limit: c.QueryInt("limit", 20),
	}
	result, err := h.db.ListNotes(opts)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	return c.JSON(result)
}

func (h *Handler) CreateNote(c *fiber.Ctx) error {
	var req model.CreateNoteReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(400, "invalid request")
	}
	if strings.TrimSpace(req.Content) == "" {
		return fiber.NewError(400, "content cannot be empty")
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}
	note, err := h.db.CreateNote(req)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	return c.Status(201).JSON(note)
}

func (h *Handler) GetNote(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(400, "invalid id")
	}
	note, err := h.db.GetNote(id)
	if err != nil {
		return fiber.NewError(404, "note not found")
	}
	return c.JSON(note)
}

func (h *Handler) UpdateNote(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(400, "invalid id")
	}
	var req model.UpdateNoteReq
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(400, "invalid request")
	}
	if req.Tags == nil {
		req.Tags = []string{}
	}
	note, err := h.db.UpdateNote(id, req)
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	return c.JSON(note)
}

func (h *Handler) DeleteNote(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(400, "invalid id")
	}
	// Remove all associated files from disk
	note, _ := h.db.GetNote(id)
	if note != nil {
		for _, img := range note.Images {
			os.Remove(filepath.Join(h.dataDir, "uploads", img))
		}
		for _, f := range note.Files {
			os.Remove(filepath.Join(h.dataDir, "uploads", f.Filename))
		}
	}
	if err := h.db.DeleteNote(id); err != nil {
		return fiber.NewError(500, err.Error())
	}
	return c.SendStatus(204)
}

// ──────────────────────────────────────────────
// File upload / delete
// ──────────────────────────────────────────────

// allowedExts lists every extension we accept.
// Images, documents, archives, audio/video, code, text.
var allowedExts = map[string]string{
	// Images
	".jpg": "image/jpeg", ".jpeg": "image/jpeg",
	".png": "image/png", ".gif": "image/gif",
	".webp": "image/webp", ".svg": "image/svg+xml",
	// Documents
	".pdf":  "application/pdf",
	".txt":  "text/plain",
	".md":   "text/markdown",
	".csv":  "text/csv",
	".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	// Archives
	".zip": "application/zip",
	".tar": "application/x-tar",
	".gz":  "application/gzip",
	".7z":  "application/x-7z-compressed",
	// Audio / Video
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
	".mp4": "video/mp4", ".webm": "video/webm",
	// Code / misc
	".json": "application/json",
	".xml":  "application/xml",
	".html": "text/html",
	".js":   "text/javascript",
	".ts":   "text/typescript",
	".go":   "text/x-go",
	".py":   "text/x-python",
	".sh":   "text/x-shellscript",
}

const maxFileSize = 50 * 1024 * 1024 // 50 MB

// UploadFile handles POST /api/v1/notes/:id/files
// Accepts a multipart field named "file".
func (h *Handler) UploadFile(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(400, "invalid id")
	}

	fh, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(400, "no file provided (field name: file)")
	}

	if fh.Size > maxFileSize {
		return fiber.NewError(400, fmt.Sprintf("file too large (max %dMB)", maxFileSize/1024/1024))
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	mimeType, ok := allowedExts[ext]
	if !ok {
		// Try to sniff MIME from first 512 bytes
		f, ferr := fh.Open()
		if ferr == nil {
			buf := make([]byte, 512)
			n, _ := f.Read(buf)
			f.Close()
			sniffed := http.DetectContentType(buf[:n])
			if strings.HasPrefix(sniffed, "text/") {
				mimeType = sniffed
				ok = true
			}
		}
		if !ok {
			return fiber.NewError(400, "unsupported file type: "+ext)
		}
	}

	// Fallback: use Go's mime package if needed
	if mimeType == "" {
		mimeType = mime.TypeByExtension(ext)
		if mimeType == "" {
			mimeType = "application/octet-stream"
		}
	}

	uploadDir := filepath.Join(h.dataDir, "uploads")
	os.MkdirAll(uploadDir, 0755)

	// Sanitise original name for storage
	origName := filepath.Base(fh.Filename)
	storedName := fmt.Sprintf("%d_%d%s", id, time.Now().UnixNano(), ext)
	dest := filepath.Join(uploadDir, storedName)

	if err := c.SaveFile(fh, dest); err != nil {
		return fiber.NewError(500, "failed to save file")
	}

	att := model.Attachment{
		Filename: storedName,
		OrigName: origName,
		Size:     fh.Size,
		Mime:     mimeType,
	}

	if err := h.db.AddFile(id, att); err != nil {
		os.Remove(dest)
		return fiber.NewError(500, err.Error())
	}

	return c.Status(201).JSON(fiber.Map{
		"attachment": att,
		"url":        "/uploads/" + storedName,
	})
}

// DeleteFile handles DELETE /api/v1/notes/:id/files/:filename
func (h *Handler) DeleteFile(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(400, "invalid id")
	}
	filename := c.Params("filename")
	if filename == "" || strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		return fiber.NewError(400, "invalid filename")
	}

	// Verify file belongs to this note
	note, err := h.db.GetNote(id)
	if err != nil {
		return fiber.NewError(404, "note not found")
	}
	found := false
	for _, f := range note.Files {
		if f.Filename == filename {
			found = true
			break
		}
	}
	// Also check legacy images
	if !found {
		for _, img := range note.Images {
			if img == filename {
				found = true
				break
			}
		}
	}
	if !found {
		return fiber.NewError(404, "file not found on this note")
	}

	os.Remove(filepath.Join(h.dataDir, "uploads", filename))
	if err := h.db.RemoveFile(id, filename); err != nil {
		return fiber.NewError(500, err.Error())
	}
	return c.SendStatus(204)
}

// ──────────────────────────────────────────────
// Legacy image upload (kept for compat)
// ──────────────────────────────────────────────

func (h *Handler) UploadImage(c *fiber.Ctx) error {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return fiber.NewError(400, "invalid id")
	}
	file, err := c.FormFile("image")
	if err != nil {
		return fiber.NewError(400, "no image provided")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowed[ext] {
		return fiber.NewError(400, "unsupported image type")
	}
	if file.Size > 10*1024*1024 {
		return fiber.NewError(400, "image too large (max 10MB)")
	}
	uploadDir := filepath.Join(h.dataDir, "uploads")
	os.MkdirAll(uploadDir, 0755)
	filename := fmt.Sprintf("%d_%d%s", id, time.Now().UnixNano(), ext)
	dest := filepath.Join(uploadDir, filename)
	if err := c.SaveFile(file, dest); err != nil {
		return fiber.NewError(500, "failed to save image")
	}
	if err := h.db.AddImage(id, filename); err != nil {
		os.Remove(dest)
		return fiber.NewError(500, err.Error())
	}
	return c.JSON(fiber.Map{"filename": filename, "url": "/uploads/" + filename})
}

// ──────────────────────────────────────────────
// Tags & Export
// ──────────────────────────────────────────────

func (h *Handler) ListTags(c *fiber.Ctx) error {
	tags, err := h.db.AllTags()
	if err != nil {
		return fiber.NewError(500, err.Error())
	}
	if tags == nil {
		tags = []string{}
	}
	return c.JSON(tags)
}

func (h *Handler) ExportMarkdown(c *fiber.Ctx) error {
	notes, err := h.db.ExportAll()
	if err != nil {
		return fiber.NewError(500, err.Error())
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	for _, note := range notes {
		fname := fmt.Sprintf("note_%d_%s.md", note.ID, note.CreatedAt.Format("20060102"))
		w, err := zw.Create(fname)
		if err != nil {
			continue
		}

		var sb strings.Builder
		sb.WriteString("---\n")
		sb.WriteString(fmt.Sprintf("id: %d\n", note.ID))
		sb.WriteString(fmt.Sprintf("created: %s\n", note.CreatedAt.Format(time.RFC3339)))
		sb.WriteString(fmt.Sprintf("updated: %s\n", note.UpdatedAt.Format(time.RFC3339)))
		if len(note.Tags) > 0 {
			sb.WriteString(fmt.Sprintf("tags: [%s]\n", strings.Join(note.Tags, ", ")))
		}
		if note.Pinned {
			sb.WriteString("pinned: true\n")
		}
		sb.WriteString("---\n\n")
		sb.WriteString(note.Content)
		sb.WriteString("\n")

		if len(note.Files) > 0 {
			sb.WriteString("\n\n<!-- attachments -->\n")
			for _, f := range note.Files {
				if strings.HasPrefix(f.Mime, "image/") {
					sb.WriteString(fmt.Sprintf("![%s](%s)\n", f.OrigName, f.Filename))
				} else {
					sb.WriteString(fmt.Sprintf("[%s](%s)\n", f.OrigName, f.Filename))
				}
			}
		}

		io.WriteString(w, sb.String())
	}

	zw.Close()

	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=noteos_export_%s.zip", time.Now().Format("20060102_150405")))
	return c.Send(buf.Bytes())
}

