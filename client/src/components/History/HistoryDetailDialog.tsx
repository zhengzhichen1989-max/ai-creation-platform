import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, IconButton } from '@mui/material';
import Close from '@mui/icons-material/Close';
import Download from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import ArticleIcon from '@mui/icons-material/Article';
import dayjs from 'dayjs';
import type { GenerationItem } from '@/api/generations';

interface HistoryDetailDialogProps {
  item: GenerationItem | null;
  open: boolean;
  onClose: () => void;
}

export function HistoryDetailDialog({ item, open, onClose }: HistoryDetailDialogProps) {
  if (!item) return null;

  const isVideo = item.type === 'video';
  const isText = item.type === 'text';
  const isImage = item.type === 'image';

  const handleDownload = async () => {
    if (!item.resultUrl) return;

    try {
      const response = await fetch(item.resultUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.type}_${item.id}.${isVideo ? 'mp4' : isImage ? 'png' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(item.resultUrl, '_blank');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { bgcolor: isVideo ? 'grey.900' : 'background.paper' },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: isVideo ? 'common.white' : 'text.primary' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={isVideo ? <VideoFileIcon /> : isText ? <ArticleIcon /> : <ImageIcon />}
            label={isVideo ? '视频' : isText ? '文案' : '图片'}
            size="small"
            variant="outlined"
            sx={{ color: isVideo ? 'common.white' : undefined, borderColor: isVideo ? 'grey.600' : undefined }}
          />
          <Typography variant="body2" sx={{ color: isVideo ? 'grey.400' : 'text.secondary' }}>
            {item.modelName}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: isVideo ? 'common.white' : 'text.secondary' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {/* Result display */}
        {item.resultUrl && isImage && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <img
              src={item.resultUrl}
              alt={item.prompt}
              style={{
                maxWidth: '100%',
                maxHeight: 512,
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </Box>
        )}

        {item.resultUrl && isVideo && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <video
              src={item.resultUrl}
              controls
              autoPlay
              style={{
                maxWidth: '100%',
                maxHeight: 480,
                borderRadius: 8,
              }}
            >
              您的浏览器不支持视频播放
            </video>
          </Box>
        )}

        {item.resultUrl && isText && (
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, mb: 2, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body2">
              {item.resultUrl.startsWith('http') ? '文案内容请点击下载查看' : item.resultUrl}
            </Typography>
          </Box>
        )}

        {!item.resultUrl && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">结果暂不可用或已过期</Typography>
          </Box>
        )}

        {/* Prompt */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            提示词
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
            {item.prompt}
          </Typography>
        </Box>

        {/* Meta info */}
        <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            创建时间：{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
          </Typography>
          <Typography variant="caption" color="primary" fontWeight={600}>
            消耗 {item.costCredits} 积分
          </Typography>
          {item.expiresAt && item.status === 'completed' && (
            <Typography variant="caption" color={dayjs(item.expiresAt).isBefore(dayjs()) ? 'error' : 'text.secondary'}>
              {dayjs(item.expiresAt).isBefore(dayjs()) ? '已过期' : `${dayjs(item.expiresAt).diff(dayjs(), 'day')}天后过期`}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        {item.resultUrl && (
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleDownload}
            size="small"
          >
            下载{isVideo ? '视频' : isImage ? '图片' : '文案'}
          </Button>
        )}
        <Button onClick={onClose} size="small">
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );
}
