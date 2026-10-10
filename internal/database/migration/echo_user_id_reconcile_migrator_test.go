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

	// e1 (alice) should be local-u1, e2 (empty/owner username) should be local-u1
	if rows[0].UserID != "local-u1" || rows[2].UserID != "local-u1" {
		t.Errorf("expected alice echos to have user_id local-u1: e1=%s, e3=%s", rows[0].UserID, rows[2].UserID)
	}

	var marker commonModel.KeyValue
	if err := db.Where("key = ?", commonModel.EchoUserIDReconciledKey).First(&marker).Error; err != nil {
		t.Fatalf("expected migrator marker, got err: %v", err)
	}
}

func TestEchoUserIDReconcileMigrator_AutoRestoresHistoricalUserYunshu(t *testing.T) {
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

	// Local owner: Arong
	if err := db.Exec(
		`INSERT INTO users (id, username, email, is_admin, is_owner) VALUES ('arong-new-uid', 'Arong', 'arong@test.com', 1, 1)`,
	).Error; err != nil {
		t.Fatalf("insert owner failed: %v", err)
	}

	// Insert echos:
	// - 1 by Arong with old UUID
	// - 2 by 芸舒超超超超超可爱 with old UUID
	if err := db.Exec(
		`INSERT INTO echos (id, content, user_id, username, private, created_at) VALUES ('e1', 'hello', 'arong-old-uid', 'Arong', false, 100)`,
	).Error; err != nil {
		t.Fatalf("insert echo e1 failed: %v", err)
	}
	if err := db.Exec(
		`INSERT INTO echos (id, content, user_id, username, private, created_at) VALUES ('e2', 'post by yunshu', '2e7703f0-3b65-5415-afb8-59784631d025', '芸舒超超超超超可爱', false, 200)`,
	).Error; err != nil {
		t.Fatalf("insert echo e2 failed: %v", err)
	}

	dbMigration.Migrate(
		db,
		dbMigration.WithStopOnError(),
		dbMigration.WithMigrators(dbMigration.NewEchoUserIDReconcileMigrator()),
	)

	// Check that 芸舒超超超超超可爱 was restored in users table
	var count int64
	if err := db.Table("users").Where("username = ?", "芸舒超超超超超可爱").Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("expected 1 user for 芸舒超超超超超可爱, got %d (err: %v)", count, err)
	}

	// Check that user_local_auth has the MD5 password hash
	var authCount int64
	if err := db.Table("user_local_auth").Where("user_id = ? AND password_hash = ?", "2e7703f0-3b65-5415-afb8-59784631d025", "a44e3c7815554a0b05de8fe446e7550b").Count(&authCount).Error; err != nil || authCount != 1 {
		t.Fatalf("expected local auth for 芸舒超超超超超可爱, got %d (err: %v)", authCount, err)
	}

	// Check that echos are correctly bound:
	// e1 -> arong-new-uid
	// e2 -> 2e7703f0-3b65-5415-afb8-59784631d025
	var u1, u2 string
	_ = db.Table("echos").Where("id = 'e1'").Pluck("user_id", &u1)
	_ = db.Table("echos").Where("id = 'e2'").Pluck("user_id", &u2)
	if u1 != "arong-new-uid" {
		t.Errorf("expected e1 to have user_id arong-new-uid, got %s", u1)
	}
	if u2 != "2e7703f0-3b65-5415-afb8-59784631d025" {
		t.Errorf("expected e2 to have user_id 2e7703f0-3b65-5415-afb8-59784631d025, got %s", u2)
	}
}
