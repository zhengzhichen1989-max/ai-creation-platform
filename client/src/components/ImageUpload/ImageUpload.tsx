import { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternate';
import CloudUpload from '@mui/icons-material/CloudUpload';
import apiClient from '@/api/client';
import type { ReferenceImageRole } from '@/api/tasks';

/** 参考图项（含本地预览URL和服务器URL） */
export interface UploadedReferenceImage {
  /** 服务器返回的图片路径（如 /uploads/ref_images/xxx.jpg） */
  url: string;
  /** 本地预览URL */
  previewUrl: string;
  /** 参考图角色 */
  role: ReferenceImageRole;
}

interface ImageUploadProps {
  /** 当前选中的模型ID，用于决定显示哪些角色选项 */
  modelId: string | null;
  /** 当前选中的模型类型 */
  modelType?: 'image' | 'video' | 'text';
  /** 已上传的参考图列表 */
  value: UploadedReferenceImage[];
  /** 参考图列表变更回调 */
  onChange: (images: UploadedReferenceImage[]) => void;
}

/** 根据模型类型和ID确定可用的角色选项 */
function getAvailableRoles(modelId: string | null, modelType?: 'image' | 'video' | 'text'): { role: ReferenceImageRole; label: string }[] {
  if (!modelId || !modelType) return [];

  // 文案模型支持参考图（图片反推文案）
  if (modelType === 'text') {
    if (modelId === 'deepseek-chat' || modelId === 'qwen-max') {
      return [{ role: 'reference_image' as ReferenceImageRole, label: '参考图' }];
    }
    return [];
  }

  // 图片模型：gpt-image-2 支持编辑源图，nano-banana 和 flux-pro 支持参考图
  if (modelType === 'image') {
    if (modelId === 'gpt-image-2') {
      return [{ role: 'edit_source', label: '编辑源图' }];
    }
    // nano-banana 和 flux-pro 支持参考图（图生图）
    if (modelId === 'nano-banana-pro' || modelId === 'nano-banana-fast' || modelId === 'flux-pro') {
      return [{ role: 'reference_image', label: '参考图' }];
    }
    return [];
  }

  // 视频模型
  if (modelType === 'video') {
    // Sora-2 不支持参考图
    if (modelId === 'sora-2') return [];

    // Seedance 支持 首帧/末帧/参考图
    if (modelId === 'doubao-seedance-2-0-fast-260128' || modelId === 'doubao-seedance-2-0-260128') {
      return [
        { role: 'first_frame', label: '首帧' },
        { role: 'last_frame', label: '末帧' },
        { role: 'reference_image', label: '参考图' },
      ];
    }

    // Kling 支持 首帧/末帧
    if (modelId === 'kling-v3-video-generation') {
      return [
        { role: 'first_frame', label: '首帧' },
        { role: 'last_frame', label: '末帧' },
      ];
    }
  }

  return [];
}

/** 上传图片到服务器 */
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiClient.post<{ code: number; data: { url: string }; message: string }>(
    '/upload/image',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // 上传超时60秒
    },
  );

  if (res.data.code !== 200 && res.data.code !== 201) {
    throw new Error(res.data.message || '上传失败');
  }

  return res.data.data.url;
}

export function ImageUpload({ modelId, modelType, value, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableRoles = getAvailableRoles(modelId, modelType);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0]; // 每次只取第一个文件
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert('图片大小不能超过10MB');
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('仅支持 jpg/jpeg/png/webp 格式的图片');
        return;
      }

      setUploading(true);
      try {
        const url = await uploadImage(file);
        const previewUrl = URL.createObjectURL(file);

        // 默认角色为第一个可用角色
        const defaultRole = availableRoles[0].role;

        const newImage: UploadedReferenceImage = {
          url,
          previewUrl,
          role: defaultRole,
        };

        onChange([...value, newImage]);
      } catch (err) {
        console.error('图片上传失败:', err);
        alert('图片上传失败，请重试');
      } finally {
        setUploading(false);
      }

      // 重置 input 以允许再次选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [value, onChange, availableRoles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      const newImages = [...value];
      // 释放预览URL
      URL.revokeObjectURL(newImages[index].previewUrl);
      newImages.splice(index, 1);
      onChange(newImages);
    },
    [value, onChange],
  );

  const handleRoleChange = useCallback(
    (index: number, newRole: ReferenceImageRole) => {
      const newImages = [...value];
      newImages[index] = { ...newImages[index], role: newRole };
      onChange(newImages);
    },
    [value, onChange],
  );

  // 当前模型不支持参考图时不渲染
  if (availableRoles.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
        参考图（可选）
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 已上传的图片 */}
        {value.map((img, index) => (
          <Box
            key={img.url}
            sx={{
              width: 120,
              height: 140,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 1,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'grey.300',
            }}
          >
            <img
              src={img.previewUrl}
              alt="参考图预览"
              style={{ width: 120, height: 90, objectFit: 'cover' }}
            />
            <Box sx={{ p: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FormControl size="small" sx={{ flex: 1, minWidth: 70 }}>
                <InputLabel sx={{ fontSize: 12 }}>角色</InputLabel>
                <Select
                  value={img.role}
                  label="角色"
                  onChange={(e) => handleRoleChange(index, e.target.value as ReferenceImageRole)}
                  sx={{ fontSize: 12, height: 28 }}
                >
                  {availableRoles.map((r) => (
                    <MenuItem key={r.role} value={r.role} sx={{ fontSize: 12 }}>
                      {r.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <IconButton
              size="small"
              onClick={() => handleRemove(index)}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                width: 22,
                height: 22,
              }}
            >
              <Close sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}

        {/* 上传区域 */}
        <Box
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            width: 120,
            height: 140,
            border: '2px dashed',
            borderColor: uploading ? 'primary.main' : 'grey.400',
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'action.hover',
            },
          }}
        >
          {uploading ? (
            <>
              <CloudUpload sx={{ fontSize: 28, color: 'primary.main', mb: 0.5 }} />
              <Typography variant="caption" color="primary">
                上传中...
              </Typography>
            </>
          ) : (
            <>
              <AddPhotoAlternate sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
              <Typography variant="caption" color="text.secondary">
                拖拽或点击上传
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        支持 jpg/png/webp，最大10MB
      </Typography>
    </Box>
  );
}
