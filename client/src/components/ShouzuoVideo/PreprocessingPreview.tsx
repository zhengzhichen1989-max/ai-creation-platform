// ============================================================
// 种草视频 - 服装预处理预览组件（Step 2.5）
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
  onSkip: () => void;
  onConfirm: () => void;
  error: string | null;
}

export default function PreprocessingPreview({
  originalImageUrl,
  preprocessedImageUrl,
  preprocessingStatus,
  onPreprocess,
  onSkip,
  onConfirm,
  error,
}: PreprocessingPreviewProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        服装预处理
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        系统检测到您上传的是平铺图（无人穿着）。建议自动生成穿着效果图，分镜效果更佳。
        消耗3积分，也可跳过直接使用原图。
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
              <Typography variant="body2" color="error">生成失败，请重试或跳过</Typography>
            )}
            {(preprocessingStatus === 'idle') && !preprocessedImageUrl && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
                点击下方按钮生成穿着效果图
              </Typography>
            )}
          </Paper>
        </Box>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* 操作按钮 */}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        {preprocessingStatus === 'idle' && (
          <>
            <Button
              variant="contained"
              onClick={onPreprocess}
              sx={{ minWidth: 200 }}
            >
              自动生成穿着效果图（3积分）
            </Button>
            <Button
              variant="outlined"
              onClick={onSkip}
            >
              跳过，直接使用原图
            </Button>
          </>
        )}
        {preprocessingStatus === 'generating' && (
          <Button variant="outlined" disabled>
            生成中，请稍候...
          </Button>
        )}
        {preprocessingStatus === 'failed' && (
          <>
            <Button variant="contained" onClick={onPreprocess}>
              重新生成（3积分）
            </Button>
            <Button variant="outlined" onClick={onSkip}>
              跳过，直接使用原图
            </Button>
          </>
        )}
        {preprocessingStatus === 'completed' && (
          <>
            <Button variant="contained" onClick={onConfirm} sx={{ minWidth: 160 }}>
              确认，继续下一步
            </Button>
            <Button variant="outlined" onClick={onPreprocess}>
              重新生成（3积分）
            </Button>
            <Button variant="text" onClick={onSkip}>
              使用原图
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
