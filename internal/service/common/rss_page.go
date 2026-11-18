// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package service

import (
	htmltemplate "html/template"
	"strings"
)

// RSSDocument is one feed render in both wire forms: Atom for feed readers and
// a subscription landing page for browsers.
//
// The browser form is rendered on the server because Chromium — and therefore
// Microsoft Edge in v159 — is removing client-side XSLT; an XML document that
// only looked good through <?xml-stylesheet?> degrades to a raw XML dump once
// that lands. The page carries only the subscription affordance (feed URL) and
// feed liveness (count, last update); entry bodies live in the Atom document
// alone so the landing page never duplicates feed content.
type RSSDocument struct {
	Atom string
	HTML string
}

type rssPage struct {
	Title       string
	Description string
	Logo        string
	Home        string
	FeedURL     string
	Count       int
	Updated     string
	UpdatedISO  string
}

var rssPageTemplate = htmltemplate.Must(htmltemplate.New("rss-page").Parse(rssPageSource))

func renderRSSPage(page rssPage) (string, error) {
	var b strings.Builder
	if err := rssPageTemplate.Execute(&b, page); err != nil {
		return "", err
	}
	return b.String(), nil
}

const rssPageSource = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <meta name="description" content="{{.Description}}">
  <meta name="color-scheme" content="light dark">
  <title>{{.Title}} · RSS</title>
  {{if .Logo}}<link rel="icon" href="{{.Logo}}">{{else}}<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%230a84ff' d='M4 4v3a13 13 0 0 1 13 13h3A16 16 0 0 0 4 4m0 6v3a7 7 0 0 1 7 7h3A10 10 0 0 0 4 10m0 7v3h3v-3z'/%3E%3C/svg%3E">{{end}}
  <link rel="alternate" type="application/atom+xml" href="{{.FeedURL}}" title="{{.Title}}">
  <script>
    // Match the app's JSON-string or legacy plain-string themeMode setting.
    try {
      var mode = localStorage.getItem('themeMode');
      try { mode = JSON.parse(mode); } catch (_) {}
      if (mode === 'dark' || mode === 'light' || mode === 'sunny') {
        document.documentElement.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
      }
    } catch (_) {}
  </script>
  <style>
    :root { color-scheme: light dark; --ink:#1d1d1f; --muted:#55565b; --canvas:#f3f7fb; --glass:rgb(255 255 255 / 62%); --solid:rgb(255 255 255 / 78%); --line:rgb(55 48 42 / 11%); --blue:#066dcc; --shadow:inset 0 1px 0 rgb(255 255 255 / 82%),0 12px 36px rgb(40 48 62 / 8%); }
    @media (prefers-color-scheme:dark) {
      :root:not([style*="color-scheme: light"]) { --ink:#f5f5f7; --muted:#c5c8d0; --canvas:#151b25; --glass:rgb(37 46 63 / 72%); --solid:rgb(48 58 76 / 82%); --line:rgb(255 255 255 / 12%); --blue:#80bdff; --shadow:inset 0 1px 0 rgb(255 255 255 / 9%),0 12px 36px rgb(0 0 0 / 18%); }
    }
    :root[style*="color-scheme: dark"] { --ink:#f5f5f7; --muted:#c5c8d0; --canvas:#151b25; --glass:rgb(37 46 63 / 72%); --solid:rgb(48 58 76 / 82%); --line:rgb(255 255 255 / 12%); --blue:#80bdff; --shadow:inset 0 1px 0 rgb(255 255 255 / 9%),0 12px 36px rgb(0 0 0 / 18%); }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; min-height:100svh; color:var(--ink); background:radial-gradient(ellipse at 95% 0,rgb(10 132 255 / 14%),transparent 48%),radial-gradient(ellipse at 0 90%,rgb(114 168 255 / 9%),transparent 50%),var(--canvas); font:16px/1.7 -apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Microsoft YaHei",sans-serif; -webkit-font-smoothing:antialiased; }
    a { color:var(--blue); text-decoration:none; }
    a:hover { text-decoration:underline; }
    a:focus-visible,code:focus-visible { outline:3px solid var(--blue); outline-offset:5px; }
    .wrap { width:min(100%,760px); margin:0 auto; padding:clamp(24px,8vh,88px) 20px 40px; }
    .glass { padding:clamp(24px,5vw,48px); border:1px solid var(--line); border-radius:30px; background:var(--glass); box-shadow:var(--shadow); -webkit-backdrop-filter:blur(24px) saturate(150%); backdrop-filter:blur(24px) saturate(150%); }
    .masthead { display:flex; align-items:center; gap:16px; }
    .logo,.brand-icon { width:64px; height:64px; flex-shrink:0; border-radius:20px; background:var(--solid); border:1px solid var(--line); object-fit:cover; }
    .brand-icon { display:grid; place-items:center; color:var(--blue); }
    h1 { margin:8px 0 0; font-size:clamp(23px,4.5vw,34px); line-height:1.25; letter-spacing:-.025em; overflow-wrap:anywhere; }
    .feed-badge { display:inline-block; color:var(--blue); font-size:12px; letter-spacing:.06em; font-weight:600; }
    .description { color:var(--muted); margin:22px 0 0; overflow-wrap:anywhere; }
    .hint { margin-top:28px; padding:22px; border:1px solid var(--line); border-radius:20px; background:var(--solid); }
    h2 { font-size:16px; margin:0 0 8px; }
    .hint p { margin:0; color:var(--muted); font-size:14px; }
    .feed-url { display:block; padding:14px 16px; margin-top:16px; border:1px solid var(--line); border-radius:12px; background:var(--glass); font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; overflow-wrap:anywhere; white-space:normal; -webkit-user-select:all; user-select:all; }
    .meta { color:var(--muted); font-size:13px; margin:20px 0 0; font-variant-numeric:tabular-nums; }
    .site-footer { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-top:28px; padding-top:22px; border-top:1px solid var(--line); color:var(--muted); font-size:13px; }
    .site-footer span { overflow-wrap:anywhere; }
    .home-link { display:inline-flex; align-items:center; min-height:44px; flex-shrink:0; }
    @media (max-width:420px) { .wrap { padding:24px 14px; } .glass { padding:24px 20px; border-radius:24px; } .logo,.brand-icon { width:48px; height:48px; border-radius:15px; } .hint { padding:18px 16px; } .site-footer { flex-wrap:wrap; gap:4px 16px; } }
    @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; transition:none!important; scroll-behavior:auto!important; } }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="glass" aria-labelledby="feed-title">
      <header class="masthead">
        {{if .Logo}}<img class="logo" alt="" src="{{.Logo}}" width="64" height="64">{{else}}<span class="brand-icon" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg></span>{{end}}
        <div><span class="feed-badge">RSS 订阅</span><h1 id="feed-title">{{.Title}}</h1></div>
      </header>
      {{if .Description}}<p class="description">{{.Description}}</p>{{end}}
      <section class="hint" aria-labelledby="subscribe-title">
        <h2 id="subscribe-title">在阅读器里，继续相遇</h2>
        <p>将下方地址添加到你常用的 RSS 阅读器（如 Feedly、Inoreader 或 Reeder），即可订阅最新公开动态。</p>
        <code class="feed-url" tabindex="0" aria-label="RSS 订阅地址">{{.FeedURL}}</code>
      </section>
      <p class="meta">{{if .Count}}共 {{.Count}} 条动态{{if .Updated}} · 最近更新 <time datetime="{{.UpdatedISO}}">{{.Updated}}</time>{{end}}{{else}}暂无内容{{end}}</p>
      <footer class="site-footer"><span>{{.Title}} · 公开动态</span><a class="home-link" href="{{.Home}}">访问站点 <span aria-hidden="true">↗</span></a></footer>
    </section>
  </main>
</body>
</html>
`
