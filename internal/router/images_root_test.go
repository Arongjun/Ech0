// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package router

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveLegacyImagesRoot(t *testing.T) {
	dataRoot := t.TempDir()
	if got := resolveLegacyImagesRoot(dataRoot); got != "" && filepath.Dir(got) == dataRoot {
		t.Fatalf("expected no images dir under data root, got %q", got)
	}

	// a regular file named images must not be mounted
	if err := os.WriteFile(filepath.Join(dataRoot, "images"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := resolveLegacyImagesRoot(dataRoot); got == filepath.Join(dataRoot, "images") {
		t.Fatalf("file should not be treated as images dir")
	}
	if err := os.Remove(filepath.Join(dataRoot, "images")); err != nil {
		t.Fatal(err)
	}

	imagesDir := filepath.Join(dataRoot, "images")
	if err := os.Mkdir(imagesDir, 0o755); err != nil {
		t.Fatal(err)
	}
	got := resolveLegacyImagesRoot(dataRoot)
	if got != imagesDir || !filepath.IsAbs(got) {
		t.Fatalf("got %q, want absolute %q", got, imagesDir)
	}
}
