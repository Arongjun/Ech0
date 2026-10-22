// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package router

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/lin-snow/ech0/internal/config"
	"github.com/lin-snow/ech0/internal/handler"
	"github.com/lin-snow/ech0/internal/mcp"
	"github.com/lin-snow/ech0/internal/middleware"
	authService "github.com/lin-snow/ech0/internal/service/auth"
)

type AppRouterGroup struct {
	ResourceGroup           *gin.RouterGroup
	PublicRouterGroup       *gin.RouterGroup
	AuthRouterGroup         *gin.RouterGroup
	OptionalAuthRouterGroup *gin.RouterGroup
	WSRouterGroup           *gin.RouterGroup
	MCPRouterGroup          *gin.RouterGroup
}

func SetupRouter(r *gin.Engine, h *handler.Bundle, mwDeps *middleware.Deps) {
	setupTemplateRoutes(r, h)
	setupStaticFiles(r)
	setupMiddleware(r)
	groups := setupRouterGroup(r, mwDeps)
	api := setupHumaAPI(r)

	revoker := revokerOf(mwDeps)
	setupResourceRoutes(groups, h)
	setupAuthRoutes(groups, h)
	setupCommentRoutes(groups, h)
	setupFileRoutes(groups, h)
	setupDashboardRoutes(groups, h)
	setupCopilotRoutes(groups, h)
	setupUserRoutes(groups, h)
	registerOperations(api, h, revoker)
	setupMigrationRoutes(groups, h)
	setupMCPRoutes(groups, h)
}

func setupStaticFiles(r *gin.Engine) {
	root := config.Config().Storage.DataRoot
	if root == "" {
		root = "data/files"
	}
	r.Group("api/files", middleware.StaticFileSecurity()).StaticFS("/", http.Dir(root))

	// 兼容旧版 /images 图片链接：依次尝试 <DataRoot>/images 和旧默认的 data/images，
	// 启动时解析为绝对路径并确认是目录，避免之后受工作目录变化影响或误挂载普通文件。
	if imagesRoot := resolveLegacyImagesRoot(root); imagesRoot != "" {
		r.Group("images", middleware.StaticFileSecurity()).StaticFS("/", http.Dir(imagesRoot))
	}
}

func revokerOf(mwDeps *middleware.Deps) authService.TokenRevoker {
	if mwDeps != nil {
		return mwDeps.TokenRevoker
	}
	return nil
}

func setupRouterGroup(r *gin.Engine, mwDeps *middleware.Deps) *AppRouterGroup {
	revoker := revokerOf(mwDeps)

	resource := r.Group("/")
	public := r.Group("/api")
	auth := r.Group("/api")
	auth.Use(middleware.NoCache(), middleware.RequireAuth(revoker))
	optionalAuth := r.Group("/api")
	optionalAuth.Use(middleware.NoCache(), middleware.OptionalAuth(revoker))
	ws := r.Group("/ws")
	mcpGroup := r.Group(mcp.MCPEndpointPath)
	mcpGroup.Use(middleware.NoCache(), middleware.RequireAuth(revoker))
	return &AppRouterGroup{
		ResourceGroup:           resource,
		PublicRouterGroup:       public,
		AuthRouterGroup:         auth,
		OptionalAuthRouterGroup: optionalAuth,
		WSRouterGroup:           ws,
		MCPRouterGroup:          mcpGroup,
	}
}

func resolveLegacyImagesRoot(dataRoot string) string {
	candidates := []string{filepath.Join(dataRoot, "images"), filepath.Join("data", "images")}
	for _, c := range candidates {
		abs, err := filepath.Abs(c)
		if err != nil {
			continue
		}
		if info, err := os.Stat(abs); err == nil && info.IsDir() {
			return abs
		}
	}
	return ""
}
