// ============================================================
// 服饰短片 - 文案卡片组件
// ============================================================

import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  CircularProgress,
  Button,
} from '@mui/material';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Refresh from '@mui/icons-material/Refresh';
import type { ShouzuoSessionDetail } from '@/api/shouzuoVideo';

/** 文案项 */
interface CopywritingItem {
  title: string;
  content: string;
  tags: string[];
}

interface CopywritingCardProps {
  sessionDetail: ShouzuoSessionDetail | null;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

/** 尝试解析文案JSON */
function parseCopywritingResult(result: string | null): CopywritingItem[] {
  if (!result) return [];
  try {
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) {
      return parsed.map((item: Record<string, unknown>) => ({
        title: String(item.title || ''),
        content: String(item.content || ''),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      }));
    }
    // 如果整个结果就是一条文案
    return [{ title: '种草文案', content: result, tags: [] }];
  } catch {
    // 如果不是 JSON，当作纯文本
    return [{ title: '种草文案', content: result, tags: [] }];
  }
}

export default function CopywritingCard({ sessionDetail, onRegenerate, isRegenerating = false }: CopywritingCardProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copywritingResult = sessionDetail?.copywritingResult;
  const isGenerating = sessionDetail?.status === 'copywriting_generating';
  const items = parseCopywritingResult(copywritingResult);

  const handleCopy = useCallback(async (item: CopywritingItem, index: number) => {
    const text = `${item.title}\n\n${item.content}\n\n${item.tags.join(' ')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          种草文案
        </Typography>
        {onRegenerate && (
          <Button
            size="small"
            startIcon={isRegenerating ? <CircularProgress size={14} /> : <Refresh />}
            onClick={onRegenerate}
            disabled={isGenerating || isRegenerating}
          >
            {isRegenerating ? '生成中...' : '再生成一条'}
          </Button>
        )}
      </Box>

      {isGenerating && !copywritingResult && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            文案生成中...
          </Typography>
        </Box>
      )}

      {items.length === 0 && !isGenerating && (
        <Typography variant="body2" color="text.disabled">
          等待文案生成
        </Typography>
      )}

      <Stack spacing={1.5}>
        {items.map((item, index) => (
          <Card
            key={index}
            sx={{
              borderRadius: 2,
              bgcolor: 'grey.50',
              '&:hover': { boxShadow: 1 },
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, mr: 1 }}>
                  {item.title}
                </Typography>
                <Tooltip title={copiedIndex === index ? '已复制' : '复制文案'}>
                  <IconButton size="small" onClick={() => handleCopy(item, index)}>
                    <ContentCopy sx={{ fontSize: 16, color: copiedIndex === index ? 'success.main' : 'text.secondary' }} />
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="body2" sx={{ my: 1, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {item.content}
              </Typography>
              {item.tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {item.tags.map((tag, ti) => (
                    <Chip
                      key={ti}
                      label={tag}
                      size="small"
                      sx={{ fontSize: 11, height: 22 }}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
