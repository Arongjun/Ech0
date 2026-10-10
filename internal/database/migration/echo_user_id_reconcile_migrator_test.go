// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package migration_test

import (
	"fmt"
	"testing"

	"github.com/lin-snow/ech0/internal/database"
	dbMigration "github.com/lin-snow/ech0/internal/database/migration"
	commonModel "github.com/lin-snow/ech0/internal/model/common"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestEchoUserIDReconcileMigrator_ReconcilesOrphansAndMarksDone(t *testing.T) {
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	database.SetDB(db)
	if err := database.MigrateDB(); err != nil {
		t.Fatalf("migrate db failed: %v", err)
	}

	// 1. Create a local owner user
	if err := db.Exec(
		`INSERT INTO users (id, username, email, is_admin, is_owner) VALUES ('local-u1', 'alice', 'alice@test.com', 1, 1)`,
	).Error; err != nil {
		t.Fatalf("insert user failed: %v", err)
	}

	// 2. Insert echos:
	// - e1: has orphaned user_id ('old-u1'), but username matches local user ('alice')
	// - e2: has orphaned user_id ('old-u2') and different username ('bob'), should reconcile to owner ('local-u1')
	// - e3: already has valid user_id ('local-u1')
	if err := db.Exec(
		`INSERT INTO echos (id, content, user_id, username, private, created_at) VALUES ('e1', 'content1', 'old-u1', 'alice', false, 100)`,
	).Error; err != nil {
		t.Fatalf("insert echo e1 failed: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO echos (id, content, user_id, username, private, created_at) VALUES ('e2', 'content2', 'old-u2', 'bob', false, 200)`,
	).Error; err != nil {
		t.Fatalf("insert echo e2 failed: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO echos (id, content, user_id, username, private, created_at) VALUES ('e3', 'content3', 'local-u1', 'alice', false, 300)`,
	).Error; err != nil {
		t.Fatalf("insert echo e3 failed: %v", err)
	}

	dbMigration.Migrate(
		db,
		dbMigration.WithStopOnError(),
		dbMigration.WithMigrators(dbMigration.NewEchoUserIDReconcileMigrator()),
	)

	type echoRow struct {
		ID       string
		UserID   string
		Username string
	}
	var rows []echoRow
	if err := db.Raw("SELECT id, user_id, username FROM echos ORDER BY id").Scan(&rows).Error; err != nil {
		t.Fatalf("query echos failed: %v", err)
	}
	if len(rows) != 3 {
		t.Fatalf("expected 3 echos, got %d", len(rows))
	}

	// Both e1 and e2 should now have user_id == 'local-u1', and usernames preserved
	for _, r := range rows {
		if r.UserID != "local-u1" {
			t.Errorf("echo %s expected user_id 'local-u1', got %s", r.ID, r.UserID)
		}
	}
	if rows[0].Username != "alice" || rows[1].Username != "bob" {
		t.Errorf("expected usernames preserved: e1=%s, e2=%s", rows[0].Username, rows[1].Username)
	}

	var marker commonModel.KeyValue
	if err := db.Where("key = ?", commonModel.EchoUserIDReconciledKey).First(&marker).Error; err != nil {
		t.Fatalf("expected migrator marker, got err: %v", err)
	}
}
