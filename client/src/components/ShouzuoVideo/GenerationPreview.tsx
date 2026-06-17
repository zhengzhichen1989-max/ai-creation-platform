// ============================================================
// 服饰短片 - 生成预览组件
// ============================================================

import { Box, Typography, Divider, Stack, Chip, LinearProgress, Alert, Button, Card, CardMedia, CircularProgress } from '@mui/material';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import StoryboardTimeline from './StoryboardTimeline';
import VideoPlayer from './VideoPlayer';
import CopywritingCard from './CopywritingCard';
import type { ShouzuoSessionDetail } from '@/api/shouzuoVideo';

interface GenerationPreviewProps {
  sessionDetail: ShouzuoSessionDetail | null;
  onRegenerateCopywriting?: () => void;
  isRegenerating?: boolean;
  onGenerateShowcase?: () => void;
  isGeneratingShowcase?: boolean;
  showcaseUrls?: string[];
}

/** 状态标签映射 */
const STATUS_MAP: Record<string, { label: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }> = {
  draft: { label: '草稿', color: 'default' },
  analyzing: { label: '分析中', color: 'primary' },
  analyzed: { label: '分析完成', color: 'success' },
  storyboard_generating: { label: '故事板生成中', color: 'primary' },
  storyboard_done: { label: '故事板完成', color: 'success' },
  video_generating: { label: '视频生成中', color: 'primary' },
  video_done: { label: '视频完成', color: 'success' },
  copywriting_generating: { label: '文案生成中', color: 'primary' },
  completed: { label: '全部完成', color: 'success' },
  failed: { label: '生成失败', color: 'error' },
};

export default function GenerationPreview({
  sessionDetail,
  onRegenerateCopywriting,
  isRegenerating = false,
  onGenerateShowcase,
  isGeneratingShowcase = false,
  showcaseUrls = [],
}: GenerationPreviewProps) {
  if (!sessionDetail) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          请先创建会话并开始生成
        </Typography>
      </Box>
    );
  }

  const statusInfo = STATUS_MAP[sessionDetail.status] ?? { label: sessionDetail.status, color: 'default' as const };
  const canGenerateShowcase = ['storyboard_done', 'video_done', 'video_generating', 'copywriting_generating', 'completed'].includes(sessionDetail.status);

  return (
    <Box>
      {/* 状态栏 */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          生成进度
        </Typography>
        <Chip label={statusInfo.label} size="small" color={statusInfo.color} />
      </Stack>

      {/* 错误提示 */}
      {sessionDetail.errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {sessionDetail.errorMessage}
        </Alert>
      )}

      {/* 估算积分消耗 */}
      {sessionDetail.estimatedCost && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            label={`预计消耗: ${sessionDetail.estimatedCost.total} 积分`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`故事板: ${sessionDetail.estimatedCost.storyboard}`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`视频: ${sessionDetail.estimatedCost.video}`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`文案: ${sessionDetail.estimatedCost.copywriting}`}
            size="small"
            variant="outlined"
          />
        </Stack>
      )}

      {/* 总进度条 */}
      <Box sx={{ mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={getOverallProgress(sessionDetail)}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </Box>

      {/* 故事板 */}
      <Box sx={{ mb: 3 }}>
        <StoryboardTimeline sessionDetail={sessionDetail} />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 视频 */}
      <Box sx={{ mb: 3 }}>
        <VideoPlayer sessionDetail={sessionDetail} />
      </Box>

      {/* 高级展示图（可选） */}
      {canGenerateShowcase && (
        <>
          <Divider sx={{ my: 3 }} />
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                高级展示图
              </Typography>
              {onGenerateShowcase && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={isGeneratingShowcase ? <CircularProgress size={14} /> : <AutoAwesome />}
                  onClick={onGenerateShowcase}
                  disabled={isGeneratingShowcase}
                >
                  {isGeneratingShowcase ? '生成中...' : '生成高级展示图'}
                </Button>
              )}
            </Box>

            {showcaseUrls.length > 0 ? (
              <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
                {showcaseUrls.map((url, index) => (
                  <Card key={index} sx={{ borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}>
                    <CardMedia
                      component="img"
                      image={url}
                      alt={`展示图${index + 1}`}
                      sx={{ width: 160, height: 160, objectFit: 'cover' }}
                    />
                  </Card>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                生成场景合成、细节特写等高级展示图，提升商品展示效果
              </Typography>
            )}
          </Box>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* 文案 */}
      <CopywritingCard
        sessionDetail={sessionDetail}
        onRegenerate={onRegenerateCopywriting}
        isRegenerating={isRegenerating}
      />
    </Box>
  );
}

/** 计算整体进度百分比 */
function getOverallProgress(detail: ShouzuoSessionDetail): number {
  switch (detail.status) {
    case 'draft':
    case 'analyzing':
    case 'analyzed':
      return 5;
    case 'storyboard_generating':
      return Math.round(detail.storyboardProgress * 0.33);
    case 'storyboard_done':
      return 33;
    case 'video_generating':
      return 33 + Math.round(detail.videoProgress * 0.34);
    case 'video_done':
      return 67;
    case 'copywriting_generating':
      return 67 + Math.round(detail.copywritingProgress * 0.33);
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}
