// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQQTokenResponse_UnmarshalJSON(t *testing.T) {
	t.Run("string expires_in from production QQ response", func(t *testing.T) {
		raw := `{"access_token":"7AFE8B9D7251BC9472E4D8D5F62674DD","expires_in":"5184000","openid":"4AFF05C9BC58943685D2425534C8D6FA","refresh_token":"C2B88CB4DF0A863361A538C9045085E9"}`
		var resp QQTokenResponse
		err := json.Unmarshal([]byte(raw), &resp)
		require.NoError(t, err)
		assert.Equal(t, "7AFE8B9D7251BC9472E4D8D5F62674DD", resp.AccessToken)
		assert.Equal(t, int64(5184000), resp.ExpiresIn)
		assert.Equal(t, "4AFF05C9BC58943685D2425534C8D6FA", resp.OpenID)
		assert.Equal(t, "C2B88CB4DF0A863361A538C9045085E9", resp.RefreshToken)
	})

	t.Run("integer expires_in", func(t *testing.T) {
		raw := `{"access_token":"tok123","expires_in":7776000,"openid":"open123","refresh_token":"ref123"}`
		var resp QQTokenResponse
		err := json.Unmarshal([]byte(raw), &resp)
		require.NoError(t, err)
		assert.Equal(t, "tok123", resp.AccessToken)
		assert.Equal(t, int64(7776000), resp.ExpiresIn)
		assert.Equal(t, "open123", resp.OpenID)
		assert.Equal(t, "ref123", resp.RefreshToken)
	})
}
