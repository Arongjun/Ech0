// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package handler

import (
	"mime"
	"strconv"
	"strings"
)

// Feed readers get Atom by default. An explicitly refused HTML representation
// (q=0), or a preferred/equally preferred Atom representation, must stay Atom.
func rssWantsHTML(accept string) bool {
	htmlQ, atomQ := 0.0, 0.0
	for _, part := range strings.Split(accept, ",") {
		media, params, err := mime.ParseMediaType(strings.TrimSpace(part))
		if err != nil {
			continue
		}
		q := 1.0
		if raw, ok := params["q"]; ok {
			q, err = strconv.ParseFloat(raw, 64)
			if err != nil || !(q >= 0 && q <= 1) {
				continue
			}
		}
		switch media {
		case "text/html":
			htmlQ = max(htmlQ, q)
		case "application/atom+xml", "application/rss+xml", "application/xml":
			atomQ = max(atomQ, q)
		}
	}
	return htmlQ > 0 && htmlQ > atomQ
}
