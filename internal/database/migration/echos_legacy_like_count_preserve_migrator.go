// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package migration

import (
	"fmt"
	echoModel "github.com/lin-snow/ech0/internal/model/echo"
	"gorm.io/gorm"
)

type legacyLikeCountPreserveMigrator struct{}

// NewLegacyLikeCountPreserveMigrator deliberately keeps echos.fav_count in place.
// No identities or reaction rows are manufactured from the old anonymous total.
func NewLegacyLikeCountPreserveMigrator() Migrator { return &legacyLikeCountPreserveMigrator{} }

// NewEchosFavCountDropMigrator is kept as a source-compatible alias, but is no
// longer destructive in the arong fork. Do not reinstate the upstream DROP.
func NewEchosFavCountDropMigrator() Migrator            { return NewLegacyLikeCountPreserveMigrator() }
func (*legacyLikeCountPreserveMigrator) Name() string   { return "legacy_like_count_preserve_migrator" }
func (*legacyLikeCountPreserveMigrator) Key() string    { return "echos_legacy_likes_preserved_v1" }
func (*legacyLikeCountPreserveMigrator) CanRerun() bool { return false }
func (*legacyLikeCountPreserveMigrator) Migrate(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}
	if db.Migrator().HasColumn(&echoModel.Echo{}, "fav_count") {
		return nil
	}
	// A fresh database (or one already upgraded by upstream) starts at zero.
	// This cannot reconstruct a column that a previous version already deleted.
	return db.Migrator().AddColumn(&echoModel.Echo{}, "LegacyLikeCount")
}
