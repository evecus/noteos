package model

import "time"

// Attachment represents any uploaded file (image or document).
type Attachment struct {
	Filename string `json:"filename"`  // stored name on disk, e.g. "42_1700000000_report.pdf"
	OrigName string `json:"orig_name"` // original upload name shown to user
	Size     int64  `json:"size"`      // bytes
	Mime     string `json:"mime"`      // detected MIME type
}

type Note struct {
	ID        int64        `json:"id"`
	Title     string       `json:"title"`   // optional, empty = no title shown
	Content   string       `json:"content"`
	Tags      []string     `json:"tags"`
	Pinned    bool         `json:"pinned"`
	Images    []string     `json:"images"` // legacy field, kept for compat
	Files     []Attachment `json:"files"`  // all attachments (replaces images going forward)
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

type CreateNoteReq struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Pinned  bool     `json:"pinned"`
}

type UpdateNoteReq struct {
	Title   string   `json:"title"`
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Pinned  bool     `json:"pinned"`
}

type Config struct {
	Password string
	DataDir  string
	Port     int
}
