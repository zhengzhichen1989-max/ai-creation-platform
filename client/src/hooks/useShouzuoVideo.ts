import { useCallback, useRef } from 'react';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import * as shouzuoApi from '@/api/shouzuoVideo';
import type { CopywritingItem, ProductInfo, VideoParams, StoryboardFrame } from '@/types/shouzuo';

/**
 * 种草视频主流程 Hook（6步工作流）
 * Step 1: 上传产品图 → 创建会话
 * Step 2: AI 识别产品图 + 风格推荐
 * Step 3: 确认视频参数 + 预扣积分
 * Step 4: 生成故事板
 * Step 5: 生成视频
 * Step 6: AI 文案生成
 */
export function useShouzuoVideo() {
  const {
    session,
    uploadedFiles,
    uploadedUrls,
    productInfo,
    aiRecognition,
    isAnalyzing,
    userEditedClothing,
    selectedStyle,
    videoParams,
    storyboard,
    isStoryboardGenerating,
    videoResult,
    isVideoGenerating,
    isVideoPolling,
    copywritingItems,
    isCopywritingGenerating,
    videoModel,
    error,
    setStep,
    setSession,
    setUploadedFiles,
    setUploadedUrls,
    setProductInfo,
    setAiRecognition,
    setIsAnalyzing,
    setUserEditedClothing,
    setSelectedStyle,
    setVideoParams,
    setStoryboard,
    setStoryboardGenerating,
    setVideoResult,
    setVideoGenerating,
    setVideoPolling,
    setVideoModel,
    setCopywritingItems,
    setCopywritingGenerating,
    setError,
    reset,
  } = useShouzuoVideoStore();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 停止轮询 */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setVideoPolling(false);
  }, [setVideoPolling]);

  // ============================================================
  // Step 1: 上传产品图 → 创建会话
  // ============================================================

  const startSession = useCallback(async (files: File[], info?: ProductInfo) => {
    try {
      setError(null);
      setUploadedFiles(files);
      setProductInfo(info || null);

      // 上传图片到服务器
      const urls = await shouzuoApi.uploadImages(files);
      setUploadedUrls(urls);

      // 创建会话
      const result = await shouzuoApi.createSession({ images: urls, productInfo: info });
      setSession(result);
      setStep('ai_recognize');

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建会话失败';
      setError(msg);
      throw err;
    }
  }, [setError, setStep, setSession, setUploadedFiles, setUploadedUrls, setProductInfo]);

  // ============================================================
  // Step 2: AI 识别产品图 + 风格推荐
  // ============================================================

  const analyzeImages = useCallback(async () => {
    try {
      setError(null);
      setIsAnalyzing(true);
      if (!session) throw new Error('会话不存在');

      const result = await shouzuoApi.analyzeImages(session.sessionId);
      setAiRecognition(result);

      setStep('video_params');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI识别失败';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [session, setError, setStep, setAiRecognition, setIsAnalyzing]);

  /** 用户编辑服装信息 */
  const saveUserEditedClothing = useCallback(async (clothing: typeof userEditedClothing) => {
    try {
      setError(null);
      if (!session) throw new Error('会话不存在');

      await shouzuoApi.saveAiRecognition(session.sessionId, clothing);
      setUserEditedClothing(clothing);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      setError(msg);
    }
  }, [session, setError, setUserEditedClothing]);

  // ============================================================
  // Step 3: 确认视频参数 + 预扣积分
  // ============================================================

  const confirmVideoParams = useCallback(async (params: VideoParams) => {
    try {
      setError(null);
      if (!session) throw new Error('会话不存在');
      if (!selectedStyle) throw new Error('请先选择风格');

      const result = await shouzuoApi.confirmVideoParams(session.sessionId, params);
      setVideoParams(params);
      setStep('storyboard');

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '确认参数失败';
      setError(msg);
      throw err;
    }
  }, [session, selectedStyle, setError, setStep, setVideoParams]);

  // ============================================================
  // Step 4: 生成故事板
  // ============================================================

  const generateStoryboard = useCallback(async (storyboardCount: number) => {
    try {
      setError(null);
      setStoryboardGenerating(true);
      if (!session) throw new Error('会话不存在');

      const result = await shouzuoApi.generateStoryboard({
        sessionId: session.sessionId,
        storyboardCount,
        userEditedClothing: userEditedClothing || undefined,
      });

      setStoryboard(result);
      setStep('video');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '故事板生成失败';
      setError(msg);
    } finally {
      setStoryboardGenerating(false);
    }
  }, [session, userEditedClothing, setError, setStep, setStoryboard, setStoryboardGenerating]);

  // ============================================================
  // Step 5: 生成视频
  // ============================================================

  const generateVideo = useCallback(async () => {
    try {
      setError(null);
      setVideoGenerating(true);
      if (!session || !storyboard) throw new Error('请先生成故事板');

      const result = await shouzuoApi.generateVideo({
        sessionId: session.sessionId,
        model: videoModel,
        resolution: videoParams?.resolution || '720p',
        storyboardFrames: storyboard.frames.map((f) => ({
          seq: f.seq,
          name: f.name,
          prompt: f.prompt,
          imageUrl: f.imageUrl || '',
        })),
      });

      setVideoResult(result);

      // 轮询视频生成状态
      if (result.status === 'processing' || result.status === 'pending') {
        setVideoPolling(true);
        pollingRef.current = setInterval(async () => {
          try {
            const updated = await shouzuoApi.getVideoStatus(session.sessionId);
            setVideoResult(updated);

            if (updated.status === 'completed') {
              stopPolling();
              setStep('copywriting');
            } else if (updated.status === 'failed') {
              stopPolling();
              setError(updated.errorMessage || '视频生成失败');
            }
          } catch {
            // 轮询错误静默处理
          }
        }, 3000);
      } else if (result.status === 'completed') {
        setStep('copywriting');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '视频生成失败';
      setError(msg);
      setVideoGenerating(false);
    }
  }, [session, storyboard, videoModel, videoParams, setError, setStep, setVideoResult, setVideoGenerating, setVideoPolling, stopPolling]);

  // ============================================================
  // Step 6: 生成 AI 文案
  // ============================================================

  const generateCopywriting = useCallback(async () => {
    try {
      setError(null);
      setCopywritingGenerating(true);
      if (!session) throw new Error('会话不存在');

      const result = await shouzuoApi.generateCopywriting({
        sessionId: session.sessionId,
        userEditedClothing: userEditedClothing || undefined,
      });

      // 转换为 CopywritingItem 数组
      const items: CopywritingItem[] = [{
        index: 0,
        title: result.title,
        body: result.content,
        hashtags: result.tags,
        platform: 'xiaohongshu',
        selected: true,
      }];

      setCopywritingItems(items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '文案生成失败';
      setError(msg);
    } finally {
      setCopywritingGenerating(false);
    }
  }, [session, userEditedClothing, setError, setCopywritingItems, setCopywritingGenerating]);

  // ============================================================
  // 工具函数
  // ============================================================

  /** 获取选中文案的文本 */
  const getSelectedCopywriting = useCallback((): CopywritingItem[] => {
    return copywritingItems.filter((item) => item.selected);
  }, [copywritingItems]);

  /** 获取视频 URL */
  const getVideoUrl = useCallback((): string | null => {
    return videoResult?.videoUrl || null;
  }, [videoResult]);

  return {
    // State
    session,
    uploadedFiles,
    uploadedUrls,
    productInfo,
    aiRecognition,
    isAnalyzing,
    userEditedClothing,
    selectedStyle,
    videoParams,
    storyboard,
    isStoryboardGenerating,
    videoResult,
    isVideoGenerating,
    isVideoPolling,
    copywritingItems,
    isCopywritingGenerating,
    videoModel,
    error,

    // Actions
    startSession,
    analyzeImages,
    saveUserEditedClothing,
    confirmVideoParams,
    generateStoryboard,
    generateVideo,
    generateCopywriting,
    setVideoModel,
    getSelectedCopywriting,
    getVideoUrl,
    stopPolling,
    reset,
  };
}
