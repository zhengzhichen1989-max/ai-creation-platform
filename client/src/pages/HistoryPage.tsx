import { useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import ArticleIcon from '@mui/icons-material/Article';
import { HistoryGrid } from '@/components/History/HistoryGrid';

export default function HistoryPage() {
  const [typeFilter, setTypeFilter] = useState<'image' | 'video' | 'text' | undefined>(undefined);

  const handleTypeChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value === 'image' || value === 'video' || value === 'text') {
      setTypeFilter(value);
    } else {
      setTypeFilter(undefined);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">历史记录</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={typeFilter ?? ''}
          onChange={handleTypeChange}
        >
          <ToggleButton value="">全部</ToggleButton>
          <ToggleButton value="image">
            <ImageIcon sx={{ mr: 0.5, fontSize: 18 }} />
            图片
          </ToggleButton>
          <ToggleButton value="video">
            <VideoFileIcon sx={{ mr: 0.5, fontSize: 18 }} />
            视频
          </ToggleButton>
          <ToggleButton value="text">
            <ArticleIcon sx={{ mr: 0.5, fontSize: 18 }} />
            文案
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <HistoryGrid type={typeFilter} />
    </Box>
  );
}
