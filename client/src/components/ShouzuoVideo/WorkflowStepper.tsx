import { Box, Stepper, Step, StepLabel, StepIconProps } from '@mui/material';
import { SHOUZUO_STEPS, type ShouzuoStep } from '@/types/shouzuo';

interface WorkflowStepperProps {
  activeStep: ShouzuoStep;
}

export default function WorkflowStepper({ activeStep }: WorkflowStepperProps) {
  const activeIndex = SHOUZUO_STEPS.findIndex((s) => s.key === activeStep);

  return (
    <Box sx={{ mb: 4 }}>
      <Stepper
        activeStep={activeIndex}
        alternativeLabel
        sx={{
          '& .MuiStepLabel-label': { fontSize: '0.75rem', mt: 0.5 },
          '& .MuiStepLabel-label.Mui-active': { fontWeight: 600, color: 'primary.main' },
          '& .MuiStepLabel-label.Mui-completed': { color: 'success.main' },
        }}
      >
        {SHOUZUO_STEPS.map((step) => (
          <Step key={step.key} completed={SHOUZUO_STEPS.indexOf(step) < activeIndex}>
            <StepLabel>{step.label}</StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
