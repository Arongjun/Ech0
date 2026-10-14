// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package handler

import (
	"context"

	"github.com/gin-gonic/gin"
	res "github.com/lin-snow/ech0/internal/handler/response"
	commonModel "github.com/lin-snow/ech0/internal/model/common"
	service "github.com/lin-snow/ech0/internal/service/file"
	"github.com/lin-snow/ech0/internal/storage"
)

type FileHandler struct {
	fileService service.Service
}

func NewFileHandler(fileService service.Service) *FileHandler {
	return &FileHandler{fileService: fileService}
}

type (
	ListFilesInput struct {
		Page        int    `query:"page" doc:"页码"`
		PageSize    int    `query:"pageSize" doc:"每页数量"`
		Search      string `query:"search" doc:"搜索关键词"`
		StorageType string `query:"storage_type" doc:"存储类型"`
	}
	ListFileTreeInput struct {
		StorageType string `query:"storage_type" required:"true" doc:"存储类型"`
		Prefix      string `query:"prefix" doc:"路径前缀"`
	}
	GetFileByIDInput struct {
		ID string `path:"id" doc:"文件 ID"`
	}
	DeleteFileInput struct {
		ID string `path:"id" doc:"文件 ID"`
	}
	UpdateFileMetaInput struct {
		ID   string `path:"id" doc:"文件 ID"`
		Body commonModel.UpdateFileMetaDto
	}
	CreateExternalFileInput struct {
		Body commonModel.CreateExternalFileDto
	}
	GetFilePresignURLInput struct {
		Body commonModel.GetPresignURLDto
	}
)

type (
	FileListOutput = commonModel.Result[commonModel.FileListResultDto]
	FileTreeOutput = commonModel.Result[commonModel.FileTreeResultDto]
	FileOutput     = commonModel.Result[commonModel.FileDto]
	PresignOutput  = commonModel.Result[commonModel.PresignDto]
	EmptyOutput    = commonModel.Result[any]
)

func (fileHandler *FileHandler) ListFiles(ctx context.Context, in *ListFilesInput) (FileListOutput, error) {
	query := commonModel.FileListQueryDto{Page: in.Page, PageSize: in.PageSize, Search: in.Search, StorageType: in.StorageType}
	result, err := fileHandler.fileService.ListFiles(ctx, query)
	if err != nil {
		return FileListOutput{}, err
	}
	return commonModel.OK(result), nil
}

func (fileHandler *FileHandler) ListFileTree(ctx context.Context, in *ListFileTreeInput) (FileTreeOutput, error) {
	query := commonModel.FileTreeQueryDto{StorageType: in.StorageType, Prefix: in.Prefix}
	result, err := fileHandler.fileService.ListFileTree(ctx, query)
	if err != nil {
		return FileTreeOutput{}, err
	}
	return commonModel.OK(result), nil
}

func (fileHandler *FileHandler) GetFileByID(ctx context.Context, in *GetFileByIDInput) (FileOutput, error) {
	fileDto, err := fileHandler.fileService.GetFileByID(ctx, in.ID)
	if err != nil {
		return FileOutput{}, err
	}
	return commonModel.OK(fileDto), nil
}

func (fileHandler *FileHandler) UpdateFileMeta(ctx context.Context, in *UpdateFileMetaInput) (FileOutput, error) {
	fileDto, err := fileHandler.fileService.UpdateFileMeta(ctx, in.ID, in.Body)
	if err != nil {
		return FileOutput{}, err
	}
	return commonModel.OK(fileDto), nil
}

func (fileHandler *FileHandler) CreateExternalFile(ctx context.Context, in *CreateExternalFileInput) (FileOutput, error) {
	fileDto, err := fileHandler.fileService.CreateExternalFile(ctx, in.Body)
	if err != nil {
		return FileOutput{}, err
	}
	return commonModel.OK(fileDto, commonModel.UPLOAD_SUCCESS), nil
}

func (fileHandler *FileHandler) DeleteFile(ctx context.Context, in *DeleteFileInput) (EmptyOutput, error) {
	if err := fileHandler.fileService.DeleteFile(ctx, in.ID); err != nil {
		return EmptyOutput{}, err
	}
	return commonModel.OK[any](nil, commonModel.DELETE_SUCCESS), nil
}

func (fileHandler *FileHandler) GetFilePresignURL(ctx context.Context, in *GetFilePresignURLInput) (PresignOutput, error) {
	presignDto, err := fileHandler.fileService.GetFilePresignURL(ctx, &in.Body)
	if err != nil {
		return PresignOutput{}, err
	}
	return commonModel.OK(presignDto, commonModel.GET_S3_PRESIGN_URL_SUCCESS), nil
}

func (fileHandler *FileHandler) UploadFile() gin.HandlerFunc {
	return res.Execute(func(ctx *gin.Context) res.Response {
		file, err := ctx.FormFile("file")
		if err != nil {
			return res.Response{Msg: commonModel.INVALID_REQUEST_BODY, Err: err}
		}
		category := storage.NormalizeCategory(ctx.PostForm("category"))
		storageType := storage.NormalizeStorageType(ctx.PostForm("storage_type"))
		pairKey := ctx.PostForm("pair_key")
		reqCtx := ctx.Request.Context()
		if pairKey != "" {
			reqCtx = service.WithPairKey(reqCtx, pairKey)
		}
		fileDto, err := fileHandler.fileService.UploadFile(reqCtx, file, category, storageType)
		if err != nil {
			return res.Response{Msg: "", Err: err}
		}
		return res.Response{Data: fileDto, Msg: commonModel.UPLOAD_SUCCESS}
	})
}

func (fileHandler *FileHandler) StreamFileByID(ctx *gin.Context) {
	id := ctx.Param("id")
	if id == "" {
		ctx.Status(400)
		return
	}
	fileHandler.fileService.StreamFileByID(ctx, id)
}

func (fileHandler *FileHandler) StreamFileByPath(ctx *gin.Context) {
	var query commonModel.FilePathStreamQueryDto
	if err := ctx.ShouldBindQuery(&query); err != nil {
		ctx.String(400, commonModel.INVALID_QUERY_PARAMS)
		return
	}
	fileHandler.fileService.StreamFileByPath(ctx, query)
}

func (fileHandler *FileHandler) DeleteFileByPath() gin.HandlerFunc {
	return res.Execute(func(ctx *gin.Context) res.Response {
		var query commonModel.FilePathDeleteQueryDto
		if err := ctx.ShouldBindQuery(&query); err != nil {
			return res.Response{Msg: commonModel.INVALID_QUERY_PARAMS, Err: err}
		}
		if err := fileHandler.fileService.DeleteFileByPath(ctx.Request.Context(), query.StorageType, query.Path); err != nil {
			return res.Response{Msg: "", Err: err}
		}
		return res.Response{Msg: commonModel.DELETE_SUCCESS}
	})
}
