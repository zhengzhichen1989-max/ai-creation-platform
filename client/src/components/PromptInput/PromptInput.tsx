import { TextField, Button, Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  disabled: boolean;
  isGenerating: boolean;
  costCredits: number;
  currentBalance: number;
  selectedModelName: string;
  selectedModelType?: 'image' | 'video' | 'text';
  durationOptions?: number[] | null;
  durationPricing?: Record<string, number> | null;
  selectedDuration?: number;
  onDurationChange?: (duration: number) => void;
}

const MAX_PROMPT_LENGTH = 2000;

export function PromptInput({
  value,
  onChange,
  onGenerate,
  disabled,
  isGenerating,
  costCredits,
  currentBalance,
  selectedModelName,
  selectedModelType,
  durationOptions,
  durationPricing,
  selectedDuration,
  onDurationChange,
}: PromptInputProps) {
  const insufficient = costCredits > 0 && currentBalance < costCredits;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        创作区
      </Typography>

      {selectedModelName && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          当前模型：<strong>{selectedModelName}</strong> · 消耗 {costCredits} 积分 · 余额 {currentBalance} 积分
        </Typography>
      )}

      <TextField
        multiline
        fullWidth
        minRows={4}
        maxRows={8}
        placeholder="描述你想要生成的内容..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{ maxLength: MAX_PROMPT_LENGTH }}
        sx={{ mb: 2 }}
      />

      {selectedModelType === 'video' && durationOptions && durationOptions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>视频时长</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={selectedDuration || durationOptions[0]}
            onChange={(_, val) => val && onDurationChange?.(val)}
          >
            {durationOptions.map((d) => (
              <ToggleButton key={d} value={d}>
                {d}秒 {durationPricing?.[d] ? `(${durationPricing[d]}积分)` : ''}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {value.length} / {MAX_PROMPT_LENGTH}
        </Typography>

        <Button
          variant="contained"
          size="large"
          startIcon={<AutoAwesomeIcon />}
          onClick={onGenerate}
          disabled={disabled || insufficient}
        >
          {isGenerating ? '生成中...' : '开始生成'}
        </Button>
      </Box>

      {insufficient && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          积分不足，当前余额 {currentBalance}，需要 {costCredits} 积分
        </Typography>
      )}
    </Box>
  );
}
