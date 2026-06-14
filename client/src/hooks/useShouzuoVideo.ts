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
    needsPreprocessing,
    preprocessedImageUrl,
    preprocessingStatus,
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
    setNeedsPreprocessing,
    setPreprocessedImageUrl,
    setPreprocessingStatus,
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

  /** 获取风格模板列表（页面加载时调用） */
  const fetchStyleTemplates = useCallback(async () => {
    try {
      const templates = await shouzuoApi.getStyleTemplates();
      useShouzuoVideoStore.getState().setStyleTemplates(templates);
    } catch {
      // 静默处理
    }
  }, []);

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
      // 直接从 store 获取最新 session（避免闭包陈旧值问题）
      const currentSession = useShouzuoVideoStore.getState().session;
      if (!currentSession) throw new Error('会话不存在');

      const result = await shouzuoApi.analyzeImages(currentSession.sessionId);
      setAiRecognition(result);

      // 设置是否需要预处理（平铺图 → 需要生成穿着效果图）
      setNeedsPreprocessing(result.needs_preprocessing === true);

      // 自动选中最高置信度的推荐风格模板
      if (result.recommendations && result.recommendations.length > 0) {
        const templates = useShouzuoVideoStore.getState().styleTemplates;
        const topRec = result.recommendations[0]; // 已按置信度降序
        const matchedTemplate = templates.find((t) => t.style_id === topRec.style_id);
        if (matchedTemplate) {
          setSelectedStyle(matchedTemplate);
        } else if (templates.length > 0) {
          // 没匹配到则选第一个模板
          setSelectedStyle(templates[0]);
        }
      }

      // 停在 ai_recognize 步骤，让用户查看/修改识别结果
      setStep('ai_recognize');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI识别失败';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }, [setError, setStep, setAiRecognition, setIsAnalyzing, setSelectedStyle, setNeedsPreprocessing]);

  /** Step 2.5: 服装预处理（平铺图 → 穿着效果图） */
  const preprocessImage = useCallback(async () => {
    try {
      setError(null);
      setPreprocessingStatus('generating');
      const currentSession = useShouzuoVideoStore.getState().session;
      if (!currentSession) throw new Error('会话不存在');

      const result = await shouzuoApi.preprocessImage(currentSession.sessionId);
      setPreprocessedImageUrl(result.preprocessedImageUrl);
      setPreprocessingStatus('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '预处理生成失败';
      setError(msg);
      setPreprocessingStatus('failed');
    }
  }, [setError, setPreprocessedImageUrl, setPreprocessingStatus]);

  /** 跳过预处理，直接用原图 */
  const skipPreprocessing = useCallback(() => {
    setPreprocessingStatus('idle');
    setPreprocessedImageUrl(null);
    setNeedsPreprocessing(false);
  }, [setPreprocessingStatus, setPreprocessedImageUrl, setNeedsPreprocessing]);

  /** 用户编辑服装信息 */
  const saveUserEditedClothing = useCallback(async (clothing: typeof userEditedClothing) => {
    try {
      setError(null);
      const currentSession = useShouzuoVideoStore.getState().session;
      if (!currentSession) throw new Error('会话不存在');

      await shouzuoApi.saveAiRecognition(currentSession.sessionId, clothing);
      setUserEditedClothing(clothing);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      setError(msg);
    }
  }, [setError, setUserEditedClothing]);

  // ============================================================
  // Step 3: 确认视频参数 + 预扣积分
  // ============================================================

  const confirmVideoParams = useCallback(async (params: VideoParams) => {
    try {
      setError(null);
      const currentSession = useShouzuoVideoStore.getState().session;
      if (!currentSession) throw new Error('会话不存在');

      const result = await shouzuoApi.confirmVideoParams(currentSession.sessionId, params);
      setVideoParams(params);
      setStep('storyboard');

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '确认参数失败';
      setError(msg);
      throw err;
    }
  }, [setError, setStep, setVideoParams]);

  // ============================================================
  // Step 4: 生成故事板
  // ============================================================

  const generateStoryboard = useCallback(async (storyboardCount: number, frameIndex?: number) => {
    try {
      setError(null);
      setStoryboardGenerating(true);
      const currentSession = useShouzuoVideoStore.getState().session;
      const currentUserEditedClothing = useShouzuoVideoStore.getState().userEditedClothing;
      if (!currentSession) throw new Error('会话不存在');

      if (frameIndex !== undefined) {
        // 单帧重新生成：只重新生成指定帧
        const result = await shouzuoApi.regenerateStoryboard({
          sessionId: currentSession.sessionId,
          storyboardCount,
          userEditedClothing: currentUserEditedClothing || undefined,
          frameIndex,
        });
        // 只更新指定帧
        const currentStoryboard = useShouzuoVideoStore.getState().storyboard;
        if (currentStoryboard && result.frames.length > 0) {
          const newFrames = [...currentStoryboard.frames];
          newFrames[frameIndex] = result.frames[0];
          setStoryboard({ ...currentStoryboard, frames: newFrames });
        }
        // 不跳转步骤，用户仍在故事板页面
      } else {
        // 全部重新生成 → 生成完成后留在 Step 4 让用户查看/编辑分镜
        const result = await shouzuoApi.generateStoryboard({
          sessionId: currentSession.sessionId,
          storyboardCount,
          userEditedClothing: currentUserEditedClothing || undefined,
        });

        setStoryboard(result);
        // 不再自动跳到 'video' 步骤，用户确认后再点"确认并生成视频"
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '故事板生成失败';
      setError(msg);
    } finally {
      setStoryboardGenerating(false);
    }
  }, [setError, setStep, setStoryboard, setStoryboardGenerating]);

  // ============================================================
  // Step 5: 生成视频
  // ============================================================

  const generateVideo = useCallback(async () => {
    try {
      setError(null);
      setVideoGenerating(true);
      setStep('video');  // ⬅ 切到 Step 5 显示加载状态
      const currentSession = useShouzuoVideoStore.getState().session;
      const currentStoryboard = useShouzuoVideoStore.getState().storyboard;
      const currentVideoModel = useShouzuoVideoStore.getState().videoModel;
      const currentVideoParams = useShouzuoVideoStore.getState().videoParams;
      if (!currentSession || !currentStoryboard) throw new Error('请先生成故事板');

      const result = await shouzuoApi.generateVideo({
        sessionId: currentSession.sessionId,
        model: currentVideoModel,
        resolution: currentVideoParams?.resolution || '720p',
        storyboardFrames: currentStoryboard.frames.map((f) => ({
          seq: f.seq,
          name: f.name,
          prompt: f.prompt,
          imageUrl: f.imageUrl || '',
        })),
      });

      setVideoResult(result);

      // 轮询视频生成状态（从 store 实时读取 session，避免闭包陈旧值）
      if (result.status === 'processing' || result.status === 'pending') {
        setVideoPolling(true);
        pollingRef.current = setInterval(async () => {
          try {
            const s = useShouzuoVideoStore.getState().session;
            if (!s) return;
            const updated = await shouzuoApi.getVideoStatus(s.sessionId);
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
  }, [setError, setStep, setVideoResult, setVideoGenerating, setVideoPolling, stopPolling]);

  // ============================================================
  // Step 6: 生成 AI 文案
  // ============================================================

  const generateCopywriting = useCallback(async () => {
    try {
      setError(null);
      setCopywritingGenerating(true);
      const currentSession = useShouzuoVideoStore.getState().session;
      const currentUserEditedClothing = useShouzuoVideoStore.getState().userEditedClothing;
      if (!currentSession) throw new Error('会话不存在');

      const result = await shouzuoApi.generateCopywriting({
        sessionId: currentSession.sessionId,
        userEditedClothing: currentUserEditedClothing || undefined,
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
  }, [setError, setCopywritingItems, setCopywritingGenerating]);

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
    needsPreprocessing,
    preprocessedImageUrl,
    preprocessingStatus,
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
    fetchStyleTemplates,
    preprocessImage,
    skipPreprocessing,
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
