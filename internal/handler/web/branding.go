// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package handler

import (
	"encoding/json"
	"fmt"
	"html"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"mime"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lin-snow/ech0/internal/config"
	settingModel "github.com/lin-snow/ech0/internal/model/setting"
)

// siteBranding 汇总用于 PWA manifest 与 HTML 分享元信息的站点品牌信息，
// 全部来自后台系统设置，避免安装弹窗/分享卡片出现官方 Ech0 文案、图标与截图。
type siteBranding struct {
	Title       string
	Description string
	Author      string
	URL         string
	LogoURL     string // 为空表示未配置 Logo，沿用内置图标
	LogoSizes   string // 如 "2048x2048"
	LogoType    string // 如 "image/png"
}

const defaultLogoSizes = "512x512"

func brandingFromSetting(s settingModel.SystemSetting, title string) siteBranding {
	b := siteBranding{Title: title}
	for _, c := range []string{s.HomeSignatureText, s.HomeWelcomeText} {
		if v := strings.TrimSpace(c); v != "" {
			b.Description = v
			break
		}
	}
	if b.Description == "" {
		b.Description = title
	}
	b.URL = strings.TrimSpace(s.ServerURL)
	b.Author = strings.TrimSpace(s.ServerName)
	if b.Author == "" {
		b.Author = title
	}

	logo := strings.TrimSpace(s.ServerLogo)
	if logo == "" || isBuiltinLogo(logo) {
		return b
	}
	b.LogoURL = logo
	b.LogoType = mime.TypeByExtension(strings.ToLower(path.Ext(strings.SplitN(logo, "?", 2)[0])))
	b.LogoSizes = detectLocalLogoSizes(logo)
	if b.LogoType == "image/svg+xml" {
		b.LogoSizes = "any"
	}
	if b.LogoSizes == "" {
		b.LogoSizes = defaultLogoSizes
	}
	return b
}

func isBuiltinLogo(logo string) bool {
	switch strings.TrimPrefix(strings.ToLower(logo), "/") {
	case "ech0.svg", "ech0.png", "rech0.svg", "rech0.png", "favicon.svg", "favicon.ico":
		return true
	}
	return false
}

// detectLocalLogoSizes 读取本地存储中的 Logo 尺寸（仅限 /api/files/ 下的本地文件）。
func detectLocalLogoSizes(logo string) string {
	const prefix = "/api/files/"
	if !strings.HasPrefix(logo, prefix) {
		return ""
	}
	rel := path.Clean("/" + strings.SplitN(strings.TrimPrefix(logo, prefix), "?", 2)[0])
	root := config.Config().Storage.DataRoot
	if root == "" {
		root = "data/files"
	}
	f, err := os.Open(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		return ""
	}
	defer func() { _ = f.Close() }()
	cfg, _, err := image.DecodeConfig(f)
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return ""
	}
	return fmt.Sprintf("%dx%d", cfg.Width, cfg.Height)
}

// brandManifest 在内置 manifest 基础上替换名称、描述与图标，并移除官方截图。
func brandManifest(raw []byte, b siteBranding) ([]byte, error) {
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	if b.Title != "" {
		m["name"] = b.Title
		m["short_name"] = b.Title
	}
	if b.Description != "" {
		m["description"] = b.Description
	}
	delete(m, "screenshots")
	if b.LogoURL != "" {
		icon := map[string]any{"src": b.LogoURL, "sizes": b.LogoSizes}
		if b.LogoType != "" {
			icon["type"] = b.LogoType
		}
		anyIcon := map[string]any{}
		maskIcon := map[string]any{}
		for k, v := range icon {
			anyIcon[k] = v
			maskIcon[k] = v
		}
		anyIcon["purpose"] = "any"
		maskIcon["purpose"] = "maskable"
		m["icons"] = []any{anyIcon, maskIcon}
	}
	return json.MarshalIndent(m, "", "  ")
}

var (
	metaDescRe     = regexp.MustCompile(`(?s)<meta\s+(name="description"|property="og:description"|name="twitter:description")\s+content="[^"]*"\s*/>`)
	metaImageRe    = regexp.MustCompile(`<meta\s+(property="og:image"|name="twitter:image")\s+content="[^"]*"\s*/>`)
	metaKeywordsRe = regexp.MustCompile(`(?s)<meta\s+name="keywords"\s+content="[^"]*"\s*/>`)
	metaAuthorRe   = regexp.MustCompile(`<meta\s+name="author"\s+content="[^"]*"\s*/>`)
	appleIconRe    = regexp.MustCompile(`<link rel="apple-touch-icon" href="[^"]*" />`)
	jsonLDRe       = regexp.MustCompile(`(?s)(<script id="website-jsonld" type="application/ld\+json">).*?(</script>)`)
)

func buildJSONLD(b siteBranding) string {
	ld := map[string]any{
		"@context":    "https://schema.org",
		"@type":       "WebSite",
		"name":        b.Title,
		"description": b.Description,
		"publisher":   map[string]any{"@type": "Person", "name": b.Author},
	}
	if b.URL != "" {
		ld["url"] = b.URL
	}
	raw, err := json.Marshal(ld)
	if err != nil {
		return "{}"
	}
	// 防止内容中的 </script> 提前闭合标签
	return strings.ReplaceAll(string(raw), "</", "<\\/")
}

// brandIndexHTML 替换 index.html 中面向分享/安装的官方描述、图片、关键字与作者。
func brandIndexHTML(htmlStr string, b siteBranding) string {
	desc := html.EscapeString(b.Description)
	htmlStr = metaDescRe.ReplaceAllString(htmlStr, `<meta $1 content="`+strings.ReplaceAll(desc, "$", "$$")+`" />`)
	htmlStr = metaKeywordsRe.ReplaceAllLiteralString(htmlStr, `<meta name="keywords" content="`+html.EscapeString(b.Title)+`" />`)
	htmlStr = metaAuthorRe.ReplaceAllLiteralString(htmlStr, `<meta name="author" content="`+html.EscapeString(b.Author)+`" />`)
	ld := buildJSONLD(b)
	htmlStr = jsonLDRe.ReplaceAllStringFunc(htmlStr, func(m string) string {
		sub := jsonLDRe.FindStringSubmatch(m)
		return sub[1] + ld + sub[2]
	})
	if b.LogoURL != "" {
		logo := strings.ReplaceAll(html.EscapeString(b.LogoURL), "$", "$$")
		htmlStr = metaImageRe.ReplaceAllString(htmlStr, `<meta $1 content="`+logo+`" />`)
		htmlStr = appleIconRe.ReplaceAllString(htmlStr, `<link rel="apple-touch-icon" href="`+logo+`" />`)
	}
	return htmlStr
}
