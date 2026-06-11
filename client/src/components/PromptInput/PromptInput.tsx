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
  resolutionOptions?: string[] | null;
  resolutionPricing?: Record<string, number | Record<string, number>> | null;
  selectedResolution?: string;
  onResolutionChange?: (resolution: string) => void;
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
  resolutionOptions,
  resolutionPricing,
  selectedResolution,
  onResolutionChange,
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

      {selectedModelType === 'video' && (
        <Box sx={{ mb: 2, display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {durationOptions && durationOptions.length > 0 && (
            <Box>
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
          {resolutionOptions && resolutionOptions.length > 0 && (
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5 }}>分辨率</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={selectedResolution || resolutionOptions[0]}
                onChange={(_, val) => val && onResolutionChange?.(val)}
              >
                {resolutionOptions.map((r) => {
                  const resPrice = resolutionPricing?.[r];
                  let premium = 0;
                  if (typeof resPrice === 'object' && resPrice !== null && selectedDuration) {
                    premium = (resPrice as Record<string, number>)[selectedDuration] ?? 0;
                  } else if (typeof resPrice === 'number') {
                    premium = resPrice;
                  }
                  return (
                    <ToggleButton key={r} value={r}>
                      {r === '1080p' ? '1080P' : '720P'} {premium > 0 ? `(+${premium}积分)` : ''}
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {value.length} / {MAX_PROMPT_LENGTH}
        </Typography>

        {/* 使用原生 button 替代 MUI Button，避免 MUI 内部 CSS/事件机制拦截 click */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled || insufficient}
          className="MuiButtonBase-root MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-sizeLarge MuiButton-containedSizeLarge MuiButton-colorPrimary MuiButton-root MuiButton-contained MuiButton-containedPrimary MuiButton-sizeLarge MuiButton-containedSizeLarge MuiButton-colorPrimary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 22px',
            fontSize: '0.9375rem',
            fontWeight: 700,
            lineHeight: 1.75,
            borderRadius: '8px',
            border: 'none',
            cursor: disabled || insufficient ? 'default' : 'pointer',
            backgroundColor: disabled || insufficient ? 'rgba(0, 0, 0, 0.12)' : '#1976d2',
            color: disabled || insufficient ? 'rgba(0, 0, 0, 0.26)' : '#fff',
            boxShadow: disabled || insufficient ? 'none' : '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)',
            transition: 'background-color 250ms, box-shadow 250ms, border-color 250ms',
            textTransform: 'uppercase',
            letterSpacing: '0.02857em',
            minWidth: 64,
            position: 'relative',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            if (!disabled && !insufficient) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1565c0';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !insufficient) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1976d2';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0px 3px 1px -2px rgba(0,0,0,0.2), 0px 2px 2px 0px rgba(0,0,0,0.14), 0px 1px 5px 0px rgba(0,0,0,0.12)';
            }
          }}
        >
          <AutoAwesomeIcon style={{ fontSize: '1.25rem' }} />
          {isGenerating ? '生成中...' : '开始生成'}
        </button>
      </Box>

      {insufficient && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          积分不足，当前余额 {currentBalance}，需要 {costCredits} 积分
        </Typography>
      )}
    </Box>
  );
}
