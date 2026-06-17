// ============================================================
// 服饰短片 - 底部操作按钮组件
// ============================================================

import { Box, Button, Stack } from '@mui/material';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import Analytics from '@mui/icons-material/Analytics';
import type { ShouzuoStep } from '@/stores/shouzuoVideo.store';

interface BottomActionBarProps {
  currentStep: ShouzuoStep;
  canGoNext: boolean;
  isCreating: boolean;
  isAnalyzing: boolean;
  isGenerating: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGenerateAll: () => void;
}

export default function BottomActionBar({
  currentStep,
  canGoNext,
  isCreating,
  isAnalyzing,
  isGenerating,
  onPrev,
  onNext,
  onGenerateAll,
}: BottomActionBarProps) {
  const isProcessing = isCreating || isAnalyzing || isGenerating;

  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        px: 3,
        py: 2,
        zIndex: 10,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={onPrev}
          disabled={currentStep <= 1 || isProcessing}
        >
          上一步
        </Button>

        <Stack direction="row" spacing={2}>
          {/* Step 1: 上传产品 → 去AI分析 */}
          {currentStep === 1 && (
            <Button
              variant="contained"
              color="secondary"
              endIcon={<Analytics />}
              onClick={onNext}
              disabled={!canGoNext || isProcessing}
              size="large"
            >
              {isAnalyzing ? 'AI分析中...' : '下一步 → AI分析图片'}
            </Button>
          )}

          {/* Step 2: AI分析 → 一键生成 */}
          {currentStep === 2 && (
            <Button
              variant="contained"
              endIcon={<AutoAwesome />}
              onClick={onGenerateAll}
              disabled={isProcessing}
              size="large"
            >
              {isGenerating ? '生成中...' : '一键生成服饰短片'}
            </Button>
          )}

          {/* Step 3/4: 无特殊操作 */}
          {currentStep >= 3 && currentStep < 4 && (
            <Button
              variant="contained"
              endIcon={<ArrowForward />}
              onClick={onNext}
              disabled={isProcessing}
            >
              查看结果
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
