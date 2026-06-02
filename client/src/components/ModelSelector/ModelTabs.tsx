import { Tabs, Tab } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import ArticleIcon from '@mui/icons-material/Article';

interface ModelTabsProps {
  activeTab: 'image' | 'video' | 'text';
  onTabChange: (tab: 'image' | 'video' | 'text') => void;
}

export function ModelTabs({ activeTab, onTabChange }: ModelTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onChange={(_, value) => onTabChange(value)}
      variant="fullWidth"
      sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
    >
      <Tab
        icon={<ImageIcon />}
        iconPosition="start"
        label="图片模型"
        value="image"
        sx={{ textTransform: 'none' }}
      />
      <Tab
        icon={<VideoFileIcon />}
        iconPosition="start"
        label="视频模型"
        value="video"
        sx={{ textTransform: 'none' }}
      />
      <Tab
        icon={<ArticleIcon />}
        iconPosition="start"
        label="文案模型"
        value="text"
        sx={{ textTransform: 'none' }}
      />
    </Tabs>
  );
}
