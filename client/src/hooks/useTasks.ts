import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tasksApi from '@/api/tasks';
import type { GenerationTask, TaskStatus as TaskStatusType } from '@/api/tasks';

/** Interval in ms for polling task status */
const POLL_INTERVAL_IMAGE = 2000;
const POLL_INTERVAL_VIDEO = 3000;
const POLL_INTERVAL_TEXT = 1500;

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useTask(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getTask(taskId!),
    enabled: !!taskId,
    refetchOnWindowFocus: false,
  });
}

export function useTaskList(params?: tasksApi.TaskListParams) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksApi.listTasks(params),
  });
}

export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: tasksApi.cancelTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * Hook that polls a task until it reaches a terminal state (completed/failed/cancelled).
 * Returns the current task data and a method to start polling.
 */
export function useTaskPolling() {
  const [task, setTask] = useState<GenerationTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(
    (taskId: string, type: 'image' | 'video' | 'text' = 'image') => {
      stopPolling();
      setIsPolling(true);

      const interval = type === 'video'
        ? POLL_INTERVAL_VIDEO
        : type === 'text'
          ? POLL_INTERVAL_TEXT
          : POLL_INTERVAL_IMAGE;

      const tick = async () => {
        try {
          const data = await tasksApi.getTask(taskId);
          setTask(data);

          const terminalStatuses: TaskStatusType[] = ['completed', 'failed', 'cancelled'];
          if (terminalStatuses.includes(data.status)) {
            stopPolling();
          }
        } catch {
          stopPolling();
        }
      };

      // Fetch immediately, then set interval
      tick();
      intervalRef.current = setInterval(tick, interval);
    },
    [stopPolling],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { task, isPolling, poll, stopPolling };
}
