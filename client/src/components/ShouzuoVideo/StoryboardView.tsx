import { Box, Typography, CircularProgress, Grid, Card, CardMedia, CardContent, TextField, Alert } from '@mui/material';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import type { Storyboard } from '@/types/shouzuo';

interface StoryboardViewProps {
  storyboard: Storyboard | null;
  isGenerating: boolean;
  onGenerate: () => void;
  onConfirm: () => void;
  onRegenerate: (count: number, frameIndex?: number) => void;
}

export default function StoryboardView({
  storyboard,
  isGenerating,
  onGenerate,
  onConfirm,
  onRegenerate,
}: StoryboardViewProps) {
  const { setStoryboard } = useShouzuoVideoStore();

  const frames = storyboard?.frames ?? [];

  // 修改帧提示词
  const handlePromptChange = (index: number, newPrompt: string) => {
    if (!storyboard) return;
    const newFrames = [...frames];
    newFrames[index] = { ...newFrames[index], prompt: newPrompt };
    setStoryboard({ ...storyboard, frames: newFrames });
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
        因平台政策限制，视频内容不支持使用真人照片。系统已自动采用时尚摄影风格（侧脸/背影/配饰遮挡/逆光剪影）生成分镜图，确保视频可正常生成。
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
            ✨ 生成故事板
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
                    <CardMedia
                      component="img"
                      image={frame.imageUrl}
                      alt={`分镜 ${index + 1}`}
                      sx={{ height: 180, objectFit: 'cover' }}
                    />
                  )}
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ mb: 0.5 }}>
                        分镜 {index + 1}：{frame.name}
                      </Typography>
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
                        🔄 重生成
                      </button>
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
              确认并生成视频 🎬
            </button>
          </Box>
        </>
      )}
    </Box>
  );
}
