import { Card, CardContent, CardMedia, Typography, Box, Chip } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import ArticleIcon from '@mui/icons-material/Article';
import dayjs from 'dayjs';
import type { GenerationItem } from '@/api/generations';

interface HistoryCardProps {
  item: GenerationItem;
}

export function HistoryCard({ item }: HistoryCardProps) {
  const isVideo = item.type === 'video';
  const isText = item.type === 'text';
  const thumbnailUrl = item.resultThumbnail || item.resultUrl;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        },
      }}
    >
      {/* Thumbnail */}
      {thumbnailUrl && item.type === 'image' ? (
        <CardMedia
          component="img"
          image={thumbnailUrl}
          alt={item.prompt}
          sx={{ height: 180, objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
          }}
        >
          {isVideo ? (
            <VideoFileIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          ) : isText ? (
            <ArticleIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          ) : (
            <ImageIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
          )}
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Chip
            icon={isVideo ? <VideoFileIcon /> : isText ? <ArticleIcon /> : <ImageIcon />}
            label={isVideo ? '视频' : isText ? '文案' : '图片'}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
          <Typography variant="caption" color="text.secondary">
            {item.modelName}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 0.5,
          }}
        >
          {item.prompt}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            {dayjs(item.createdAt).format('MM-DD HH:mm')}
          </Typography>
          {item.expiresAt && item.status === 'completed' && (
            <Typography variant="caption" color={dayjs(item.expiresAt).diff(dayjs(), 'day') < 7 ? 'error' : 'text.secondary'}>
              {dayjs(item.expiresAt).isBefore(dayjs()) ? '已过期' : `${dayjs(item.expiresAt).diff(dayjs(), 'day')}天后过期`}
            </Typography>
          )}
          <Typography variant="caption" color="primary" fontWeight={600}>
            -{item.costCredits} 积分
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
