package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/noteos/noteos/internal/model"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type DB struct {
	conn *sql.DB
}

func New(dataDir string) (*DB, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dbPath := filepath.Join(dataDir, "noteos.db")
	conn, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_foreign_keys=on")
	if err != nil {
		return nil, err
	}
	d := &DB{conn: conn}
	return d, d.migrate()
}

func (d *DB) migrate() error {
	_, err := d.conn.Exec(`
		CREATE TABLE IF NOT EXISTS notes (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			title      TEXT    NOT NULL DEFAULT '',
			content    TEXT    NOT NULL DEFAULT '',
			tags       TEXT    NOT NULL DEFAULT '[]',
			images     TEXT    NOT NULL DEFAULT '[]',
			files      TEXT    NOT NULL DEFAULT '[]',
			pinned     INTEGER NOT NULL DEFAULT 0,
			created_at TEXT    NOT NULL,
			updated_at TEXT    NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);
		CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(content, content='notes', content_rowid='id');
		CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
			INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
		END;
		CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
			INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.id, old.content);
			INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
		END;
		CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
			INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.id, old.content);
		END;

		CREATE TABLE IF NOT EXISTS credentials (
			username TEXT PRIMARY KEY,
			hash     TEXT NOT NULL
		);
	`)
	if err != nil {
		return err
	}
	// Migrate existing DBs — ignore errors if column already exists
	_, _ = d.conn.Exec(`ALTER TABLE notes ADD COLUMN files TEXT NOT NULL DEFAULT '[]'`)
	_, _ = d.conn.Exec(`ALTER TABLE notes ADD COLUMN title TEXT NOT NULL DEFAULT ''`)
	return nil
}

// ── Credential helpers ────────────────────────────────────────────────────

// SetCredential hashes the plaintext password with bcrypt and upserts it.
// Cost 12 is a good balance between security and startup speed.
func (d *DB) SetCredential(username, plainPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), 12)
	if err != nil {
		return fmt.Errorf("bcrypt: %w", err)
	}
	_, err = d.conn.Exec(
		`INSERT INTO credentials(username, hash) VALUES(?,?)
		 ON CONFLICT(username) DO UPDATE SET hash=excluded.hash`,
		username, string(hash),
	)
	return err
}

// HasCredential reports whether any credential row exists.
func (d *DB) HasCredential() bool {
	var n int
	d.conn.QueryRow(`SELECT COUNT(*) FROM credentials`).Scan(&n)
	return n > 0
}

// GetCredentialHash returns the bcrypt hash for the given username,
// or an error if not found.
func (d *DB) GetCredentialHash(username string) (string, error) {
	var hash string
	err := d.conn.QueryRow(
		`SELECT hash FROM credentials WHERE username=?`, username,
	).Scan(&hash)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("user not found")
	}
	return hash, err
}

