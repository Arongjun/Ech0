// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
package migration_test

import (
	"github.com/lin-snow/ech0/internal/database"
	dbMigration "github.com/lin-snow/ech0/internal/database/migration"
	commonModel "github.com/lin-snow/ech0/internal/model/common"
	echoModel "github.com/lin-snow/ech0/internal/model/echo"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"path/filepath"
	"testing"
)

func legacyLikesDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "legacy.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`CREATE TABLE echos (id TEXT PRIMARY KEY, content TEXT NOT NULL, username TEXT, layout TEXT DEFAULT 'waterfall', private NUMERIC DEFAULT 0, user_id TEXT NOT NULL, created_at INTEGER, fav_count INTEGER DEFAULT 0)`).Error)
	require.NoError(t, db.AutoMigrate(&commonModel.KeyValue{}))
	require.NoError(t, db.Exec(`INSERT INTO echos (id,content,user_id,fav_count) VALUES ('old','kept','u',7),('zero','zero','u',0),('nullable','null','u',NULL)`).Error)
	return db
}
func TestLegacyLikes_PreservesOldSchemaAndRepeatedStartup(t *testing.T) {
	db := legacyLikesDB(t)
	for i := 0; i < 3; i++ {
		database.SetDB(db)
		require.NoError(t, database.MigrateDB())
		dbMigration.Migrate(db, dbMigration.WithMigrators(dbMigration.NewLegacyLikeCountPreserveMigrator()))
		var row echoModel.Echo
		require.NoError(t, db.First(&row, "id = ?", "old").Error)
		require.Equal(t, 7, row.LegacyLikeCount)
		require.Equal(t, "kept", row.Content)
		require.True(t, db.Migrator().HasColumn(&echoModel.Echo{}, "fav_count"))
	}
	var zero echoModel.Echo
	require.NoError(t, db.First(&zero, "id = ?", "zero").Error)
	require.Zero(t, zero.LegacyLikeCount)
	// Raw NULL and the original aggregates are not rewritten or multiplied.
	var nulls int64
	require.NoError(t, db.Raw("SELECT COUNT(*) FROM echos WHERE id='nullable' AND fav_count IS NULL").Scan(&nulls).Error)
	require.EqualValues(t, 1, nulls)
	require.NoError(t, db.AutoMigrate(&echoModel.Reaction{}))
	var actors int64
	require.NoError(t, db.Model(&echoModel.Reaction{}).Count(&actors).Error)
	require.Zero(t, actors)
}
func TestLegacyLikes_FreshOrAlreadyDroppedStartsAtZero(t *testing.T) {
	db := legacyLikesDB(t)
	require.NoError(t, db.Exec("ALTER TABLE echos DROP COLUMN fav_count").Error)
	require.NoError(t, db.Create(&commonModel.KeyValue{Key: commonModel.EchosFavCountColumnDroppedKey, Value: "upstream already ran"}).Error)
	// A different marker key ensures a past upstream DROP never skips the safe adapter.
	dbMigration.Migrate(db, dbMigration.WithMigrators(dbMigration.NewLegacyLikeCountPreserveMigrator()))
	var count int
	require.NoError(t, db.Raw("SELECT fav_count FROM echos WHERE id='old'").Scan(&count).Error)
	require.Zero(t, count) // Deleted historical data cannot be invented.
	require.NoError(t, dbMigration.NewEchosFavCountDropMigrator().Migrate(db))
}
func TestLegacyLikes_FailureCannotDeleteCountsAndCanRetry(t *testing.T) {
	db := legacyLikesDB(t)
	require.NoError(t, db.Exec(`CREATE TRIGGER fail_marker BEFORE INSERT ON key_values BEGIN SELECT RAISE(ABORT, 'simulated marker failure'); END`).Error)
	dbMigration.Migrate(db, dbMigration.WithMigrators(dbMigration.NewLegacyLikeCountPreserveMigrator()))
	var count int
	require.NoError(t, db.Raw("SELECT fav_count FROM echos WHERE id='old'").Scan(&count).Error)
	require.Equal(t, 7, count)
	require.NoError(t, db.Exec("DROP TRIGGER fail_marker").Error)
	dbMigration.Migrate(db, dbMigration.WithMigrators(dbMigration.NewLegacyLikeCountPreserveMigrator()))
	require.NoError(t, db.Raw("SELECT fav_count FROM echos WHERE id='old'").Scan(&count).Error)
	require.Equal(t, 7, count)
	require.Error(t, dbMigration.NewLegacyLikeCountPreserveMigrator().Migrate(nil))
}
