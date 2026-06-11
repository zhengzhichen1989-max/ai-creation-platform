// ============================================================
// 种草视频 - 视频播放器组件
// ============================================================

import { Box, Typography, CircularProgress, Chip, Stack } from '@mui/material';
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutline';
import type { ShouzuoSessionDetail } from '@/api/shouzuoVideo';

interface VideoPlayerProps {
  sessionDetail: ShouzuoSessionDetail | null;
}

export default function VideoPlayer({ sessionDetail }: VideoPlayerProps) {
  const videoUrl = sessionDetail?.videoUrl;
  const videoProgress = sessionDetail?.videoProgress ?? 0;
  const isGenerating = sessionDetail?.status === 'video_generating';

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        生成视频
      </Typography>

      {isGenerating && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            视频生成中... {videoProgress}%
          </Typography>
          <Chip label={`${videoProgress}%`} size="small" color="primary" variant="outlined" />
        </Stack>
      )}

      {videoUrl ? (
        <Box
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: 2,
            maxWidth: 360,
          }}
        >
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            playsInline
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 8,
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            width: '100%',
            maxWidth: 360,
            height: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          {isGenerating ? (
            <>
              <CircularProgress size={40} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                视频生成中...
              </Typography>
            </>
          ) : (
            <>
              <PlayCircleOutline sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.disabled">
                等待视频生成
              </Typography>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
