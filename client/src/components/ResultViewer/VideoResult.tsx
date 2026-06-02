import { Box, Typography, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import type { GenerationTask } from '@/api/tasks';

interface VideoResultProps {
  task: GenerationTask;
}

export function VideoResult({ task }: VideoResultProps) {
  const resultUrl = task.resultUrl;

  if (!resultUrl) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">结果暂不可用</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          mb: 2,
          bgcolor: '#000',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <video
          src={resultUrl}
          controls
          autoPlay
          style={{ maxHeight: 480, width: '100%', objectFit: 'contain' }}
        >
          您的浏览器不支持视频播放
        </video>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        提示词：{task.prompt}
      </Typography>

      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        href={resultUrl}
        download
        size="small"
      >
        下载视频
      </Button>
    </Box>
  );
}
