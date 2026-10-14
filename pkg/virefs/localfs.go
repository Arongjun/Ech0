// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

package virefs

import (
	"context"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
)

type LocalOption func(*LocalFS)

func WithDirPerm(perm os.FileMode) LocalOption {
	return func(l *LocalFS) { l.dirPerm = perm }
}

func WithCreateRoot() LocalOption {
	return func(l *LocalFS) { l.createRoot = true }
}

func WithLocalKeyFunc(fn KeyFunc) LocalOption {
	return func(l *LocalFS) { l.keyFunc = fn }
}

func WithAtomicWrite() LocalOption {
	return func(l *LocalFS) { l.atomicWrite = true }
}

func WithLocalAccessFunc(fn AccessFunc) LocalOption {
	return func(l *LocalFS) { l.accessFunc = fn }
}

type LocalFS struct {
	root        string
	dirPerm     os.FileMode
	createRoot  bool
	keyFunc     KeyFunc
	atomicWrite bool
	accessFunc  AccessFunc
}

func NewLocalFS(root string, opts ...LocalOption) (*LocalFS, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("virefs: resolve root %q: %w", root, err)
	}
	l := &LocalFS{
		root:    abs,
		dirPerm: 0o755,
	}
	for _, o := range opts {
		o(l)
	}
	if l.createRoot {
		_ = os.MkdirAll(l.root, l.dirPerm)
	}
	return l, nil
}

func (l *LocalFS) fullPath(key string) (string, error) {
	cleaned, err := CleanKey(key)
	if err != nil {
		return "", err
	}
	if l.keyFunc != nil {
		cleaned = l.keyFunc(cleaned)
	}
	joined := filepath.Join(l.root, filepath.FromSlash(cleaned))
	abs, err := filepath.Abs(joined)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrInvalidKey, err)
	}
	if !strings.HasPrefix(abs, l.root) {
		return "", fmt.Errorf("%w: resolved path escapes root", ErrInvalidKey)
	}
	return abs, nil
}

func (l *LocalFS) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	if err := ctx.Err(); err != nil {
		return nil, &OpError{Op: "Get", Key: key, Err: err}
	}
	p, err := l.fullPath(key)
	if err != nil {
		return nil, &OpError{Op: "Get", Key: key, Err: err}
	}
	f, err := os.Open(p)
	if err != nil {
		if os.IsNotExist(err) && l.keyFunc != nil {
			cleaned, cleanErr := CleanKey(key)
			if cleanErr == nil {
				rawP := filepath.Join(l.root, filepath.FromSlash(cleaned))
				if rawP != p {
					if rawF, rawErr := os.Open(rawP); rawErr == nil {
						return rawF, nil
					}
				}
			}
		}
		return nil, &OpError{Op: "Get", Key: key, Err: mapOSError(err)}
	}
	return f, nil
}

func (l *LocalFS) GetByStoragePath(ctx context.Context, storagePath string) (io.ReadCloser, error) {
	if err := ctx.Err(); err != nil {
		return nil, &OpError{Op: "GetByStoragePath", Key: storagePath, Err: err}
	}
	cleaned, err := CleanKey(storagePath)
	if err != nil {
		return nil, &OpError{Op: "GetByStoragePath", Key: storagePath, Err: err}
	}
	p := filepath.Join(l.root, filepath.FromSlash(cleaned))
	abs, err := filepath.Abs(p)
	if err != nil || !strings.HasPrefix(abs, l.root) {
		return nil, &OpError{Op: "GetByStoragePath", Key: storagePath, Err: ErrInvalidKey}
	}
	f, err := os.Open(abs)
	if err != nil {
		if os.IsNotExist(err) && l.keyFunc != nil {
			resolved := l.keyFunc(cleaned)
			resolvedP := filepath.Join(l.root, filepath.FromSlash(resolved))
			if resolvedP != abs {
				if rf, rerr := os.Open(resolvedP); rerr == nil {
					return rf, nil
				}
			}
		}
		return nil, &OpError{Op: "GetByStoragePath", Key: storagePath, Err: mapOSError(err)}
	}
	return f, nil
}

func (l *LocalFS) DeleteByStoragePath(ctx context.Context, storagePath string) error {
	if err := ctx.Err(); err != nil {
		return &OpError{Op: "DeleteByStoragePath", Key: storagePath, Err: err}
	}
	cleaned, err := CleanKey(storagePath)
	if err != nil {
		return &OpError{Op: "DeleteByStoragePath", Key: storagePath, Err: err}
	}
	p := filepath.Join(l.root, filepath.FromSlash(cleaned))
	abs, err := filepath.Abs(p)
	if err != nil || !strings.HasPrefix(abs, l.root) {
		return &OpError{Op: "DeleteByStoragePath", Key: storagePath, Err: ErrInvalidKey}
	}
	err = os.Remove(abs)
	if err != nil && os.IsNotExist(err) && l.keyFunc != nil {
		resolved := l.keyFunc(cleaned)
		resolvedP := filepath.Join(l.root, filepath.FromSlash(resolved))
		if resolvedP != abs {
			if rerr := os.Remove(resolvedP); rerr == nil {
				return nil
			}
		}
	}
	if err != nil && !os.IsNotExist(err) {
		return &OpError{Op: "DeleteByStoragePath", Key: storagePath, Err: mapOSError(err)}
	}
	return nil
}

