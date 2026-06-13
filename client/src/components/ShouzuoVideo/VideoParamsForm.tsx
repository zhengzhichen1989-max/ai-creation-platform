import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
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
import { VIDEO_MODELS } from '@/types/shouzuo';
import type { VideoParams } from '@/types/shouzuo';

interface VideoParamsFormProps {
  onNext: () => void;
}

export default function VideoParamsForm({ onNext }: VideoParamsFormProps) {
  const { session, selectedStyle, videoParams, confirmVideoParams, setVideoParams } = useShouzuoVideo();
  const [localParams, setLocalParams] = useState<VideoParams>({
    model: 'seedance-2.0',
    duration: 10,
    resolution: '720p',
    storyboard_count: 4,
  });

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
    try {
      await confirmVideoParams(localParams);
      onNext();
    } catch (err) {
      console.error('确认参数失败:', err);
    }
  };

  const estimatedCredits = () => {
    let credits = 0;
    // 故事板成本：每帧 3 积分
    credits += localParams.storyboard_count * 3;
    // 视频成本：根据模型和分辨率
    if (localParams.model === 'kling-v3') {
      credits += localParams.resolution === '1080p' ? 50 : 35;
    } else {
      credits += localParams.resolution === '1080p' ? 30 : 20;
    }
    // 文案成本：1 积分
    credits += 1;
    return credits;
  };

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
              onClick={() => handleResolutionChange('720p')}
              color={localParams.resolution === '720p' ? 'primary' : 'default'}
              clickable
            />
            <Chip
              label="1080P"
              onClick={() => handleResolutionChange('1080p')}
              color={localParams.resolution === '1080p' ? 'primary' : 'default'}
              clickable
            />
          </Box>
        </Box>

        {/* 故事板帧数选择 */}
        <Box sx={{ mb: 3 }}>
          <FormLabel component="legend">故事板帧数</FormLabel>
          <Slider
            value={localParams.storyboard_count}
            onChange={handleStoryboardCountChange}
            min={1}
            max={6}
            step={1}
            marks={[
              { value: 1, label: '1' },
              { value: 3, label: '3' },
              { value: 6, label: '6' },
            ]}
            valueLabelDisplay="auto"
          />
        </Box>

        {/* 预估积分 */}
        <Alert severity="info" sx={{ mt: 2 }}>
          预估消耗积分：{estimatedCredits()} 积分
        </Alert>
      </Paper>

      <Box sx={{ textAlign: 'right' }}>
        <Button variant="contained" onClick={handleConfirm} disabled={!session}>
          确认并预扣积分
        </Button>
      </Box>
    </Box>
  );
}
