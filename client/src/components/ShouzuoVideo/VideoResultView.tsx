import { Box, Typography, Card, CardMedia, LinearProgress, Chip } from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { ShouzuoVideoResult } from '@/types/shouzuo';

interface VideoResultViewProps {
  result: ShouzuoVideoResult | null;
  isGenerating: boolean;
  isPolling: boolean;
}

export default function VideoResultView({ result, isGenerating, isPolling }: VideoResultViewProps) {
  // 初始加载
  if ((isGenerating || isPolling) && !result) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          正在提交视频生成任务...
        </Typography>
        <LinearProgress sx={{ maxWidth: 400, mx: 'auto' }} />
      </Box>
    );
  }

  // 生成中
  if (result && (result.status === 'pending' || result.status === 'processing')) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          <PlayCircleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          正在生成种草视频
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          基于故事板分镜生成 5-15 秒动态视频
        </Typography>
        <LinearProgress
          variant="determinate"
          value={result.progress}
          sx={{ maxWidth: 400, mx: 'auto', height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {result.progress}%
        </Typography>
      </Box>
    );
  }

  // 失败
  if (result?.status === 'failed') {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <ErrorIcon color="error" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h6" color="error">
          视频生成失败
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {result.errorMessage || '请稍后重试'}
        </Typography>
      </Box>
    );
  }

  // 完成
  if (result?.status === 'completed' && result.videoUrl) {
    return (
      <Card variant="outlined" sx={{ maxWidth: 500, mx: 'auto', overflow: 'hidden' }}>
        <CardMedia
          component="video"
          src={result.videoUrl}
          controls
          controlsList="nodownload"
          poster={result.thumbnailUrl || undefined}
          sx={{
            width: '100%',
            maxHeight: 400,
            bgcolor: '#000',
          }}
        />
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="subtitle2">
              视频生成完成
            </Typography>
            <Chip label={`${result.duration}秒`} size="small" variant="outlined" />
          </Box>
        </Box>
      </Card>
    );
  }

  return null;
}
