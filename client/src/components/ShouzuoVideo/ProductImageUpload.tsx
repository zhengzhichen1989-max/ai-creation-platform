// ============================================================
// 服饰短片 - 产品图上传组件
// ============================================================

import { useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardMedia,
  IconButton,
  TextField,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import AddPhotoAlternate from '@mui/icons-material/AddPhotoAlternate';
import Delete from '@mui/icons-material/Delete';
import CloudUpload from '@mui/icons-material/CloudUpload';
import type { ProductImage } from '@/api/shouzuoVideo';

interface ProductImageUploadProps {
  productImages: ProductImage[];
  onUpload: (file: File, angleLabel: string) => Promise<void>;
  onRemove: (index: number) => void;
  onUpdateLabel: (index: number, label: string) => void;
  disabled?: boolean;
}

const ANGLE_LABELS = ['正面', '侧面', '背面', '顶部', '底部', '细节'];

export default function ProductImageUpload({
  productImages,
  onUpload,
  onRemove,
  onUpdateLabel,
  disabled = false,
}: ProductImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const label = ANGLE_LABELS[Math.min(i, ANGLE_LABELS.length - 1)];
      await onUpload(file, label);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload]);

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const remaining = 5 - productImages.length;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        上传产品图
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        上传1-5张产品图，建议包含不同角度的照片，以获得更好的生成效果
      </Typography>

      {/* 图片网格 */}
      <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
        {productImages.map((img, index) => (
          <Card
            key={index}
            sx={{
              width: 180,
              borderRadius: 2,
              overflow: 'visible',
              position: 'relative',
            }}
          >
            <CardMedia
              component="img"
              image={img.url}
              alt={img.angleLabel}
              sx={{
                width: 180,
                height: 180,
                objectFit: 'cover',
                borderRadius: '8px 8px 0 0',
              }}
            />
            <Box sx={{ p: 1 }}>
              <TextField
                select
                size="small"
                fullWidth
                value={img.angleLabel}
                onChange={(e) => onUpdateLabel(index, e.target.value)}
                disabled={disabled}
                sx={{ '& .MuiSelect-select': { py: 0.5, fontSize: 13 } }}
              >
                {ANGLE_LABELS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </TextField>
            </Box>
            {!disabled && (
              <IconButton
                size="small"
                onClick={() => onRemove(index)}
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'rgba(211,47,47,0.8)' },
                  width: 28,
                  height: 28,
                }}
              >
                <Delete sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Card>
        ))}

        {/* 上传按钮卡片 */}
        {remaining > 0 && (
          <Card
            sx={{
              width: 180,
              height: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed',
              borderColor: 'divider',
              bgcolor: 'action.hover',
              cursor: disabled ? 'not-allowed' : 'pointer',
              borderRadius: 2,
              '&:hover': disabled ? {} : {
                borderColor: 'primary.main',
                bgcolor: 'primary.50',
              },
            }}
            onClick={disabled ? undefined : handleClickUpload}
          >
            <AddPhotoAlternate sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              点击上传
            </Typography>
          </Card>
        )}
      </Stack>

      {/* 提示信息 */}
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          label={`已上传 ${productImages.length}/5`}
          size="small"
          color={productImages.length > 0 ? 'primary' : 'default'}
          variant="outlined"
        />
        {productImages.length === 0 && (
          <Typography variant="caption" color="error">
            请至少上传1张产品图
          </Typography>
        )}
      </Stack>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </Box>
  );
}
