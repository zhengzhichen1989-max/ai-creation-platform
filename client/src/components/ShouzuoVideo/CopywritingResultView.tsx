import {
  Box,
  Typography,
  Paper,
  Checkbox,
  Button,
  FormControlLabel,
  Chip,
  Divider,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { CopywritingItem } from '@/types/shouzuo';

interface CopywritingResultProps {
  items: CopywritingItem[];
  onToggleSelect: (index: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

/** 平台配色 */
const PLATFORM_COLORS: Record<string, string> = {
  xiaohongshu: '#FF2442',
  douyin: '#000000',
  instagram: '#E1306C',
};

export default function CopywritingResult({
  items,
  onToggleSelect,
  onGenerate,
  isGenerating,
}: CopywritingResultProps) {
  const anySelected = items.some((item) => item.selected);

  /** 复制文案 */
  const copyItem = (item: CopywritingItem) => {
    const text = `${item.title}\n\n${item.body}\n\n${item.hashtags.map((t) => `#${t}`).join(' ')}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Step 7: AI文案
      </Typography>

      {items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            根据视频内容和风格，AI 将自动生成小红书/抖音风格文案
          </Typography>
          <Button
            variant="contained"
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? '生成中...' : '生成文案'}
          </Button>
        </Box>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            AI 已生成 {items.length} 条文案，勾选你满意的，点击下载打包
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            {items.map((item) => (
              <Paper
                key={item.index}
                variant="outlined"
                sx={{
                  p: 2,
                  borderColor: item.selected ? 'primary.main' : 'divider',
                  borderWidth: item.selected ? 2 : 1,
                  bgcolor: item.selected ? 'primary.50' : 'background.paper',
                  transition: 'all 0.2s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={item.selected}
                        onChange={() => onToggleSelect(item.index)}
                        size="small"
                      />
                    }
                    label=""
                    sx={{ m: 0, p: 0 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {item.title}
                      </Typography>
                      <Chip
                        label={item.platform === 'xiaohongshu' ? '小红书' : item.platform}
                        size="small"
                        sx={{
                          bgcolor: `${PLATFORM_COLORS[item.platform] || '#666'}15`,
                          color: PLATFORM_COLORS[item.platform] || '#666',
                          fontSize: '0.7rem',
                        }}
                      />
                    </Box>

                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 0.5 }}>
                      {item.body}
                    </Typography>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {item.hashtags.map((tag) => (
                        <Chip
                          key={tag}
                          label={`#${tag}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>

                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon fontSize="small" />}
                      onClick={() => copyItem(item)}
                    >
                      复制全文
                    </Button>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<DownloadIcon />}
            disabled={!anySelected}
            sx={{ py: 1.5 }}
          >
            {anySelected
              ? `下载选中的 ${items.filter((i) => i.selected).length} 条文案 + 视频`
              : '请至少选择一条文案'}
          </Button>
        </>
      )}
    </Box>
  );
}
