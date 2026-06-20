// ============================================================
// 种草视频 - 服装预处理预览组件（Step 2.5）
// 平铺图必须生成穿着效果图后才能进入后续步骤
// ============================================================

import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Stack,
} from '@mui/material';

interface PreprocessingPreviewProps {
  originalImageUrl: string;
  preprocessedImageUrl: string | null;
  preprocessingStatus: 'idle' | 'generating' | 'completed' | 'failed';
  onPreprocess: () => void;
  onConfirm: () => void;
  error: string | null;
}

export default function PreprocessingPreview({
  originalImageUrl,
  preprocessedImageUrl,
  preprocessingStatus,
  onPreprocess,
  onConfirm,
  error,
}: PreprocessingPreviewProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        服装预处理
      </Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>
        系统检测到您上传的是<strong>平铺图（无人穿着）</strong>。
        建议上传模特穿着图，分镜效果更佳；或者点击下方按钮自动生成穿着效果图。
        <strong>注意：分镜生成必须有模特穿着图才能进行。</strong>
      </Alert>

      <Stack direction="row" spacing={3} sx={{ mb: 3, flexWrap: 'wrap' }}>
        {/* 原图 */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            原始平铺图
          </Typography>
          <Paper elevation={2} sx={{ p: 1, borderRadius: 2 }}>
            <Box
              component="img"
              src={originalImageUrl}
              alt="原始图片"
              sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 1 }}
            />
          </Paper>
        </Box>

        {/* 预处理效果图 */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            穿着效果图
          </Typography>
          <Paper elevation={2} sx={{ p: 1, borderRadius: 2, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {preprocessingStatus === 'generating' && (
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={40} />
                <Typography variant="body2" color="text.secondary">正在生成穿着效果图...</Typography>
                <Typography variant="caption" color="text.disabled">消耗3积分</Typography>
              </Stack>
            )}
            {preprocessingStatus === 'completed' && preprocessedImageUrl && (
              <Box
                component="img"
                src={preprocessedImageUrl}
                alt="穿着效果图"
                sx={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 1 }}
              />
            )}
            {preprocessingStatus === 'failed' && (
              <Typography variant="body2" color="error">生成失败，请重试</Typography>
            )}
            {(!preprocessedImageUrl || preprocessingStatus === 'idle') && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
                点击下方按钮生成穿着效果图
              </Typography>
            )}
          </Paper>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 操作按钮：无跳过选项，平铺图必须预处理 */}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        {(preprocessingStatus === 'idle' || preprocessingStatus === 'failed') && (
          <Button
            variant="contained"
            onClick={onPreprocess}
            sx={{ minWidth: 220, fontWeight: 600 }}
          >
            自动生成穿着效果图（3积分）
          </Button>
        )}
        {preprocessingStatus === 'generating' && (
          <Button variant="outlined" disabled>
            生成中，请稍候...
          </Button>
        )}
        {preprocessingStatus === 'completed' && (
          <>
            <Button variant="contained" onClick={onConfirm} sx={{ minWidth: 180, fontWeight: 600 }}>
              确认，继续下一步
            </Button>
            <Button variant="outlined" onClick={onPreprocess}>
              重新生成（3积分）
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
