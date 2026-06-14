import { Stepper, Step, StepLabel, Box, Typography } from '@mui/material';
import type { Step as StepType } from '@/types/shouzuo';

interface WorkflowStepperProps {
  activeStep: string;
  steps: StepType[];
}

export default function WorkflowStepper({ activeStep, steps }: WorkflowStepperProps) {
  const activeIndex = steps.findIndex((s) => s.id === activeStep);

  return (
    <Box sx={{ mb: 3 }}>
      <Stepper activeStep={activeIndex} alternativeLabel>
        {steps.map((step) => (
          <Step key={step.id}>
            <StepLabel>
              <Typography variant="body2">{step.label}</Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
