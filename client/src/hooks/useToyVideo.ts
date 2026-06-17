import { useCallback } from 'react';
import { useToyVideoStore } from '@/stores/toyVideo.store';
import * as toyApi from '@/api/toy-video';
import type { ToyAnalysisResult, ToyStoryboardShot } from '@/types/toy-video';

/** 玩具视频生成器业务逻辑 Hook */
export function useToyVideo() {
  // 从 store 读取状态
  const {
    analysisResult,
    setAnalysisResult,
    storyboard,
    setStoryboard,
    taskId,
    setTaskId,
    taskStatus,
    setTaskStatus,
    taskResult,
    setTaskResult,
    setCurrentStep,
  } = useToyVideoStore();

  /** 是否正在分析 */
  const isAnalyzing = false; // 实际实现需要跟踪加载状态

  /** 是否正在生成故事板 */
  const isGeneratingStoryboard = false;

  /** 是否正在创建任务 */
  const isCreatingTask = false;

  /** 错误信息 */
  const error = null;

  /** AI 识别产品图片 */
  const analyzeImage = useCallback(async (imageUrl: string): Promise<ToyAnalysisResult> => {
    try {
      const res = await toyApi.analyzeToyImage(imageUrl);
      if (res.code === 200 && res.data) {
        setAnalysisResult(res.data);
        return res.data;
      }
      throw new Error(res.message || '识别失败');
    } catch (err: any) {
      throw new Error(err.message || '识别失败');
    }
  }, [setAnalysisResult]);

  /** 生成故事板 */
  const generateStoryboard = useCallback(async (params: {
    templateId: string;
    productInfo: any;
    language: string;
  }): Promise<{ shots: ToyStoryboardShot[] }> => {
    try {
      const res = await toyApi.generateToyStoryboard(params);
      if (res.code === 200 && res.data) {
        setStoryboard(res.data.shots || []);
        return res.data;
      }
      throw new Error(res.message || '生成失败');
    } catch (err: any) {
      throw new Error(err.message || '生成失败');
    }
  }, [setStoryboard]);

  /** 创建视频生成任务 */
  const createVideoTask = useCallback(async (params: {
    templateId: string;
    language: string;
    size: string;
    productInfo: any;
    storyboard: any;
  }): Promise<{ taskId: string; estimatedCredits: number }> => {
    try {
      const res = await toyApi.createToyVideoTask(params);
      if (res.code === 200 && res.data) {
        setTaskId(res.data.taskId);
        setTaskStatus('processing');
        return res.data;
      }
      throw new Error(res.message || '创建任务失败');
    } catch (err: any) {
      throw new Error(err.message || '创建任务失败');
    }
  }, [setTaskId, setTaskStatus]);

  /** 获取任务状态 */
  const getTaskStatus = useCallback(async (taskId: string): Promise<any> => {
    try {
      const res = await toyApi.getToyTask(taskId);
      if (res.code === 200 && res.data) {
        setTaskStatus(res.data.status || 'processing');
        if (res.data.result) {
          setTaskResult(res.data.result);
        }
        return res.data;
      }
      throw new Error(res.message || '获取状态失败');
    } catch (err: any) {
      throw new Error(err.message || '获取状态失败');
    }
  }, [setTaskStatus, setTaskResult]);

  return {
    isAnalyzing,
    isGeneratingStoryboard,
    isCreatingTask,
    error,
    analysisResult,
    storyboard,
    taskId,
    taskStatus,
    taskResult,
    analyzeImage,
    generateStoryboard,
    createVideoTask,
    getTaskStatus,
  };
}
