import { Box, LinearProgress, Typography, Chip, Button } from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import { useCancelTask } from '@/hooks/useTasks';
import type { GenerationTask, TaskStatus as TaskStatusType } from '@/api/tasks';

interface TaskStatusProps {
  task: GenerationTask;
}

const STATUS_LABELS: Record<TaskStatusType, string> = {
  pending: '排队中',
  processing: '生成中',
  completed: '已完成',
  failed: '生成失败',
  cancelled: '已取消',
};

const STATUS_COLORS: Record<TaskStatusType, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  pending: 'warning',
  processing: 'primary',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

export function TaskStatus({ task }: TaskStatusProps) {
  const cancelTaskMutation = useCancelTask();

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(task.status);
  const progressValue = task.status === 'pending' ? 0 : task.progress;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="subtitle1">任务状态</Typography>
        <Chip
          label={STATUS_LABELS[task.status]}
          color={STATUS_COLORS[task.status]}
          size="small"
        />
      </Box>

      {!isTerminal && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant={task.status === 'processing' ? 'determinate' : 'indeterminate'}
            value={progressValue}
            sx={{ height: 8, borderRadius: 4 }}
          />
          {task.status === 'processing' && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              {progressValue}%
            </Typography>
          )}
        </Box>
      )}

      {task.status === 'failed' && task.errorMessage && (
        <Typography variant="body2" color="error" sx={{ mb: 1 }}>
          错误信息：{task.errorMessage}
        </Typography>
      )}

      {!isTerminal && (
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<CancelIcon />}
          onClick={() => cancelTaskMutation.mutate(task.id)}
          disabled={cancelTaskMutation.isPending}
        >
          取消任务
        </Button>
      )}
    </Box>
  );
}
