// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package migration

import (
	"fmt"

	commonModel "github.com/lin-snow/ech0/internal/model/common"
	"gorm.io/gorm"
)

type echoUserIDReconcileMigrator struct{}

func NewEchoUserIDReconcileMigrator() Migrator {
	return &echoUserIDReconcileMigrator{}
}

func (m *echoUserIDReconcileMigrator) Name() string {
	return "echo_user_id_reconcile_migrator"
}

func (m *echoUserIDReconcileMigrator) Key() string {
	return commonModel.EchoUserIDReconciledKey
}

func (m *echoUserIDReconcileMigrator) CanRerun() bool {
	return false
}

func (m *echoUserIDReconcileMigrator) Migrate(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	// 1. Auto-restore lost historical account '芸舒超超超超超可爱' if echos exist but user is missing from users
	var yCount int64
	if err := db.Table("users").Where("username = ?", "芸舒超超超超超可爱").Count(&yCount).Error; err == nil && yCount == 0 {
		var echoCount int64
		if err := db.Table("echos").Where("username = ?", "芸舒超超超超超可爱").Count(&echoCount).Error; err == nil && echoCount > 0 {
			targetUID := "2e7703f0-3b65-5415-afb8-59784631d025"
			var foundUID string
			if err := db.Table("echos").Where("username = ?", "芸舒超超超超超可爱").Limit(1).Pluck("user_id", &foundUID).Error; err == nil && foundUID != "" {
				targetUID = foundUID
			}

			// Restore user profile
			_ = db.Exec(`
				INSERT OR IGNORE INTO users (id, username, email, is_admin, is_owner, avatar, locale)
				VALUES (?, '芸舒超超超超超可爱', '', 1, 0, '/api/files/images/2_1765048679_6da451.jpg', 'zh-CN')
			`, targetUID).Error

			// Restore user local password auth (MD5 hash preserved from early backup)
			_ = db.Exec(`
				INSERT OR IGNORE INTO user_local_auth (user_id, password_hash, password_algo, updated_at)
				VALUES (?, 'a44e3c7815554a0b05de8fe446e7550b', 'md5', CAST(strftime('%s','now') AS INTEGER))
			`, targetUID).Error

			// Restore QQ OAuth external identity binding
			_ = db.Exec(`
				INSERT OR IGNORE INTO user_external_identities (id, user_id, provider, subject, issuer, protocol, created_at, updated_at)
				VALUES ('019deee0-0000-7000-8000-000000000002', ?, 'qq', '1D65F809FF0F0A058D3AB4C32EA2C482', '', 'oauth2', CAST(strftime('%s','now') AS INTEGER), CAST(strftime('%s','now') AS INTEGER))
			`, targetUID).Error
		}
	}

	// 2. Reconcile echos whose user_id is not in users, but username matches an existing user
	if err := db.Exec(`
		UPDATE echos 
		SET user_id = (SELECT id FROM users WHERE users.username = echos.username)
		WHERE user_id NOT IN (SELECT id FROM users)
		  AND EXISTS (SELECT 1 FROM users WHERE users.username = echos.username)
	`).Error; err != nil {
		return err
	}

	// 3. For any remaining orphan echos whose author matches the owner or is empty, assign to owner
	return db.Exec(`
		UPDATE echos
		SET user_id = (SELECT id FROM users WHERE is_owner = 1 LIMIT 1)
		WHERE user_id NOT IN (SELECT id FROM users)
		  AND EXISTS (SELECT 1 FROM users WHERE is_owner = 1)
		  AND (username = (SELECT username FROM users WHERE is_owner = 1 LIMIT 1) OR username = '' OR username IS NULL)
	`).Error
}
