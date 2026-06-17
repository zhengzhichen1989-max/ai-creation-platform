// ============================================================
// 服饰短片 - 完成面板组件
// ============================================================

import { Box, Typography, Button, Stack, Card, CardContent, CardMedia, Chip, Divider } from '@mui/material';
import Download from '@mui/icons-material/Download';
import Replay from '@mui/icons-material/Replay';
import Add from '@mui/icons-material/Add';
import type { ShouzuoSessionDetail } from '@/api/shouzuoVideo';

interface CompletionPanelProps {
  sessionDetail: ShouzuoSessionDetail | null;
  onDownloadVideo?: () => void;
  onDownloadPackage?: () => void;
  onRegenerate?: () => void;
  onNewSession?: () => void;
  showcaseUrls?: string[];
}

export default function CompletionPanel({
  sessionDetail,
  onDownloadVideo,
  onDownloadPackage,
  onRegenerate,
  onNewSession,
  showcaseUrls = [],
}: CompletionPanelProps) {
  if (!sessionDetail) return null;

  const isCompleted = sessionDetail.status === 'completed';
  const isFailed = sessionDetail.status === 'failed';

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      {isCompleted && (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'success.main' }}>
            🎉 生成完成！
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            您的服饰短片和文案已生成完毕
          </Typography>
        </>
      )}

      {isFailed && (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: 'error.main' }}>
            生成失败
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {sessionDetail.errorMessage || '生成过程中发生错误，请重试'}
          </Typography>
        </>
      )}

      {/* 产品信息摘要 */}
      {sessionDetail.productInfo && (
        <Card sx={{ maxWidth: 500, mx: 'auto', mb: 2, borderRadius: 2, textAlign: 'left' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              📦 {sessionDetail.productInfo.productName}
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {sessionDetail.productInfo.category && (
                <Chip label={`品类: ${sessionDetail.productInfo.category}`} size="small" variant="outlined" />
              )}
              {sessionDetail.productInfo.material && (
                <Chip label={`材质: ${sessionDetail.productInfo.material}`} size="small" variant="outlined" />
              )}
              <Chip label="手作产品" size="small" variant="outlined" />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 高级展示图 */}
      {showcaseUrls.length > 0 && (
        <Box sx={{ maxWidth: 500, mx: 'auto', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            🖼️ 高级展示图
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {showcaseUrls.map((url, index) => (
              <Card key={index} sx={{ borderRadius: 1.5, overflow: 'hidden', width: 140 }}>
                <CardMedia
                  component="img"
                  image={url}
                  alt={`展示图${index + 1}`}
                  sx={{ width: 140, height: 140, objectFit: 'cover' }}
                />
              </Card>
            ))}
          </Box>
        </Box>
      )}

      {/* 消耗统计 */}
      <Card sx={{ maxWidth: 400, mx: 'auto', mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            生成统计
          </Typography>
          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Chip label={`消耗积分: ${sessionDetail.totalCost}`} size="small" color="primary" variant="outlined" />
            <Chip label={`故事板帧: ${sessionDetail.storyboardUrls?.length ?? 0}`} size="small" variant="outlined" />
            {showcaseUrls.length > 0 && (
              <Chip label={`展示图: ${showcaseUrls.length}`} size="small" variant="outlined" />
            )}
          </Stack>
        </CardContent>
      </Card>

      <Divider sx={{ my: 2 }} />

      {/* 操作按钮 */}
      <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
        {isCompleted && sessionDetail.videoUrl && (
          <>
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={onDownloadVideo}
              size="large"
            >
              下载视频
            </Button>
            {onDownloadPackage && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Download />}
                onClick={onDownloadPackage}
                size="large"
              >
                一键打包下载
              </Button>
            )}
          </>
        )}
        <Button
          variant="outlined"
          startIcon={<Replay />}
          onClick={onRegenerate}
          size="large"
        >
          重新生成
        </Button>
        <Button
          variant="text"
          startIcon={<Add />}
          onClick={onNewSession}
          size="large"
        >
          新建服饰短片
        </Button>
      </Stack>
    </Box>
  );
}
