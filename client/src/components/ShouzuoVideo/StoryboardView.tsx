import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ImageList,
  ImageListItem,
  Dialog,
  DialogContent,
  TextField,
  CircularProgress,
  Chip,
  Popover,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { StoryboardFrame } from '@/types/shouzuo';

interface StoryboardViewProps {
  storyboard: { frames: StoryboardFrame[]; totalFrames: number; style: string } | null;
  isGenerating: boolean;
  regeneratingFrameIndex: number | null;
  onConfirm: () => void;
  onRegenerateFrame: (frameIndex: number, feedback?: string) => void;
}

export default function StoryboardView({
  storyboard,
  isGenerating,
  regeneratingFrameIndex,
  onConfirm,
  onRegenerateFrame,
}: StoryboardViewProps) {
  const [previewFrame, setPreviewFrame] = useState<StoryboardFrame | null>(null);
  const [downloadingFrame, setDownloadingFrame] = useState<number | null>(null);
  // 单帧重新生成 feedback 弹窗
  const [editingFrameIndex, setEditingFrameIndex] = useState<number | null>(null);
  const [editingFeedback, setEditingFeedback] = useState('');
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);

  // 无数据时根据 loading 状态显示不同 UI，避免访问 null storyboard
  if (!storyboard || !storyboard.frames.length) {
    if (isGenerating) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在生成故事板...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            GPT-Image-2 正在创作分镜帧，请稍候
          </Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          尚未生成故事板，请先选择帧数并生成
        </Typography>
      </Box>
    );
  }

  /** 下载单帧图片（使用fetch+blob方案，支持跨域图片） */
  const downloadFrame = async (frame: StoryboardFrame) => {
    if (downloadingFrame === frame.index) return;
    setDownloadingFrame(frame.index);
    try {
      const response = await fetch(frame.imageUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyboard_frame_${frame.index}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // 降级：直接尝试href下载
      console.warn(`[Storyboard] 帧${frame.index} blob下载失败，尝试直接下载:`, err);
      const a = document.createElement('a');
      a.href = frame.imageUrl;
      a.download = `storyboard_frame_${frame.index}.png`;
      a.target = '_blank';
      a.click();
    } finally {
      setDownloadingFrame(null);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Loading overlay — 覆盖而非替换，避免 React 18 组件树切换 */}
      {isGenerating && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.85)',
            borderRadius: 2,
            backdropFilter: 'blur(2px)',
          }}
        >
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在生成故事板...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            GPT-Image-2 正在创作分镜帧，请稍候
          </Typography>
        </Box>
      )}
      <Typography variant="h6" sx={{ mb: 1 }}>
        Step 4: 故事板
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        风格：<Chip label={storyboard.style} size="small" /> | {storyboard.totalFrames} 个分镜帧
      </Typography>

      {/* 故事板帧网格 */}
      <ImageList cols={4} rowHeight={200} gap={8} sx={{ mb: 3 }}>
        {storyboard.frames.map((frame) => {
          const isThisFrameRegenerating = regeneratingFrameIndex === frame.index;
          return (
          <ImageListItem
            key={frame.index}
            sx={{
              cursor: 'pointer',
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              opacity: isThisFrameRegenerating ? 0.5 : 1,
              transition: 'opacity 0.3s',
            }}
            onClick={() => !isThisFrameRegenerating && setPreviewFrame(frame)}
          >
            <img
              src={frame.imageUrl}
              alt={`分镜 ${frame.index}`}
              style={{ width: '100%', height: 200, objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f0f0f0" width="200" height="200"/><text x="100" y="100" text-anchor="middle" fill="%23999" font-size="14">Frame ' + frame.index + '</text></svg>';
              }}
            />

            {/* 单帧重新生成按钮 — 悬停时显示 */}
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                opacity: 0,
                transition: 'opacity 0.2s',
                '&:hover': { opacity: 1 },
                '.MuiImageListItem-root:hover &': { opacity: 1 },
              }}
            >
              {isThisFrameRegenerating ? (
                <CircularProgress
                  size={24}
                  sx={{ color: 'white', bgcolor: 'rgba(0,0,0,0.5)', borderRadius: '50%', p: 0.3 }}
                />
              ) : (
                <Box
                  component="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFrameIndex(frame.index);
                    setEditingFeedback('');
                    setPopoverAnchor(e.currentTarget as HTMLElement);
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    bgcolor: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                    zIndex: 5,
                  }}
                  title="重新生成此帧"
                >
                  <RefreshIcon sx={{ fontSize: 16 }} />
                </Box>
              )}
            </Box>

            {/* 悬停遮罩 — 始终可见的标签 + 点击提示 */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                color: 'white',
                p: 1,
                pt: 2.5,
                opacity: 0.85,
                transition: 'opacity 0.2s',
                '&:hover': { opacity: 1 },
              }}
            >
              <Typography variant="caption" display="block" fontWeight={600}>
                分镜 {frame.index}
              </Typography>
              <Typography variant="caption" display="block" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                {frame.description?.substring(0, 24)}
              </Typography>
            </Box>
          </ImageListItem>
        )})}
      </ImageList>

      {/* 帧预览对话框 */}
      <Dialog
        open={!!previewFrame}
        onClose={() => setPreviewFrame(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 2, textAlign: 'center' }}>
          {previewFrame && (
            <>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                分镜 {previewFrame.index}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {previewFrame.description}
              </Typography>
              <img
                src={previewFrame.imageUrl}
                alt={`分镜 ${previewFrame.index}`}
                style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => downloadFrame(previewFrame)}
                  disabled={previewFrame ? downloadingFrame === previewFrame.index : false}
                >
                  下载此帧
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 重新生成提示 */}
      <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 2, mb: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          💡 如需重新生成，可点击图片右上角 <RefreshIcon sx={{ fontSize: 14, verticalAlign: 'middle' }} /> 进行单帧修改
        </Typography>
      </Box>

      {/* 确认按钮 */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        startIcon={<CheckCircleIcon />}
        onClick={onConfirm}
        sx={{ py: 1.5 }}
      >
        确认故事板，开始生成视频
      </Button>

      {/* 单帧重新生成 feedback 弹窗 */}
      <Popover
        open={editingFrameIndex !== null}
        anchorEl={popoverAnchor}
        onClose={() => { setEditingFrameIndex(null); setPopoverAnchor(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 2, width: 280 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            重新生成分镜 {editingFrameIndex}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            将使用原始提示词重新生成此帧
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="修改意见（可选）：如「背景调亮一些」"
            value={editingFeedback}
            onChange={(e) => setEditingFeedback(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={() => { setEditingFrameIndex(null); setPopoverAnchor(null); }}
            >
              取消
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                if (editingFrameIndex !== null) {
                  onRegenerateFrame(editingFrameIndex, editingFeedback || undefined);
                }
                setEditingFrameIndex(null);
                setPopoverAnchor(null);
              }}
            >
              重新生成
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}
