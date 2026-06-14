import { Box, Typography, Card, CardMedia, LinearProgress, Chip } from '@mui/material';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { ShouzuoVideoResult } from '@/types/shouzuo';

interface VideoResultViewProps {
  result: ShouzuoVideoResult | null;
  isGenerating: boolean;
  isPolling: boolean;
  onDownload?: () => void;
}

export default function VideoResultView({ result, isGenerating, isPolling, onDownload }: VideoResultViewProps) {
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
    const isMultiSegment = (result.segmentCount ?? 0) > 0;
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          <PlayCircleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          {isMultiSegment
            ? `正在生成种草视频 (${result.segmentCompleted}/${result.segmentCount} 段)`
            : '正在生成种草视频'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {isMultiSegment
            ? `多段拼接 · 每段镜头独立生成后自动拼接 · 每个分镜100%保留`
            : '基于故事板分镜生成 5-15 秒动态视频'}
        </Typography>
        {isMultiSegment && (
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 2, flexWrap: 'wrap' }}>
            {Array.from({ length: result.segmentCount! }, (_, i) => (
              <Box
                key={i}
                sx={{
                  width: 48, height: 10, borderRadius: 5,
                  bgcolor: i < (result.segmentCompleted ?? 0) ? 'success.main' : 'grey.300',
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </Box>
        )}
        <LinearProgress
          variant="determinate"
          value={result.progress}
          sx={{ maxWidth: 400, mx: 'auto', height: 8, borderRadius: 4 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {isMultiSegment ? `${result.progress}%` : `${result.progress}%`}
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
              视频生成完成 {result.segmentCount ? `(${result.segmentCount}段拼接)` : ''}
            </Typography>
            <Chip label={`${result.duration}秒`} size="small" variant="outlined" />
          </Box>
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              style={{
                background: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: 20,
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
                marginTop: '12px',
                position: 'relative',
                zIndex: 10,
              }}
            >
              ⬇️ 下载视频
            </button>
          )}
        </Box>
      </Card>
    );
  }

  // 无数据且不在生成中 → 显示提示（不应该到达这里，但防止白屏）
  if (!result && !isGenerating && !isPolling) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography variant="body1" color="text.secondary">
          暂无视频数据，请先生成故事板并确认
        </Typography>
      </Box>
    );
  }

  return null;
}
