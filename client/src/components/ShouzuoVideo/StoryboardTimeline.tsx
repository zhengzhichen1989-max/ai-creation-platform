// ============================================================
// 服饰短片 - 故事板帧时间线组件（支持点击预览和下载）
// ============================================================

import { useState, useCallback } from 'react';
import { Box, Typography, Card, CardMedia, Chip, Stack, Dialog, DialogContent, IconButton } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Download from '@mui/icons-material/Download';
import Close from '@mui/icons-material/Close';
import ZoomIn from '@mui/icons-material/ZoomIn';
import Error from '@mui/icons-material/Error';
import type { ShouzuoSessionDetail } from '@/api/shouzuoVideo';

interface StoryboardTimelineProps {
  sessionDetail: ShouzuoSessionDetail | null;
}

/** 下载图片 */
function downloadImage(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function StoryboardTimeline({ sessionDetail }: StoryboardTimelineProps) {
  const urls = sessionDetail?.storyboardUrls;
  const taskIds = sessionDetail?.storyboardTaskIds;
  const totalFrames = taskIds?.length ?? 5;
  const completedFrames = urls?.length ?? 0;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const openPreview = useCallback((url: string, index: number) => {
    setPreviewUrl(url);
    setPreviewIndex(index);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewUrl(null);
  }, []);

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
        故事板帧
      </Typography>

      {(!taskIds || taskIds.length === 0) && (
        <Typography variant="body2" color="text.secondary">
          尚未开始生成故事板
        </Typography>
      )}

      {taskIds && taskIds.length > 0 && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Chip
              label={`${completedFrames}/${totalFrames} 完成`}
              size="small"
              color={completedFrames === totalFrames ? 'success' : 'primary'}
              variant="outlined"
            />
            {completedFrames < totalFrames && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  生成中...
                </Typography>
              </Box>
            )}
          </Stack>

          {/* 时间线展示 */}
          <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
            {taskIds.map((_, index) => {
              const url = urls?.[index];
              return (
                <Box key={index} sx={{ position: 'relative', flexShrink: 0 }}>
                  {/* 帧序号 */}
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      bgcolor: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      px: 0.5,
                      borderRadius: 0.5,
                      fontSize: 10,
                      zIndex: 1,
                    }}
                  >
                    帧{index + 1}
                  </Typography>

                  {/* 状态图标 */}
                  {url && (
                    <CheckCircle
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        color: 'success.main',
                        fontSize: 18,
                        zIndex: 1,
                        bgcolor: 'rgba(255,255,255,0.8)',
                        borderRadius: '50%',
                      }}
                    />
                  )}

                  {url ? (
                    <Card
                      sx={{
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer',
                        '&:hover .overlay': { opacity: 1 },
                      }}
                      onClick={() => openPreview(url, index)}
                    >
                      <CardMedia
                        component="img"
                        image={url}
                        alt={`帧${index + 1}`}
                        sx={{
                          width: 120,
                          height: 160,
                          objectFit: 'cover',
                        }}
                      />
                      {/* 悬停遮罩：预览 + 下载 */}
                      <Box
                        className="overlay"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0,0,0,0.4)',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.5,
                        }}
                      >
                        <ZoomIn sx={{ color: '#fff', fontSize: 28 }} />
                        <Typography variant="caption" sx={{ color: '#fff' }}>
                          点击查看
                        </Typography>
                        <IconButton
                          size="small"
                          sx={{
                            color: '#fff',
                            bgcolor: 'rgba(255,255,255,0.2)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
                            mt: 0.5,
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(url, `故事板帧${index + 1}.png`);
                          }}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </Box>
                    </Card>
                  ) : (
                    <Box
                      sx={{
                        width: 120,
                        height: 160,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'action.hover',
                        borderRadius: 1.5,
                        border: '1px dashed',
                        borderColor: 'divider',
                      }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  )}

                  {/* 连接线 */}
                  {index < taskIds.length - 1 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        right: -12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 8,
                        height: 2,
                        bgcolor: 'divider',
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* 大图预览弹窗 */}
      <Dialog
        open={previewOpen}
        onClose={closePreview}
        maxWidth="md"
        PaperProps={{ sx: { bgcolor: 'rgba(0,0,0,0.9)', position: 'relative' } }}
      >
        <IconButton
          onClick={closePreview}
          sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 1 }}
        >
          <Close />
        </IconButton>
        <DialogContent sx={{ p: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {previewUrl && (
            <>
              <Box
                component="img"
                src={previewUrl}
                alt={`故事板帧${previewIndex + 1}`}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: 1,
                }}
              />
              <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: '#fff' }}>
                  故事板帧 {previewIndex + 1} / {totalFrames}
                </Typography>
                <IconButton
                  size="small"
                  sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
                  onClick={() => downloadImage(previewUrl, `故事板帧${previewIndex + 1}.png`)}
                >
                  <Download fontSize="small" />
                </IconButton>
              </Stack>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
