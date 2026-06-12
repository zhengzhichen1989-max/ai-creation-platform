import { useCallback, useRef } from 'react';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import * as shouzuoApi from '@/api/shouzuoVideo';
import type { CopywritingItem, ProductInfo } from '@/types/shouzuo';

/**
 * 种草视频主流程 Hook
 * 编排 8 步工作流：上传 → 分析 → 选风格 → 故事板 → 确认 → 生成视频 → 文案 → 下载
 */
export function useShouzuoVideo() {
  const {
    session,
    uploadedFiles,
    uploadedUrls,
    recommendedStyles,
    analysisResult,
    selectedStyle,
    storyboard,
    videoResult,
    copywritingItems,
    currentStep,
    isStoryboardGenerating,
    isVideoGenerating,
    isVideoPolling,
    isCopywritingGenerating,
    videoModel,
    error,
    setStep,
    setSession,
    setUploadedUrls,
    setProductInfo,
    setRecommendedStyles,
    setAnalysisResult,
    setSelectedStyle,
    setStoryboard,
    setStoryboardGenerating,
    setVideoResult,
    setVideoGenerating,
    setVideoPolling,
    setCopywritingItems,
    toggleCopywritingSelect,
    setCopywritingGenerating,
    setVideoModel,
    setError,
    startStoryboardRegenerate,
    finishStoryboardRegenerate,
    regeneratingFrameIndex,
    setRegeneratingFrame,
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

  /** Step 1+2: 上传图片 → 分析 → 风格推荐 */
  const startAnalysis = useCallback(async (imageUrls: string[], productInfo?: ProductInfo) => {
    try {
      setError(null);
      setStep('analyze');
      setUploadedUrls(imageUrls);
      if (productInfo) {
        setProductInfo(productInfo);
      }

      const result = await shouzuoApi.startSession({ images: imageUrls, productInfo });
      setSession(result);

      // 获取分析结果 + 风格推荐（Qwen3-Max Vision）
      const analysis = await shouzuoApi.analyzeImages(result.sessionId);
      setRecommendedStyles(analysis.recommendedStyles);
      setAnalysisResult(analysis);

      setStep('select_style');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '图片分析失败，请重试';
      setError(msg);
      setStep('upload');
    }
  }, [setError, setStep, setUploadedUrls, setProductInfo, setSession, setRecommendedStyles]);

  /** Step 3: 选择风格模板 */
  const selectStyle = useCallback(async (styleId: string) => {
    try {
      setError(null);
      if (!session) throw new Error('会话不存在');

      const style = await shouzuoApi.selectStyle({ sessionId: session.sessionId, styleId });
      setSelectedStyle(style);
      setStep('storyboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '选择风格失败';
      setError(msg);
    }
  }, [session, setError, setSelectedStyle, setStep]);

  /** Step 4: 生成故事板 (GPT-Image-2, 4-8帧) */
  const generateStoryboard = useCallback(async (frameCount: number, productDescription?: string) => {
    try {
      setError(null);
      setStoryboardGenerating(true);
      if (!session || !selectedStyle) throw new Error('请先选择风格');

      const result = await shouzuoApi.generateStoryboard({
        sessionId: session.sessionId,
        styleId: selectedStyle.id,
        styleName: selectedStyle.name,
        frameCount,
        productDescription,
      });

      setStoryboard(result);
      setStep('confirm_board');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '故事板生成失败';
      setError(msg);
    } finally {
      setStoryboardGenerating(false);
    }
  }, [session, selectedStyle, setError, setStoryboardGenerating, setStoryboard, setStep]);

  /** Step 4 alt: 不满意，重新生成故事板 */
  const regenerateStoryboard = useCallback(async (frameCount: number, feedback?: string) => {
    try {
      setError(null);
      // 原子操作：单次 render 同时清空旧数据 + 设置 loading
      startStoryboardRegenerate();
      if (!session || !selectedStyle) throw new Error('请先选择风格');

      const result = await shouzuoApi.regenerateStoryboard({
        sessionId: session.sessionId,
        styleId: selectedStyle.id,
        styleName: selectedStyle.name,
        frameCount,
        feedback,
      });

      // 原子操作：单次 render 同时写入新数据 + 停止 loading
      finishStoryboardRegenerate(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重新生成故事板失败';
      setError(msg);
      setStoryboardGenerating(false);
    }
  }, [session, selectedStyle, setError, startStoryboardRegenerate, finishStoryboardRegenerate, setStoryboardGenerating]);

  /** Step 4 alt: 重新生成单个分镜帧 */
  const regenerateSingleFrame = useCallback(async (frameIndex: number, feedback?: string) => {
    try {
      setError(null);
      setRegeneratingFrame(frameIndex);
      if (!session || !selectedStyle) throw new Error('请先选择风格');

      const result = await shouzuoApi.regenerateSingleFrame({
        sessionId: session.sessionId,
        styleId: selectedStyle.id,
        styleName: selectedStyle.name,
        frameIndex,
        feedback,
      });

      // 原子更新 storyboard
      finishStoryboardRegenerate(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '重新生成分镜失败';
      setError(msg);
    } finally {
      setRegeneratingFrame(null);
    }
  }, [session, selectedStyle, setError, setRegeneratingFrame, finishStoryboardRegenerate]);

  /** Step 5→6: 确认故事板，开始生成视频 */
  const confirmStoryboardAndGenerateVideo = useCallback(async (duration?: number, resolution?: string, firstFrameIndex?: number, lastFrameIndex?: number, resolutionQuality?: string) => {
    try {
      setError(null);
      setStep('generate');
      setVideoGenerating(true);
      if (!session || !storyboard) throw new Error('请先生成故事板');

      const result = await shouzuoApi.generateShouzuoVideo({
        sessionId: session.sessionId,
        storyboardFrames: storyboard.frames,
        styleName: selectedStyle?.name ?? '',
        modelId: videoModel,
        duration,
        resolution,
        resolutionQuality,
        firstFrameIndex,
        lastFrameIndex,
      });

      setVideoResult(result);

      // 轮询视频生成状态
      if (result.status === 'pending' || result.status === 'processing') {
        setVideoPolling(true);
        pollingRef.current = setInterval(async () => {
          try {
            const updated = await shouzuoApi.getVideoTask(session.sessionId);
            setVideoResult(updated);

            if (updated.status === 'completed') {
              stopPolling();
              setStep('copywriting');
            } else if (updated.status === 'failed') {
              stopPolling();
              setError(updated.errorMessage ?? '视频生成失败');
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
  }, [session, storyboard, selectedStyle, setError, setStep, setVideoGenerating, setVideoResult, setVideoPolling, stopPolling]);

  /** Step 7: 生成AI文案 */
  const generateCopywriting = useCallback(async (productDescription?: string) => {
    try {
      setError(null);
      setCopywritingGenerating(true);
      if (!session || !videoResult?.videoUrl) throw new Error('请先生成视频');

      const items = await shouzuoApi.generateCopywriting({
        sessionId: session.sessionId,
        videoUrl: videoResult.videoUrl,
        styleName: selectedStyle?.name ?? '',
        productDescription,
      });

      setCopywritingItems(items);
      setStep('download');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '文案生成失败';
      setError(msg);
    } finally {
      setCopywritingGenerating(false);
    }
  }, [session, videoResult, selectedStyle, setError, setCopywritingGenerating, setCopywritingItems, setStep]);

  /** 获取选中文案的文本（用于下载） */
  const getSelectedCopywriting = useCallback((): CopywritingItem[] => {
    return copywritingItems.filter((item) => item.selected);
  }, [copywritingItems]);

  /** 选中视频URL */
  const getSelectedVideoUrl = useCallback((): string | null => {
    return videoResult?.videoUrl ?? null;
  }, [videoResult]);

  return {
    // State
    session,
    uploadedFiles,
    uploadedUrls,
    recommendedStyles,
    analysisResult,
    selectedStyle,
    storyboard,
    videoResult,
    copywritingItems,
    currentStep,
    isStoryboardGenerating,
    isVideoGenerating,
    isVideoPolling,
    isCopywritingGenerating,
    videoModel,
    regeneratingFrameIndex,
    error,

    // Actions
    startAnalysis,
    selectStyle,
    generateStoryboard,
    regenerateStoryboard,
    regenerateSingleFrame,
    confirmStoryboardAndGenerateVideo,
    generateCopywriting,
    toggleCopywritingSelect,
    setVideoModel,
    getSelectedCopywriting,
    getSelectedVideoUrl,
    stopPolling,
  };
}
