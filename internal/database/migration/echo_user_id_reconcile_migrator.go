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

	// 1. Reconcile echos whose user_id is not in users, but username matches an existing user
	if err := db.Exec(`
		UPDATE echos 
		SET user_id = (SELECT id FROM users WHERE users.username = echos.username)
		WHERE user_id NOT IN (SELECT id FROM users)
		  AND EXISTS (SELECT 1 FROM users WHERE users.username = echos.username)
	`).Error; err != nil {
		return err
	}

	// 2. For any remaining orphan echos whose author matches the owner or is empty, assign to owner
	return db.Exec(`
		UPDATE echos
		SET user_id = (SELECT id FROM users WHERE is_owner = 1 LIMIT 1)
		WHERE user_id NOT IN (SELECT id FROM users)
		  AND EXISTS (SELECT 1 FROM users WHERE is_owner = 1)
		  AND (username = (SELECT username FROM users WHERE is_owner = 1 LIMIT 1) OR username = '' OR username IS NULL)
	`).Error
}
