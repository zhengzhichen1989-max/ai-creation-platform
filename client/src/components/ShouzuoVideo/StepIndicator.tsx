// ============================================================
// 种草视频 - 步骤条组件
// ============================================================

import { Stepper, Step, StepLabel, Box } from '@mui/material';
import type { ShouzuoStep } from '@/stores/shouzuoVideo.store';

const STEPS = [
  { label: '上传产品', description: '上传产品图+填写产品信息' },
  { label: 'AI分析', description: 'AI分析图片+推荐风格' },
  { label: '生成预览', description: '故事板/视频/文案生成' },
  { label: '完成下载', description: '查看和下载结果' },
];

interface StepIndicatorProps {
  currentStep: ShouzuoStep;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <Box sx={{ px: 2, py: 1 }}>
      <Stepper activeStep={currentStep - 1} alternativeLabel>
        {STEPS.map((step, index) => (
          <Step key={step.label}>
            <StepLabel
              optional={
                <span style={{ fontSize: 12, color: '#999' }}>
                  {index < currentStep - 1 ? '已完成' : step.description}
                </span>
              }
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
