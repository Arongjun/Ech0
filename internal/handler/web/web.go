// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package handler

import (
	"encoding/json"
	"html"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	settingModel "github.com/lin-snow/ech0/internal/model/setting"
	settingService "github.com/lin-snow/ech0/internal/service/setting"
	"github.com/lin-snow/ech0/internal/visitor"
	"github.com/lin-snow/ech0/template"
)

var spaBypassPrefixes = []string{
	"/api",
	"/ws",
	"/mcp",
}

type WebHandler struct {
	visitorTracker *visitor.Tracker
	settingService settingService.Service
}

func NewWebHandler(visitorTracker *visitor.Tracker, settingService settingService.Service) *WebHandler {
	return &WebHandler{
		visitorTracker: visitorTracker,
		settingService: settingService,
	}
}

func (webHandler *WebHandler) getSiteTitle() string {
	if webHandler.settingService == nil {
		return "Ech0"
	}
	var s settingModel.SystemSetting
	if err := webHandler.settingService.GetSetting(&s); err != nil {
		return "Ech0"
	}
	title := strings.TrimSpace(s.SiteTitle)
	if title == "" {
		title = strings.TrimSpace(s.ServerName)
	}
	if title == "" {
		title = "Ech0"
	}
	return title
}

func (webHandler *WebHandler) renderIndexHTML(subFS fs.FS, ctx *gin.Context) bool {
	rawHTML, err := fs.ReadFile(subFS, "index.html")
	if err != nil {
		return false
	}
	siteTitle := webHandler.getSiteTitle()
	htmlStr := string(rawHTML)
	if siteTitle != "Ech0" && siteTitle != "" {
		escaped := html.EscapeString(siteTitle)
		htmlStr = strings.Replace(htmlStr, "<title>Ech0</title>", "<title>"+escaped+"</title>", 1)
		htmlStr = strings.Replace(htmlStr, `<meta name="apple-mobile-web-app-title" content="Ech0" />`, `<meta name="apple-mobile-web-app-title" content="`+escaped+`" />`, 1)
		htmlStr = strings.Replace(htmlStr, `<meta property="og:title" content="Ech0" />`, `<meta property="og:title" content="`+escaped+`" />`, 1)
		htmlStr = strings.Replace(htmlStr, `<meta property="og:site_name" content="Ech0" />`, `<meta property="og:site_name" content="`+escaped+`" />`, 1)
		htmlStr = strings.Replace(htmlStr, `<meta name="twitter:title" content="Ech0" />`, `<meta name="twitter:title" content="`+escaped+`" />`, 1)
		htmlStr = strings.Replace(htmlStr, `<h1 class="loader-brand">Ech0</h1>`, `<h1 class="loader-brand">`+escaped+`</h1>`, 1)
	}
	webHandler.visitorTracker.Record(ctx.Request, ctx.ClientIP())
	ctx.Header("Content-Type", "text/html; charset=utf-8")
	setNoStoreHeaders(ctx)
	setStaticCorsHeaders(ctx)
	ctx.Data(http.StatusOK, "text/html; charset=utf-8", []byte(htmlStr))
	return true
}

func (webHandler *WebHandler) renderManifest(subFS fs.FS, ctx *gin.Context) bool {
	rawManifest, err := fs.ReadFile(subFS, "app.webmanifest")
	if err != nil {
		return false
	}
	siteTitle := webHandler.getSiteTitle()
	manifestStr := string(rawManifest)
	if siteTitle != "Ech0" && siteTitle != "" {
		titleBytes, _ := json.Marshal(siteTitle)
		manifestStr = strings.Replace(manifestStr, `"name": "Ech0"`, `"name": `+string(titleBytes), 1)
		manifestStr = strings.Replace(manifestStr, `"short_name": "Ech0"`, `"short_name": `+string(titleBytes), 1)
	}
	setNoStoreHeaders(ctx)
	setStaticCorsHeaders(ctx)
	ctx.Data(http.StatusOK, "application/manifest+json", []byte(manifestStr))
	return true
}

