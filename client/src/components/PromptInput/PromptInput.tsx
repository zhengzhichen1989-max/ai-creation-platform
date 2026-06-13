import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TextField, Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';

/** 图片尺寸预设 */
export const IMAGE_SIZE_PRESETS = [
  { label: '1:1 方形', width: 1024, height: 1024 },
  { label: '16:9 横屏', width: 1792, height: 1024 },
  { label: '9:16 竖屏', width: 1024, height: 1792 },
  { label: '4:3 横屏', width: 1365, height: 1024 },
  { label: '3:4 竖屏', width: 1024, height: 1365 },
  { label: '2:1 横屏', width: 1536, height: 768 },
  { label: '1:2 竖屏', width: 768, height: 1536 },
] as const;

export type ImageSizePreset = typeof IMAGE_SIZE_PRESETS[number];

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
  /** 图片模型选中的尺寸预设索引 */
  selectedImageSizeIndex?: number;
  onImageSizeChange?: (index: number) => void;
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
  selectedImageSizeIndex = 0,
  onImageSizeChange,
}: PromptInputProps) {
  const insufficient = costCredits > 0 && currentBalance < costCredits;
  const [mounted, setMounted] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // 创建 Portal 容器
  useEffect(() => {
    if (!portalRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;pointer-events:none;';
      document.body.appendChild(el);
      portalRef.current = el;
    }
    return () => {
      if (portalRef.current && portalRef.current.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
        portalRef.current = null;
      }
    };
  }, []);

  // 实时定位按钮到锚点位置
  const updatePosition = useCallback(() => {
    if (!portalRef.current || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const btnW = 160, btnH = 44;
    portalRef.current.style.left = `${rect.right - btnW}px`;
    portalRef.current.style.top = `${rect.top + (rect.height - btnH) / 2}px`;
    portalRef.current.style.width = `${btnW}px`;
    portalRef.current.style.height = `${btnH}px`;
  }, []);

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const timer = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(timer);
  }, [value, disabled, insufficient, isGenerating, updatePosition]);

  const isBtnDisabled = disabled || insufficient || isGenerating;

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
                      {r.replace('p', 'P')} {premium > 0 ? `(+${premium}积分)` : ''}
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>
      )}

      {selectedModelType === 'image' && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>图片尺寸</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={selectedImageSizeIndex}
            onChange={(_, val) => val !== null && onImageSizeChange?.(val)}
          >
            {IMAGE_SIZE_PRESETS.map((preset, idx) => (
              <ToggleButton key={idx} value={idx}>
                {preset.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      {insufficient && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          积分不足，当前余额 {currentBalance} 积分，需要 {costCredits} 积分
        </Typography>
      )}

      {/* 字符计数 + 按钮锚点占位 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {value.length} / {MAX_PROMPT_LENGTH}
        </Typography>
        {/* 锚点：不可见，仅用于定位 Portal 按钮 */}
        <div ref={anchorRef} style={{ width: 160, height: 44, visibility: 'hidden' }} />
      </Box>

      {/* 按钮通过 Portal 渲染到 body，完全脱离 MUI/Tailwind CSS 树 */}
      {mounted && portalRef.current && createPortal(
        <button
          type="button"
          disabled={isBtnDisabled}
          onClick={(e) => { e.preventDefault(); onGenerate(); }}
          style={{
            /* 重置浏览器/MUI/Tailwind 所有默认样式 */
            all: 'unset',
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            height: '100%',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.2,
            borderRadius: 12,
            border: 'none',
            cursor: isBtnDisabled ? 'not-allowed' : 'pointer',
            background: isBtnDisabled
              ? '#e8eaf6'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: isBtnDisabled ? '#9fa8da' : '#fff',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            boxShadow: isBtnDisabled
              ? 'none'
              : '0 4px 15px rgba(102,126,234,0.4), 0 2px 6px rgba(118,75,162,0.3)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '0.5px',
            margin: 0,
            padding: 0,
            boxSizing: 'border-box',
            WebkitAppearance: 'none',
            appearance: 'none',
            textShadow: isBtnDisabled ? 'none' : '0 1px 2px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={(e) => {
            if (!isBtnDisabled) {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translateY(-1px)';
              el.style.boxShadow = '0 6px 20px rgba(102,126,234,0.5), 0 3px 10px rgba(118,75,162,0.35)';
              el.style.background = 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isBtnDisabled) {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translateY(0)';
              el.style.boxShadow = '0 4px 15px rgba(102,126,234,0.4), 0 2px 6px rgba(118,75,162,0.3)';
              el.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }
          }}
        >
          {isGenerating ? (
            <>
              <svg style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg style={{ width: 20, height: 20, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
              </svg>
              开始生成
            </>
          )}
        </button>,
        portalRef.current
      )}

      {/* 注入 spin 动画 keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

    </Box>
  );
}
