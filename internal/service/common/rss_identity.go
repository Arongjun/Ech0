// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package service

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/feeds"
)

// The configured public origin is authoritative, including HTTPS terminated
// upstream. This does not expand reqinfo's forwarded-header trust: RSS never
// accepts a caller-controlled X-Forwarded-Host/Proto as canonical configuration.
// Without a valid configured origin, actual TLS and the validated Host win.
func rssPublicOrigin(r *http.Request, configured string) (*url.URL, error) {
	if u := rssAbsoluteHTTPURL(configured); u != nil && (u.Path == "" || u.Path == "/") && u.RawQuery == "" && u.Fragment == "" && !strings.EqualFold(u.Hostname(), "ech0.example.com") {
		return &url.URL{Scheme: u.Scheme, Host: u.Host}, nil
	}
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	u := rssAbsoluteHTTPURL(scheme + "://" + r.Host)
	if u == nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return nil, fmt.Errorf("invalid RSS request origin")
	}
	return u, nil
}

func rssAbsoluteHTTPURL(raw string) *url.URL {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.User != nil || u.Opaque != "" || u.Hostname() == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil
	}
	return u
}

func rssLogoURL(raw string, base *url.URL) string {
	raw = strings.TrimSpace(raw)
	u, err := url.Parse(raw)
	if err != nil || raw == "" || u.User != nil || u.Opaque != "" || (u.Scheme == "" && u.Host != "") {
		return ""
	}
	// Built-in project logos are not an instance identity. Use the neutral RSS
	// glyph on the landing page when no custom site logo has been configured.
	switch strings.ToLower(strings.TrimPrefix(u.Path, "/")) {
	case "ech0.svg", "ech0.png", "rech0.svg", "rech0.png", "favicon.svg", "favicon.ico":
		return ""
	}
	u = base.ResolveReference(u)
	if rssAbsoluteHTTPURL(u.String()) == nil {
		return ""
	}
	return u.String()
}

func rssCustomText(raw string) string {
	s := strings.TrimSpace(raw)
	switch strings.ToLower(s) {
	case "", "ech0", "echo", "ech0 team", "echo team", "powered by ech0", "powered by echo":
		return ""
	}
	return s
}

// gorilla derives entry IDs from host/date/path (not scheme), so an HTTPS
// correction preserves them. Its feed ID is the home URL: explicitly retain
// the historical transport-origin ID while updating the navigable URLs. IDs
// are opaque identities, not subscription addresses; no reader history reset.
func rssAtomWithStableIdentity(feed *feeds.Feed, legacyID string) (string, error) {
	atom := (&feeds.Atom{Feed: feed}).AtomFeed()
	atom.Id = legacyID
	raw, err := xml.MarshalIndent(atom, "", "  ")
	if err != nil {
		return "", err
	}
	return strings.TrimSuffix(xml.Header, "\n") + string(raw), nil
}
