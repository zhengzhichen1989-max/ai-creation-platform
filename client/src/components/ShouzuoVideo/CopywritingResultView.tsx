import { Box, Typography, Paper, Checkbox, FormControlLabel, CircularProgress, Stack } from '@mui/material';
import type { CopywritingItem } from '@/types/shouzuo';

interface CopywritingResultViewProps {
  items: CopywritingItem[];
  onToggleSelect: (index: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export default function CopywritingResultView({
  items,
  onToggleSelect,
  onGenerate,
  isGenerating,
}: CopywritingResultViewProps) {
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('已复制到剪贴板');
    } catch {
      console.warn('复制失败');
    }
  };

  const handleDownload = (item: CopywritingItem) => {
    const text = `${item.title}\n\n${item.body}\n\n${item.hashtags.map((t) => `#${t}`).join(' ')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copywriting_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        AI 文案生成
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        根据您的视频风格，AI 已生成多套文案，请选择您喜欢的版本
      </Typography>

      {items.length === 0 && !isGenerating && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <button
            type="button"
            onClick={onGenerate}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 20,
              padding: '12px 32px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              zIndex: 10,
            }}
          >
            ✨ 生成 AI 文案
          </button>
        </Box>
      )}

      {isGenerating && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在生成文案...
          </Typography>
        </Box>
      )}

      {items.length > 0 && (
        <Stack spacing={2}>
          {items.map((item, index) => (
            <Paper key={index} sx={{ p: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={item.selected}
                    onChange={() => onToggleSelect(index)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="subtitle1">{item.title}</Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                      {item.body}
                    </Typography>
                    <Typography variant="body2" color="primary" sx={{ mt: 1 }}>
                      {item.hashtags.map((t) => `#${t}`).join(' ')}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', width: '100%' }}
              />

              <Box sx={{ display: 'flex', gap: 1, mt: 1, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleCopy(`${item.title}\n\n${item.body}\n\n${item.hashtags.map((t) => `#${t}`).join(' ')}`)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #e0e0e0',
                    borderRadius: 12,
                    padding: '4px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  📋 复制
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #e0e0e0',
                    borderRadius: 12,
                    padding: '4px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  📥 下载
                </button>
              </Box>
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
}
