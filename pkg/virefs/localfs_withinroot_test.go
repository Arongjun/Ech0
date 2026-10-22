// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package virefs

import (
	"path/filepath"
	"testing"
)

func TestLocalFS_WithinRoot(t *testing.T) {
	root := t.TempDir()
	l := &LocalFS{root: root}
	cases := map[string]bool{
		root:                                 true,
		filepath.Join(root, "a", "b.png"):    true,
		root + "2":                           false,
		filepath.Join(root+"2", "x.png"):     false,
		filepath.Dir(root):                   false,
		filepath.Join(root, "..", "etc"):     false,
		filepath.Join(root, "..dotted-file"): true,
	}
	for p, want := range cases {
		if got := l.withinRoot(filepath.Clean(p)); got != want {
			t.Errorf("withinRoot(%q) = %v, want %v", p, got, want)
		}
	}
}
