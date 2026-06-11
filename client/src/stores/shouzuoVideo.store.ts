import { create } from 'zustand';
import type {
  ShouzuoStep,
  ShouzuoSession,
  StyleTemplate,
  Storyboard,
  ShouzuoVideoResult,
  CopywritingItem,
  ProductInfo,
  ImageAnalysis,
  VideoModelId,
} from '@/types/shouzuo';

interface ShouzuoVideoState {
  // 当前会话
  session: ShouzuoSession | null;
  currentStep: ShouzuoStep;

  // 上传的图片（本地预览 + 服务器URL）
  uploadedFiles: File[];
  uploadedUrls: string[];

  // 产品信息（用于故事板生成和视频生成）
  productInfo: ProductInfo | null;

  // 分析结果
  recommendedStyles: StyleTemplate[];
  analysisResult: ImageAnalysis | null;  // AI 图片分析完整结果

  // 选中的风格
  selectedStyle: StyleTemplate | null;

  // 故事板
  storyboard: Storyboard | null;
  isStoryboardGenerating: boolean;
  regeneratingFrameIndex: number | null;  // 正在重新生成的单帧索引（null=无）

  // 视频
  videoResult: ShouzuoVideoResult | null;
  isVideoGenerating: boolean;
  isVideoPolling: boolean;
  videoModel: VideoModelId;   // 视频生成模型选择

  // 文案
  copywritingItems: CopywritingItem[];
  isCopywritingGenerating: boolean;

  // 错误
  error: string | null;

  // Actions
  setStep: (step: ShouzuoStep) => void;
  setSession: (session: ShouzuoSession | null) => void;
  setUploadedFiles: (files: File[]) => void;
  setUploadedUrls: (urls: string[]) => void;
  setProductInfo: (info: ProductInfo | null) => void;
  setRecommendedStyles: (styles: StyleTemplate[]) => void;
  setAnalysisResult: (result: ImageAnalysis | null) => void;
  setSelectedStyle: (style: StyleTemplate | null) => void;
  setStoryboard: (storyboard: Storyboard | null) => void;
  setStoryboardGenerating: (v: boolean) => void;
  setVideoResult: (result: ShouzuoVideoResult | null) => void;
  setVideoGenerating: (v: boolean) => void;
  setVideoPolling: (v: boolean) => void;
  setCopywritingItems: (items: CopywritingItem[]) => void;
  toggleCopywritingSelect: (index: number) => void;
  setCopywritingGenerating: (v: boolean) => void;
  setVideoModel: (model: VideoModelId) => void;
  setError: (error: string | null) => void;
  /** 原子操作 */
  startStoryboardRegenerate: () => void;
  finishStoryboardRegenerate: (storyboard: Storyboard) => void;
  setRegeneratingFrame: (index: number | null) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  currentStep: 'upload' as ShouzuoStep,
  uploadedFiles: [],
  uploadedUrls: [],
  productInfo: null,
  recommendedStyles: [],
  analysisResult: null,
  selectedStyle: null,
  storyboard: null,
  isStoryboardGenerating: false,
  regeneratingFrameIndex: null,
  videoResult: null,
  isVideoGenerating: false,
  isVideoPolling: false,
  videoModel: 'kling-v3' as VideoModelId,
  copywritingItems: [],
  isCopywritingGenerating: false,
  error: null,
};

export const useShouzuoVideoStore = create<ShouzuoVideoState>((set) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step, error: null }),
  setSession: (session) => set({ session, error: null }),
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setUploadedUrls: (urls) => set({ uploadedUrls: urls }),
  setProductInfo: (info) => set({ productInfo: info }),
  setRecommendedStyles: (styles) => set({ recommendedStyles: styles }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),
  setStoryboard: (storyboard) => set({ storyboard }),
  setStoryboardGenerating: (v) => set({ isStoryboardGenerating: v }),
  /** 原子操作：开始 loading（保留旧 storyboard 避免组件卸载/挂载） */
  startStoryboardRegenerate: () => set({ isStoryboardGenerating: true }),
  /** 原子操作：写入新 storyboard + 停止 loading，单次渲染避免 React #300 */
  finishStoryboardRegenerate: (storyboard: Storyboard) => set({ storyboard, isStoryboardGenerating: false }),
  setRegeneratingFrame: (index) => set({ regeneratingFrameIndex: index }),
  setVideoResult: (result) => set({ videoResult: result }),
  setVideoGenerating: (v) => set({ isVideoGenerating: v }),
  setVideoPolling: (v) => set({ isVideoPolling: v }),
  setCopywritingItems: (items) => set({ copywritingItems: items }),
  toggleCopywritingSelect: (index) =>
    set((state) => ({
      copywritingItems: state.copywritingItems.map((item) =>
        item.index === index ? { ...item, selected: !item.selected } : item
      ),
    })),
  setCopywritingGenerating: (v) => set({ isCopywritingGenerating: v }),
  setVideoModel: (model) => set({ videoModel: model }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));
