// ============================================================
// 服饰短片 - 风格模板+模型选择组件
// ============================================================

import {
  Box,
  Card,
  CardContent,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Stack,
  Slider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Divider,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import type { StyleTemplateId, ShouzuoVideoModel, StyleTemplateInfo } from '@/api/shouzuoVideo';

/** 风格模板颜色映射 */
const STYLE_COLORS: Record<string, string> = {
  morihealing: '#8BC34A',
  japanfresh: '#80DEEA',
  retroart: '#D7CCC8',
  cinematic: '#5C6BC0',
  minimalist: '#BDBDBD',
};

/** 风格模板图标映射 */
const STYLE_ICONS: Record<string, string> = {
  morihealing: '🌿',
  japanfresh: '🎐',
  retroart: '🕯️',
  cinematic: '🎬',
  minimalist: '▪️',
};

interface StyleTemplateSelectorProps {
  styleTemplate: StyleTemplateId | null;
  videoModel: ShouzuoVideoModel;
  videoDuration: number;
  frameCount: number;
  styleTemplates: StyleTemplateInfo[];
  onStyleChange: (style: StyleTemplateId) => void;
  onVideoModelChange: (model: ShouzuoVideoModel) => void;
  onVideoDurationChange: (duration: number) => void;
  onFrameCountChange: (count: number) => void;
}

export default function StyleTemplateSelector({
  styleTemplate,
  videoModel,
  videoDuration,
  frameCount,
  styleTemplates,
  onStyleChange,
  onVideoModelChange,
  onVideoDurationChange,
  onFrameCountChange,
}: StyleTemplateSelectorProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        选择风格与模型
      </Typography>

      {/* 风格模板选择 */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        风格模板
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        {styleTemplates.map((template) => {
          const isSelected = styleTemplate === template.id;
          return (
            <Card
              key={template.id}
              onClick={() => onStyleChange(template.id)}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                border: isSelected ? '2px solid' : '2px solid transparent',
                borderColor: isSelected ? 'primary.main' : 'divider',
                bgcolor: isSelected ? 'primary.50' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.light',
                  transform: 'translateY(-2px)',
                  boxShadow: 2,
                },
                position: 'relative',
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <span style={{ fontSize: 24 }}>{STYLE_ICONS[template.id] || '🎨'}</span>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                    {template.name}
                  </Typography>
                  {isSelected && (
                    <CheckCircle color="primary" sx={{ fontSize: 20 }} />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: 12 }}>
                  {template.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={template.colorTone}
                    size="small"
                    sx={{
                      fontSize: 10,
                      height: 20,
                      bgcolor: STYLE_COLORS[template.id] + '33',
                      color: STYLE_COLORS[template.id],
                    }}
                  />
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* 视频模型选择 */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        视频模型
      </Typography>
      <FormControl>
        <RadioGroup
          row
          value={videoModel}
          onChange={(e) => onVideoModelChange(e.target.value as ShouzuoVideoModel)}
        >
          <FormControlLabel
            value="kling-v3"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>可灵 Kling 3.0</Typography>
                <Typography variant="caption" color="text.secondary">高品质视频，首帧+末帧控制</Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="seedance-2.0"
            control={<Radio />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Seedance 2.0 Fast</Typography>
                <Typography variant="caption" color="text.secondary">快速生成，多帧参考控制</Typography>
              </Box>
            }
          />
        </RadioGroup>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      {/* 视频时长 */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        视频时长: {videoDuration}秒
      </Typography>
      <Slider
        value={videoDuration}
        onChange={(_, val) => onVideoDurationChange(val as number)}
        min={4}
        max={15}
        step={1}
        marks={[
          { value: 5, label: '5s' },
          { value: 10, label: '10s' },
          { value: 15, label: '15s' },
        ]}
        valueLabelDisplay="auto"
        sx={{ maxWidth: 400, mb: 2 }}
      />

      <Divider sx={{ my: 3 }} />

      {/* 故事板帧数 */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        故事板帧数: {frameCount}帧
      </Typography>
      <ToggleButtonGroup
        value={frameCount}
        exclusive
        onChange={(_, val) => val && onFrameCountChange(val)}
        size="small"
        sx={{ mb: 2 }}
      >
        {[4, 5, 6].map((count) => (
          <ToggleButton key={count} value={count} sx={{ px: 3 }}>
            {count}帧
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