func (l *LocalFS) Put(ctx context.Context, key string, r io.Reader, _ ...PutOption) error {
	if err := ctx.Err(); err != nil {
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	p, err := l.fullPath(key)
	if err != nil {
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	dir := filepath.Dir(p)
	if err := os.MkdirAll(dir, l.dirPerm); err != nil {
		return &OpError{Op: "Put", Key: key, Err: err}
	}

	if l.atomicWrite {
		return l.putAtomic(p, dir, key, r)
	}

	f, err := os.Create(p)
	if err != nil {
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	defer f.Close()
	if _, err := io.Copy(f, r); err != nil {
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	return nil
}

func (l *LocalFS) putAtomic(target, dir, key string, r io.Reader) error {
	tmp, err := os.CreateTemp(dir, ".virefs-tmp-*")
	if err != nil {
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	tmpName := tmp.Name()

	if _, err := io.Copy(tmp, r); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	if err := os.Rename(tmpName, target); err != nil {
		os.Remove(tmpName)
		return &OpError{Op: "Put", Key: key, Err: err}
	}
	return nil
}

func (l *LocalFS) Delete(ctx context.Context, key string) error {
	if err := ctx.Err(); err != nil {
		return &OpError{Op: "Delete", Key: key, Err: err}
	}
	p, err := l.fullPath(key)
	if err != nil {
		return &OpError{Op: "Delete", Key: key, Err: err}
	}
	if err := os.Remove(p); err != nil {
		if os.IsNotExist(err) && l.keyFunc != nil {
			cleaned, cleanErr := CleanKey(key)
			if cleanErr == nil {
				rawP := filepath.Join(l.root, filepath.FromSlash(cleaned))
				if rawP != p {
					if rawErr := os.Remove(rawP); rawErr == nil || os.IsNotExist(rawErr) {
						return nil
					}
				}
			}
		}
		return &OpError{Op: "Delete", Key: key, Err: mapOSError(err)}
	}
	return nil
}

func (l *LocalFS) List(ctx context.Context, prefix string) (*ListResult, error) {
	if err := ctx.Err(); err != nil {
		return nil, &OpError{Op: "List", Key: prefix, Err: err}
	}
	cleanedPrefix, err := CleanKey(prefix)
	if err != nil {
		return nil, &OpError{Op: "List", Key: prefix, Err: err}
	}

	dir := l.root
	if cleanedPrefix != "" {
		dir = filepath.Join(l.root, filepath.FromSlash(cleanedPrefix))
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, &OpError{Op: "List", Key: prefix, Err: mapOSError(err)}
	}

	result := &ListResult{}
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		key := e.Name()
		if cleanedPrefix != "" {
			key = cleanedPrefix + "/" + e.Name()
		}
		result.Files = append(result.Files, FileInfo{
			Key:          key,
			Size:         info.Size(),
			LastModified: info.ModTime(),
			IsDir:        e.IsDir(),
		})
	}
	return result, nil
}

func (l *LocalFS) Stat(ctx context.Context, key string) (*FileInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, &OpError{Op: "Stat", Key: key, Err: err}
	}
	p, err := l.fullPath(key)
	if err != nil {
		return nil, &OpError{Op: "Stat", Key: key, Err: err}
	}
	info, err := os.Stat(p)
	if err != nil {
		return nil, &OpError{Op: "Stat", Key: key, Err: mapOSError(err)}
	}
	return &FileInfo{
		Key:          key,
		Size:         info.Size(),
		LastModified: info.ModTime(),
		IsDir:        info.IsDir(),
		ContentType:  mime.TypeByExtension(filepath.Ext(key)),
	}, nil
}

func (l *LocalFS) Exists(ctx context.Context, key string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, &OpError{Op: "Exists", Key: key, Err: err}
	}
	p, err := l.fullPath(key)
	if err != nil {
		return false, &OpError{Op: "Exists", Key: key, Err: err}
	}
	_, err = os.Stat(p)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, &OpError{Op: "Exists", Key: key, Err: err}
}

func (l *LocalFS) Access(ctx context.Context, key string) (*AccessInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, &OpError{Op: "Access", Key: key, Err: err}
	}
	p, err := l.fullPath(key)
	if err != nil {
		return nil, &OpError{Op: "Access", Key: key, Err: err}
	}
	info := &AccessInfo{Path: p}
	if l.accessFunc != nil {
		cleaned, _ := CleanKey(key)
		if l.keyFunc != nil {
			cleaned = l.keyFunc(cleaned)
		}
		extra := l.accessFunc(cleaned)
		if extra != nil && extra.URL != "" {
			info.URL = extra.URL
		}
	}
	return info, nil
}

func (l *LocalFS) Copy(ctx context.Context, srcKey, dstKey string) error {
	if err := ctx.Err(); err != nil {
		return &OpError{Op: "Copy", Key: srcKey, Err: err}
	}
	srcPath, err := l.fullPath(srcKey)
	if err != nil {
		return &OpError{Op: "Copy", Key: srcKey, Err: err}
	}
	dstPath, err := l.fullPath(dstKey)
	if err != nil {
		return &OpError{Op: "Copy", Key: dstKey, Err: err}
	}
	sf, err := os.Open(srcPath)
	if err != nil {
		return &OpError{Op: "Copy", Key: srcKey, Err: mapOSError(err)}
	}
	defer sf.Close()

	if err := os.MkdirAll(filepath.Dir(dstPath), l.dirPerm); err != nil {
		return &OpError{Op: "Copy", Key: dstKey, Err: err}
	}
	df, err := os.Create(dstPath)
	if err != nil {
		return &OpError{Op: "Copy", Key: dstKey, Err: err}
	}
	defer df.Close()
	if _, err := io.Copy(df, sf); err != nil {
		return &OpError{Op: "Copy", Key: dstKey, Err: err}
	}
	return nil
}

var (
	_ FS     = (*LocalFS)(nil)
	_ Copier = (*LocalFS)(nil)
)

func mapOSError(err error) error {
	if os.IsNotExist(err) {
		return ErrNotFound
	}
	if os.IsPermission(err) {
		return ErrPermission
	}
	return err
}
