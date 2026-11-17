// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package handler

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/lin-snow/ech0/internal/visitor"
	"net/http"
	"os"
	"strings"
	"testing"
	"testing/fstest"

	settingModel "github.com/lin-snow/ech0/internal/model/setting"
)

func readPublic(t *testing.T, name string) []byte {
	t.Helper()
	raw, err := os.ReadFile("../../../web/public/" + name)
	if err != nil {
		t.Fatalf("read %s: %v", name, err)
	}
	return raw
}

func TestBrandingFromSetting_Fallbacks(t *testing.T) {
	b := brandingFromSetting(settingModel.SystemSetting{ServerLogo: "/Ech0.svg"}, "My Site")
	if b.Description != "My Site" || b.Author != "My Site" || b.LogoURL != "" {
		t.Fatalf("unexpected fallback branding: %+v", b)
	}

	b = brandingFromSetting(settingModel.SystemSetting{
		ServerName:        "阿荣的小屋",
		ServerLogo:        "https://cdn.example.com/logo.png",
		HomeWelcomeText:   "欢迎",
		HomeSignatureText: "记录生活",
	}, "ARong's Moments")
	if b.Description != "记录生活" || b.Author != "阿荣的小屋" {
		t.Fatalf("unexpected branding: %+v", b)
	}
	if b.LogoURL != "https://cdn.example.com/logo.png" || b.LogoType != "image/png" || b.LogoSizes != defaultLogoSizes {
		t.Fatalf("unexpected logo: %+v", b)
	}
}

func TestBrandManifest_RemovesOfficialBranding(t *testing.T) {
	raw := readPublic(t, "app.webmanifest")
	out, err := brandManifest(raw, siteBranding{
		Title: "ARong's Moments", Description: "记录生活",
		LogoURL: "/api/files/images/logo.png", LogoSizes: "2048x2048", LogoType: "image/png",
	})
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(out, &m); err != nil {
		t.Fatal(err)
	}
	if m["name"] != "ARong's Moments" || m["short_name"] != "ARong's Moments" || m["description"] != "记录生活" {
		t.Fatalf("unexpected manifest text: %v", m)
	}
	if _, ok := m["screenshots"]; ok {
		t.Fatal("official screenshots must be removed")
	}
	icons := m["icons"].([]any)
	if len(icons) != 2 {
		t.Fatalf("expected logo icons only, got %v", icons)
	}
	for _, ic := range icons {
		if ic.(map[string]any)["src"] != "/api/files/images/logo.png" {
			t.Fatalf("unexpected icon %v", ic)
		}
	}
	if strings.Contains(string(out), "open-source self-hosted") {
		t.Fatal("official description leaked")
	}

	// 未配置 Logo：保留内置图标，但仍去掉截图与官方描述
	out, err = brandManifest(raw, siteBranding{Title: "X", Description: "X"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(out), "screenshot") || !strings.Contains(string(out), "web-app-manifest-512x512.png") {
		t.Fatalf("unexpected manifest without logo: %s", out)
	}
}

func TestBrandIndexHTML_ReplacesShareMeta(t *testing.T) {
	raw := string(readPublic(t, "../index.html"))
	out := brandIndexHTML(raw, siteBranding{
		Title: "ARong's Moments", Description: "记录 $1 生活", Author: "阿荣的小屋",
		LogoURL: "/api/files/images/logo.png",
	})
	for _, leak := range []string{"open-source self-hosted", "Ech0 Team", "github.com/lin-snow", `content="/Ech0.png"`, `href="/apple-touch-icon.png"`} {
		if strings.Contains(out, leak) {
			t.Fatalf("leaked %q", leak)
		}
	}
	if strings.Count(out, `content="记录 $1 生活"`) != 3 {
		t.Fatalf("description not applied to all 3 meta tags")
	}
	if !strings.Contains(out, `"name":"ARong's Moments"`) {
		t.Fatal("json-ld name not applied")
	}
	if !strings.Contains(out, `<link rel="apple-touch-icon" href="/api/files/images/logo.png" />`) {
		t.Fatal("apple-touch-icon not replaced")
	}
}

func TestTemplates_CustomBrandingSurvivesSEORendering(t *testing.T) {
	handler := NewWebHandler(visitor.NewTracker(), stubSettings{setting: settingModel.SystemSetting{
		SiteTitle: "Arong & Friends", ServerName: "Arong", HomeSignatureText: "记录生活",
		ServerLogo: "/images/custom-logo.png", DefaultLocale: "zh-CN",
	}}, stubEchoes{})
	// Use checked-in source fixtures, not a built frontend: backend CI embeds a placeholder.
	handler.shell = newSPAShell(readPublic(t, "../index.html"))
	handler.files = http.FS(fstest.MapFS{"app.webmanifest": &fstest.MapFile{Data: readPublic(t, "app.webmanifest")}})
	r := gin.New()
	r.NoRoute(handler.Templates())
	rec := get(r, "/")
	if rec.Code != http.StatusOK {
		t.Fatalf("home status: %d", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{
		`<h1 class="loader-brand">Arong &amp; Friends</h1>`,
		`content="记录生活"`,
		`<link rel="apple-touch-icon" href="/images/custom-logo.png" />`,
		`content="http://blog.example.com/images/custom-logo.png"`,
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("missing %q", want)
		}
	}
	if strings.Count(body, "<title>") != 1 {
		t.Fatal("duplicate page titles")
	}
	if strings.Contains(body, `"sameAs"`) {
		t.Fatal("official project identity leaked")
	}
	manifest := get(r, "/app.webmanifest")
	if manifest.Code != http.StatusOK || !strings.Contains(manifest.Header().Get("Cache-Control"), "no-store") {
		t.Fatalf("manifest status/cache: %d %s", manifest.Code, manifest.Header().Get("Cache-Control"))
	}
	var value map[string]any
	if err := json.Unmarshal(manifest.Body.Bytes(), &value); err != nil {
		t.Fatal(err)
	}
	if value["name"] != "Arong & Friends" || value["description"] != "记录生活" {
		t.Fatalf("manifest branding: %v", value)
	}
	if _, exists := value["screenshots"]; exists {
		t.Fatal("official screenshots leaked")
	}
}
