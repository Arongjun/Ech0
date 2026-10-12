// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package handler

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	res "github.com/lin-snow/ech0/internal/handler/response"
	authModel "github.com/lin-snow/ech0/internal/model/auth"
	commonModel "github.com/lin-snow/ech0/internal/model/common"
	userModel "github.com/lin-snow/ech0/internal/model/user"
	jwtUtil "github.com/lin-snow/ech0/internal/util/jwt"
)

type (
	OAuthBindBody struct {
		RedirectURI string `json:"redirect_uri" doc:"OAuth 回调地址"`
	}
	OAuthBindInput struct {
		Provider string `path:"provider" doc:"OAuth2 提供商 (github/google/qq/custom)"`
		Body     OAuthBindBody
	}
	GetOAuthInfoInput struct {
		Provider string `query:"provider" doc:"OAuth2 提供商，默认 github"`
	}
)

type (
	OAuthBindOutput = commonModel.Result[string]
	OAuthInfoOutput = commonModel.Result[userModel.OAuthInfoDto]
)

func normalizeOAuthProvider(provider string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case string(commonModel.OAuth2GITHUB):
		return string(commonModel.OAuth2GITHUB), true
	case string(commonModel.OAuth2GOOGLE):
		return string(commonModel.OAuth2GOOGLE), true
	case string(commonModel.OAuth2QQ):
		return string(commonModel.OAuth2QQ), true
	case string(commonModel.OAuth2CUSTOM):
		return string(commonModel.OAuth2CUSTOM), true
	default:
		return "", false
	}
}

func resolveErrorRedirect(ctx *gin.Context, state, errMsg string) string {
	if state != "" {
		oauthState, err := jwtUtil.ParseOAuthState(state)
		if err == nil && oauthState != nil && oauthState.Redirect != "" {
			if u, parseErr := url.Parse(oauthState.Redirect); parseErr == nil && (u.Scheme == "http" || u.Scheme == "https") {
				q := u.Query()
				if oauthState.Action == string(authModel.OAuth2ActionBind) {
					q.Set("bind", "failed")
				}
				q.Set("error", errMsg)
				u.RawQuery = q.Encode()
				return u.String()
			}
		}
	}

	host := ctx.Request.Host
	if host != "" {
		scheme := "https"
		if ctx.Request.TLS == nil && ctx.GetHeader("X-Forwarded-Proto") != "https" {
			scheme = "http"
		}
		return fmt.Sprintf("%s://%s/auth?error=%s", scheme, host, url.QueryEscape(errMsg))
	}
	return "/auth?error=" + url.QueryEscape(errMsg)
}

func (h *AuthHandler) OAuthLogin() gin.HandlerFunc {
	return res.Execute(func(ctx *gin.Context) res.Response {
		provider, ok := normalizeOAuthProvider(ctx.Param("provider"))
		if !ok {
			errMsg := "不支持的 OAuth 提供商"
			return res.Response{Msg: errMsg, Err: errors.New(errMsg)}
		}

		redirectURI := ctx.Query("redirect_uri")
		redirectURL, err := h.authService.GetOAuthLoginURL(provider, redirectURI)
		if err != nil {
			if redirectURI != "" {
				if u, parseErr := url.Parse(redirectURI); parseErr == nil && (u.Scheme == "http" || u.Scheme == "https") {
					q := u.Query()
					q.Set("error", err.Error())
					u.RawQuery = q.Encode()
					ctx.Redirect(302, u.String())
					return res.Response{}
				}
			}
			return res.Response{Msg: err.Error(), Err: err}
		}
		ctx.Redirect(302, redirectURL)
		return res.Response{}
	})
}

func (h *AuthHandler) OAuthCallback() gin.HandlerFunc {
	return res.Execute(func(ctx *gin.Context) res.Response {
		provider, ok := normalizeOAuthProvider(ctx.Param("provider"))
		if !ok {
			errMsg := "不支持的 OAuth 提供商"
			if targetURL := resolveErrorRedirect(ctx, "", errMsg); targetURL != "" {
				ctx.Redirect(302, targetURL)
				return res.Response{}
			}
			return res.Response{Msg: errMsg, Err: errors.New(errMsg)}
		}
		code := ctx.Query("code")
		state := ctx.Query("state")
		if code == "" || state == "" {
			errMsg := "缺少必要的授权码或状态参数"
			if targetURL := resolveErrorRedirect(ctx, state, errMsg); targetURL != "" {
				ctx.Redirect(302, targetURL)
				return res.Response{}
			}
			return res.Response{Msg: errMsg, Err: errors.New(errMsg)}
		}

		redirectURL, err := h.authService.HandleOAuthCallback(provider, code, state)
		if err != nil || redirectURL == "" {
			errMsg := "OAuth 认证失败"
			if err != nil {
				errMsg = err.Error()
			}
			if targetURL := resolveErrorRedirect(ctx, state, errMsg); targetURL != "" {
				ctx.Redirect(302, targetURL)
				return res.Response{}
			}
			return res.Response{Msg: errMsg, Err: err}
		}
		ctx.Redirect(302, redirectURL)
		return res.Response{}
	})
}

func (h *AuthHandler) OAuthBind(ctx context.Context, in *OAuthBindInput) (OAuthBindOutput, error) {
	provider, ok := normalizeOAuthProvider(in.Provider)
	if !ok {
		return OAuthBindOutput{}, commonModel.NewBizError(commonModel.ErrCodeInvalidRequest, commonModel.INVALID_PARAMS)
	}
	bindURL, err := h.authService.BindOAuth(ctx, provider, in.Body.RedirectURI)
	if err != nil {
		return OAuthBindOutput{}, err
	}
	return commonModel.OK(bindURL, commonModel.GET_OAUTH_BINGURL_SUCCESS), nil
}

func (h *AuthHandler) GetOAuthInfo(ctx context.Context, in *GetOAuthInfoInput) (OAuthInfoOutput, error) {
	provider := in.Provider
	switch provider {
	case string(commonModel.OAuth2GITHUB),
		string(commonModel.OAuth2GOOGLE),
		string(commonModel.OAuth2QQ),
		string(commonModel.OAuth2CUSTOM):
	default:
		provider = string(commonModel.OAuth2GITHUB)
	}

	oauthInfo, _ := h.authService.GetOAuthInfo(ctx, provider)
	return commonModel.OK(oauthInfo, commonModel.GET_OAUTH_INFO_SUCCESS), nil
}

func (h *AuthHandler) OAuthUnbind() gin.HandlerFunc {
	return res.Execute(func(ctx *gin.Context) res.Response {
		provider, ok := normalizeOAuthProvider(ctx.Param("provider"))
		if !ok {
			return res.Response{Msg: commonModel.INVALID_PARAMS, Err: commonModel.NewBizError(commonModel.ErrCodeInvalidRequest, commonModel.INVALID_PARAMS)}
		}
		if err := h.authService.UnbindOAuth(ctx.Request.Context(), provider); err != nil {
			return res.Response{Err: err}
		}
		return res.Response{Msg: commonModel.SUCCESS_MESSAGE}
	})
}
