import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Alert,
  Chip,
} from '@mui/material';
import { useShouzuoVideo } from '@/hooks/useShouzuoVideo';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import { VIDEO_MODELS } from '@/types/shouzuo';
import type { VideoParams } from '@/types/shouzuo';

interface VideoParamsFormProps {
  onSubmit?: (params: VideoParams) => Promise<void>;
}

/** 默认参数（当没有选中风格时使用） */
const DEFAULT_PARAMS: VideoParams = {
  model: 'seedance-2.0',
  duration: 10,
  resolution: '720p',
  aspectRatio: '9:16',
  storyboard_count: 4,
};

export default function VideoParamsForm({ onSubmit }: VideoParamsFormProps) {
  const { session } = useShouzuoVideoStore();
  const { confirmVideoParams } = useShouzuoVideo();
  const selectedStyle = useShouzuoVideoStore((s) => s.selectedStyle);
  const [localParams, setLocalParams] = useState<VideoParams>(DEFAULT_PARAMS);
  const [loading, setLoading] = useState(false);

  // 表单校验
  const hasSession = !!session;
  const canSubmit = hasSession && !loading;

  // 当选中的风格变化时，应用风格默认值
  useEffect(() => {
    if (selectedStyle) {
      setLocalParams({
        model: (selectedStyle.recommended_model || 'seedance-2.0') as VideoParams['model'],
        duration: 10,
        resolution: (selectedStyle.default_resolution || '720p') as VideoParams['resolution'],
        aspectRatio: selectedStyle.default_aspect_ratio || '9:16',
        storyboard_count: selectedStyle.default_storyboard_count || 4,
      });
    }
  }, [selectedStyle]);

  const handleModelChange = (model: 'seedance-2.0' | 'kling-v3') => {
    setLocalParams({ ...localParams, model });
  };

  const handleDurationChange = (_event: Event, value: number | number[]) => {
    setLocalParams({ ...localParams, duration: value as number });
  };

  const handleResolutionChange = (resolution: '720p' | '1080p') => {
    setLocalParams({ ...localParams, resolution });
  };

  const handleStoryboardCountChange = (_event: Event, value: number | number[]) => {
    setLocalParams({ ...localParams, storyboard_count: value as number });
  };

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      if (onSubmit) {
        await onSubmit(localParams);
      } else {
        await confirmVideoParams(localParams);
      }
    } catch (err) {
      console.error('确认参数失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const estimatedCredits = () => {
    const sbCount = localParams.storyboard_count || 1;
    const dur = localParams.duration || 10;
    const res = localParams.resolution || '720p';
    const model = localParams.model || 'seedance-2.0';

    // 分镜积分：每帧 3 积分（Step 4 单独扣减）
    const storyboardCredits = sbCount * 3;

    // 视频积分（必须与后端 shouzuo.service.ts calculateEstimatedCredits 完全一致）
    // 公式：duration × 每秒单价
    let videoCredits = 0;
    if (model === 'kling-v3') {
      // Kling 3.0：720p = 7/秒, 1080p = 10/秒
      const perSecond = res === '1080p' ? 10 : 7;
      videoCredits = Math.ceil(perSecond * dur);
    } else {
      // Seedance 2.0：720p = 10/秒, 1080p = 25/秒
      const perSecond = res === '1080p' ? 25 : 10;
      videoCredits = Math.ceil(perSecond * dur);
    }

    return storyboardCredits + videoCredits;
  };

  // Portal: 将确认按钮渲染到 document.body，彻底绕开所有 MUI 层叠上下文
  const portalButton = createPortal(
    <Box
      className="video-params-portal-bar"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        textAlign: 'center',
        py: 2,
        px: 3,
        background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 25%, #fff)',
        borderTop: '1px solid',
        borderColor: 'divider',
        boxShadow: '-2px 0 12px rgba(0,0,0,0.08)',
      }}
    >
      {!hasSession && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          ⚠️ 未检测到会话，请先完成上传产品图步骤
        </Typography>
      )}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canSubmit}
        onPointerDown={(e) => {
          // 双重保险：onPointerDown 也触发提交
          if (canSubmit && !loading) {
            e.preventDefault();
            handleConfirm();
          }
        }}
        style={{
          background: !canSubmit ? '#ccc' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: '#fff',
          border: 'none',
          borderRadius: 24,
          padding: '14px 48px',
          fontSize: '16px',
          fontWeight: 700,
          cursor: !canSubmit ? 'not-allowed' : 'pointer',
          opacity: !canSubmit ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: !canSubmit ? 'none' : '0 4px 16px rgba(124, 58, 237, 0.5)',
          transition: 'all 0.2s ease',
          pointerEvents: 'auto',
        }}
        onMouseEnter={(e) => {
          if (canSubmit) {
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(124, 58, 237, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = !canSubmit ? 'none' : '0 4px 16px rgba(124, 58, 237, 0.5)';
        }}
      >
        {loading ? '提交中...' : `确认并预扣积分（约 ${estimatedCredits()} 积分）`} 🎬
      </button>
    </Box>,
    document.body
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 3: 确认视频参数
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        {/* 模型选择 */}
        <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
          <FormLabel component="legend">视频生成模型</FormLabel>
          <RadioGroup
            value={localParams.model}
            onChange={(_, value) => handleModelChange(value as 'seedance-2.0' | 'kling-v3')}
          >
            {VIDEO_MODELS.map((model) => (
              <FormControlLabel
                key={model.id}
                value={model.id}
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body1">
                      {model.icon} {model.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {model.description}
                    </Typography>
                  </Box>
                }
              />
            ))}
          </RadioGroup>
        </FormControl>

        {/* 时长选择 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">视频时长（秒）</FormLabel>
          <Slider
            value={localParams.duration}
            onChange={handleDurationChange}
            min={5}
            max={15}
            step={1}
            marks={[
              { value: 5, label: '5s' },
              { value: 10, label: '10s' },
              { value: 15, label: '15s' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>

        {/* 分辨率选择 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">分辨率</FormLabel>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              label="720P"
              onClick={() => setLocalParams({ ...localParams, resolution: '720p' })}
              color={localParams.resolution === '720p' ? 'primary' : 'default'}
              clickable
            />
            <Chip
              label="1080P"
              onClick={() => setLocalParams({ ...localParams, resolution: '1080p' })}
              color={localParams.resolution === '1080p' ? 'primary' : 'default'}
              clickable
            />
          </Box>
        </Box>

        {/* 视频比例选择 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">视频比例</FormLabel>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {(['9:16', '16:9', '1:1', '3:4'] as const).map((ratio) => (
              <Chip
                key={ratio}
                label={ratio}
                onClick={() => setLocalParams({ ...localParams, aspectRatio: ratio })}
                color={localParams.aspectRatio === ratio ? 'primary' : 'default'}
                clickable
              />
            ))}
          </Box>
        </Box>

        {/* 故事板帧数选择 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">故事板帧数（1-4帧）</FormLabel>
          <Slider
            value={localParams.storyboard_count}
            onChange={handleStoryboardCountChange}
            min={1}
            max={4}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>

        {/* 预估积分 */}
        <Alert severity="info" sx={{ mt: 2 }}>
          预估消耗积分：{estimatedCredits()} 积分
        </Alert>
      </Paper>

      {/* 占位：给 Portal 固定底部栏留出空间，防止页面内容被遮挡 */}
      <Box sx={{ height: 80 }} />

      {/* Portal 按钮 */}
      {portalButton}
    </Box>
  );
}
