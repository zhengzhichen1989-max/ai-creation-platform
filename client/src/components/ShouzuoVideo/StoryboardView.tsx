import { useState } from 'react';
import { Box, Typography, CircularProgress, Grid, Card, CardContent, TextField, Alert, Chip, Dialog, DialogContent, DialogActions, IconButton } from '@mui/material';
import Close from '@mui/icons-material/Close';
import Download from '@mui/icons-material/Download';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import type { Storyboard } from '@/types/shouzuo';

interface StoryboardViewProps {
  storyboard: Storyboard | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onConfirm: () => void;
  onRegenerate: (count: number, frameIndex?: number) => void;
  onChangeAngle: (frameIndex: number) => void;
  changingAngleIndex: number | null;  // 正在重新生成的帧索引
}

export default function StoryboardView({
  storyboard,
  isGenerating,
  onGenerate,
  onConfirm,
  onRegenerate,
  onChangeAngle,
  changingAngleIndex,
}: StoryboardViewProps) {
  const { setStoryboard } = useShouzuoVideoStore();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const frames = storyboard?.frames ?? [];

  // 修改帧提示词
  const handlePromptChange = (index: number, newPrompt: string) => {
    if (!storyboard) return;
    const newFrames = [...frames];
    newFrames[index] = { ...newFrames[index], prompt: newPrompt };
    setStoryboard({ ...storyboard, frames: newFrames });
  };

  // 打开大图预览
  const handleImageClick = (url: string) => {
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  // 下载图片
  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `storyboard-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 降级：直接打开新窗口
      window.open(url, '_blank');
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        故事板预览
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        以下是 AI 根据您的产品生成的视频分镜脚本，您可以修改提示词后重新生成
      </Typography>

      {/* 政策提示 */}
      <Alert severity="info" sx={{ mb: 3 }} onClose={() => {/* dismissible */}}>
        因平台政策限制，视频内容不支持使用真人照片。系统已自动采用时尚摄影风格生成分镜图，确保视频可正常生成。点击「重新生成」可重新生成单帧分镜（3积分/次）。
      </Alert>

      {frames.length === 0 && !isGenerating && (
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            生成故事板
          </button>
        </Box>
      )}

      {isGenerating && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在生成故事板...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            AI 正在为每帧生成图片，请稍候
          </Typography>
        </Box>
      )}

          {frames.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {frames.map((frame, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card>
                  {frame.imageUrl && (
                    <Box
                      onClick={() => handleImageClick(frame.imageUrl)}
                      sx={{
                        height: 200,
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        '&:hover': {
                          '& .download-overlay': { opacity: 1 },
                          '& img': { opacity: 0.85 },
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={frame.imageUrl}
                        alt={`分镜 ${index + 1}`}
                        sx={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          transition: 'opacity 0.2s',
                        }}
                      />
                      <Box
                        className="download-overlay"
                        onClick={(e) => { e.stopPropagation(); handleDownload(frame.imageUrl); }}
                        sx={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          cursor: 'pointer',
                          zIndex: 5,
                        }}
                      >
                        <Download sx={{ color: '#fff', fontSize: 16 }} />
                      </Box>
                    </Box>
                  )}
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ mb: 0.5 }}>
                        分镜 {index + 1}：{frame.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <button
                          type="button"
                          onClick={() => onChangeAngle(index)}
                          disabled={isGenerating || changingAngleIndex === index}
                          style={{
                            background: 'transparent',
                            border: '1px solid #7c3aed',
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: '12px',
                            cursor: (isGenerating || changingAngleIndex === index) ? 'not-allowed' : 'pointer',
                            opacity: (isGenerating || changingAngleIndex === index) ? 0.5 : 1,
                            color: '#7c3aed',
                            position: 'relative',
                            zIndex: 50,
                          }}
                        >
                          {changingAngleIndex === index ? '生成中...' : '重新生成'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRegenerate(1, index)}
                          disabled={isGenerating}
                          style={{
                            background: 'transparent',
                            border: '1px solid #e0e0e0',
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: '12px',
                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                            opacity: isGenerating ? 0.5 : 1,
                            color: '#666',
                            position: 'relative',
                            zIndex: 50,
                          }}
                        >
                          重生成
                        </button>
                      </Box>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      {frame.prompt_cn}
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      label="英文提示词（可编辑）"
                      value={frame.prompt}
                      onChange={(e) => handlePromptChange(index, e.target.value)}
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => onRegenerate(frames.length)}
              disabled={isGenerating}
              style={{
                background: 'transparent',
                border: '2px solid #7c3aed',
                borderRadius: 20,
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.5 : 1,
                color: '#7c3aed',
              }}
            >
              全部重新生成
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isGenerating}
              style={{
                background: isGenerating ? '#ccc' : '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: 20,
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                opacity: isGenerating ? 0.7 : 1,
                position: 'relative',
                zIndex: 10,
              }}
            >
              确认并生成视频
            </button>
          </Box>
        </>
      )}

      {/* 大图预览弹窗 */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            background: '#1a1a1a',
            maxHeight: '90vh',
          },
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <IconButton
            onClick={() => setPreviewOpen(false)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: '#fff',
              background: 'rgba(0,0,0,0.5)',
              zIndex: 10,
              '&:hover': { background: 'rgba(0,0,0,0.7)' },
            }}
          >
            <Close />
          </IconButton>
          <Box
            component="img"
            src={previewUrl}
            alt="分镜大图"
            sx={{
              maxWidth: '100%',
              maxHeight: '85vh',
              objectFit: 'contain',
            }}
          />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <button
            type="button"
            onClick={() => handleDownload(previewUrl)}
            style={{
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 20,
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            下载图片
          </button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