func (webHandler *WebHandler) Templates() gin.HandlerFunc {
	subFS, _ := fs.Sub(template.WebFS, "dist")
	fileServer := http.FS(subFS)

	return func(ctx *gin.Context) {
		requestPath := ctx.Request.URL.Path
		if shouldBypassSPAFallback(requestPath) {
			ctx.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		if ctx.Request.Method == http.MethodOptions {
			setStaticCorsHeaders(ctx)
			ctx.Status(http.StatusNoContent)
			return
		}

		if requestPath == "/" || requestPath == "/index.html" {
			if webHandler.renderIndexHTML(subFS, ctx) {
				return
			}
			requestPath = "/index.html"
		}

		if requestPath == "/app.webmanifest" {
			if webHandler.renderManifest(subFS, ctx) {
				return
			}
		}

		if strings.Contains(requestPath, "..") {
			ctx.Status(http.StatusForbidden)
			return
		}

		fullPath := path.Clean("." + requestPath)
		f, err := fileServer.Open(fullPath)
		if err != nil {
			if isStaticAsset(requestPath) {
				setStaticCorsHeaders(ctx)
				ctx.Status(http.StatusNotFound)
				return
			}
			if webHandler.renderIndexHTML(subFS, ctx) {
				return
			}
			fallback, err := fileServer.Open("index.html")
			if err != nil {
				ctx.Status(http.StatusNotFound)
				return
			}
			defer func() { _ = fallback.Close() }()
			fallbackStat, _ := fallback.Stat()
			webHandler.visitorTracker.Record(ctx.Request, ctx.ClientIP())
			ctx.Header("Content-Type", "text/html; charset=utf-8")
			setNoStoreHeaders(ctx)
			setStaticCorsHeaders(ctx)
			http.ServeContent(
				ctx.Writer,
				ctx.Request,
				"index.html",
				fallbackStat.ModTime(),
				fallback,
			)
			return
		}
		defer func() { _ = f.Close() }()

		stat, _ := f.Stat()

		encoding := ctx.GetHeader("Accept-Encoding")
		if strings.Contains(encoding, "gzip") {
			gzPath := fullPath + ".gz"
			gzFile, err := fileServer.Open(gzPath)
			if err == nil {
				defer func() { _ = gzFile.Close() }()
				stat, _ := gzFile.Stat()
				ctx.Header("Content-Encoding", "gzip")
				ctx.Header("Content-Type", getMimeType(fullPath))
				setCacheControlHeader(ctx, requestPath)
				setStaticCorsHeaders(ctx)
				http.ServeContent(ctx.Writer, ctx.Request, gzPath, stat.ModTime(), gzFile)
				return
			}
		}

		ctx.Header("Content-Type", getMimeType(fullPath))
		setCacheControlHeader(ctx, requestPath)
		setStaticCorsHeaders(ctx)
		if requestPath == "/index.html" {
			webHandler.visitorTracker.Record(ctx.Request, ctx.ClientIP())
		}
		http.ServeContent(ctx.Writer, ctx.Request, fullPath, stat.ModTime(), f)
	}
}

func setStaticCorsHeaders(ctx *gin.Context) {
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
	ctx.Header("Access-Control-Allow-Headers", "*")
}

func setCacheControlHeader(ctx *gin.Context, requestPath string) {
	if strings.HasPrefix(requestPath, "/assets/") {
		ctx.Header("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	if requestPath == "/index.html" || requestPath == "/" {
		setNoStoreHeaders(ctx)
		return
	}
	ctx.Header("Cache-Control", "public, max-age=3600")
}

func setNoStoreHeaders(ctx *gin.Context) {
	ctx.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	ctx.Header("Pragma", "no-cache")
	ctx.Header("Expires", "0")
}

func shouldBypassSPAFallback(requestPath string) bool {
	for _, prefix := range spaBypassPrefixes {
		if requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/") {
			return true
		}
	}
	return false
}

func isStaticAsset(requestPath string) bool {
	if strings.HasPrefix(requestPath, "/assets/") {
		return true
	}
	ext := path.Ext(requestPath)
	return ext != "" && ext != ".html"
}

func getMimeType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".json", ".map":
		return "application/json; charset=utf-8"
	case ".webmanifest":
		return "application/manifest+json"
	case ".svg":
		return "image/svg+xml"
	case ".woff2":
		return "font/woff2"
	case ".woff":
		return "font/woff"
	case ".ttf":
		return "font/ttf"
	case ".ico":
		return "image/x-icon"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".html", ".htm":
		return "text/html; charset=utf-8"
	}
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return mimeType
}