func (d *DB) CreateNote(req model.CreateNoteReq) (*model.Note, error) {
	tagsJSON, _ := json.Marshal(req.Tags)
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := d.conn.Exec(
		`INSERT INTO notes (title, content, tags, images, files, pinned, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
		req.Title, req.Content, string(tagsJSON), "[]", "[]", boolToInt(req.Pinned), now, now,
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return d.GetNote(id)
}

func (d *DB) GetNote(id int64) (*model.Note, error) {
	row := d.conn.QueryRow(`SELECT id, title, content, tags, images, files, pinned, created_at, updated_at FROM notes WHERE id=?`, id)
	return scanNote(row)
}

func (d *DB) UpdateNote(id int64, req model.UpdateNoteReq) (*model.Note, error) {
	tagsJSON, _ := json.Marshal(req.Tags)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := d.conn.Exec(
		`UPDATE notes SET title=?, content=?, tags=?, pinned=?, updated_at=? WHERE id=?`,
		req.Title, req.Content, string(tagsJSON), boolToInt(req.Pinned), now, id,
	)
	if err != nil {
		return nil, err
	}
	return d.GetNote(id)
}

func (d *DB) DeleteNote(id int64) error {
	_, err := d.conn.Exec(`DELETE FROM notes WHERE id=?`, id)
	return err
}

// AddImage keeps backward compat (legacy image-only upload path).
func (d *DB) AddImage(noteID int64, filename string) error {
	note, err := d.GetNote(noteID)
	if err != nil {
		return err
	}
	note.Images = append(note.Images, filename)
	imagesJSON, _ := json.Marshal(note.Images)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = d.conn.Exec(`UPDATE notes SET images=?, updated_at=? WHERE id=?`, string(imagesJSON), now, noteID)
	return err
}

// AddFile attaches a generic file (including images) to a note.
func (d *DB) AddFile(noteID int64, att model.Attachment) error {
	note, err := d.GetNote(noteID)
	if err != nil {
		return err
	}
	note.Files = append(note.Files, att)
	filesJSON, _ := json.Marshal(note.Files)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = d.conn.Exec(`UPDATE notes SET files=?, updated_at=? WHERE id=?`, string(filesJSON), now, noteID)
	return err
}

// RemoveFile removes a file attachment by stored filename.
func (d *DB) RemoveFile(noteID int64, filename string) error {
	note, err := d.GetNote(noteID)
	if err != nil {
		return err
	}
	kept := note.Files[:0]
	for _, f := range note.Files {
		if f.Filename != filename {
			kept = append(kept, f)
		}
	}
	note.Files = kept
	filesJSON, _ := json.Marshal(note.Files)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err = d.conn.Exec(`UPDATE notes SET files=?, updated_at=? WHERE id=?`, string(filesJSON), now, noteID)
	return err
}

type ListOpts struct {
	Query string
	Tag   string
	Page  int
	Limit int
}

type ListResult struct {
	Notes []model.Note `json:"notes"`
	Total int          `json:"total"`
}

func (d *DB) ListNotes(opts ListOpts) (*ListResult, error) {
	if opts.Limit <= 0 {
		opts.Limit = 20
	}
	if opts.Page <= 0 {
		opts.Page = 1
	}
	offset := (opts.Page - 1) * opts.Limit

	var (
		rows    *sql.Rows
		countRow *sql.Row
		err     error
	)

	if opts.Query != "" {
		q := "%" + opts.Query + "%"
		rows, err = d.conn.Query(`
			SELECT id, title, content, tags, images, files, pinned, created_at, updated_at FROM notes
			WHERE content LIKE ? OR title LIKE ?
			ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`, q, q, opts.Limit, offset)
		countRow = d.conn.QueryRow(`SELECT COUNT(*) FROM notes WHERE content LIKE ? OR title LIKE ?`, q, q)
	} else if opts.Tag != "" {
		rows, err = d.conn.Query(`
			SELECT id, title, content, tags, images, files, pinned, created_at, updated_at FROM notes
			WHERE tags LIKE ?
			ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`,
			"%\""+opts.Tag+"\"%", opts.Limit, offset)
		countRow = d.conn.QueryRow(`SELECT COUNT(*) FROM notes WHERE tags LIKE ?`, "%\""+opts.Tag+"\"%")
	} else {
		rows, err = d.conn.Query(`
			SELECT id, title, content, tags, images, files, pinned, created_at, updated_at FROM notes
			ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`, opts.Limit, offset)
		countRow = d.conn.QueryRow(`SELECT COUNT(*) FROM notes`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var total int
	countRow.Scan(&total)

	var notes []model.Note
	for rows.Next() {
		n, err := scanNoteRows(rows)
		if err != nil {
			continue
		}
		notes = append(notes, *n)
	}
	if notes == nil {
		notes = []model.Note{}
	}
	return &ListResult{Notes: notes, Total: total}, nil
}

func (d *DB) AllTags() ([]string, error) {
	rows, err := d.conn.Query(`SELECT tags FROM notes WHERE tags != '[]'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tagSet := map[string]struct{}{}
	for rows.Next() {
		var raw string
		rows.Scan(&raw)
		var tags []string
		json.Unmarshal([]byte(raw), &tags)
		for _, t := range tags {
			t = strings.TrimSpace(t)
			if t != "" {
				tagSet[t] = struct{}{}
			}
		}
	}
	result := make([]string, 0, len(tagSet))
	for t := range tagSet {
		result = append(result, t)
	}
	return result, nil
}

func (d *DB) ExportAll() ([]model.Note, error) {
	rows, err := d.conn.Query(`SELECT id, title, content, tags, images, files, pinned, created_at, updated_at FROM notes ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var notes []model.Note
	for rows.Next() {
		n, err := scanNoteRows(rows)
		if err == nil {
			notes = append(notes, *n)
		}
	}
	return notes, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanNote(s *sql.Row) (*model.Note, error) {
	var n model.Note
	var tagsJSON, imagesJSON, filesJSON, createdAt, updatedAt string
	var pinned int
	if err := s.Scan(&n.ID, &n.Title, &n.Content, &tagsJSON, &imagesJSON, &filesJSON, &pinned, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(tagsJSON), &n.Tags)
	json.Unmarshal([]byte(imagesJSON), &n.Images)
	json.Unmarshal([]byte(filesJSON), &n.Files)
	n.Pinned = pinned == 1
	n.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	n.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	if n.Tags == nil   { n.Tags = []string{} }
	if n.Images == nil { n.Images = []string{} }
	if n.Files == nil  { n.Files = []model.Attachment{} }
	return &n, nil
}

func scanNoteRows(s *sql.Rows) (*model.Note, error) {
	var n model.Note
	var tagsJSON, imagesJSON, filesJSON, createdAt, updatedAt string
	var pinned int
	if err := s.Scan(&n.ID, &n.Title, &n.Content, &tagsJSON, &imagesJSON, &filesJSON, &pinned, &createdAt, &updatedAt); err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(tagsJSON), &n.Tags)
	json.Unmarshal([]byte(imagesJSON), &n.Images)
	json.Unmarshal([]byte(filesJSON), &n.Files)
	n.Pinned = pinned == 1
	n.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	n.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	if n.Tags == nil   { n.Tags = []string{} }
	if n.Images == nil { n.Images = []string{} }
	if n.Files == nil  { n.Files = []model.Attachment{} }
	return &n, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
