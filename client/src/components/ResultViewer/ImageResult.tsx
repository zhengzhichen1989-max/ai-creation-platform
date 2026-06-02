import { Box, CardMedia, Typography, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import type { GenerationTask } from '@/api/tasks';

interface ImageResultProps {
  task: GenerationTask;
}

export function ImageResult({ task }: ImageResultProps) {
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
          bgcolor: '#f5f5f5',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <CardMedia
          component="img"
          image={resultUrl}
          alt={task.prompt}
          sx={{
            maxHeight: 512,
            objectFit: 'contain',
          }}
        />
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
        下载图片
      </Button>
    </Box>
  );
}
