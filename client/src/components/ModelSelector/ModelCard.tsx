import { Card, CardContent, Typography, Chip, Box } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import type { AIModel } from '@/api/models';

interface ModelCardProps {
  model: AIModel;
  selected: boolean;
  onClick: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  starter: '入门',
  standard: '标准',
  advanced: '高级',
  flagship: '旗舰',
};

const CATEGORY_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error'> = {
  starter: 'default',
  standard: 'primary',
  advanced: 'secondary',
  flagship: 'error',
};

export function ModelCard({ model, selected, onClick }: ModelCardProps) {
  const isVideo = model.type === 'video';

  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s',
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? 'primary.50' : 'background.paper',
        '&:hover': {
          borderColor: 'primary.light',
          boxShadow: '0 2px 8px rgba(98, 0, 234, 0.15)',
        },
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {isVideo ? (
            <VideoFileIcon fontSize="small" color="secondary" />
          ) : (
            <ImageIcon fontSize="small" color="primary" />
          )}
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {model.name}
          </Typography>
          <Chip
            label={CATEGORY_LABELS[model.category] ?? model.category}
            size="small"
            color={CATEGORY_COLORS[model.category] ?? 'default'}
            variant="outlined"
            sx={{ height: 22, fontSize: 12 }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          消耗 {model.costCredits} 积分 / 次
        </Typography>
        {isVideo && model.durationOptions && (
          <Typography variant="caption" color="text.secondary" display="block">
            可选时长：{model.durationOptions.join('秒 / ')}秒
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
