// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package service

func (s *FileService) DerivePairKeyForTest(userID, filename, pairKey string) string {
	return s.derivePairKey(userID, filename, pairKey)
}
