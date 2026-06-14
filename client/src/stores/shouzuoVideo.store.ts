import { create } from 'zustand';
import type {
  ShouzuoStep,
  ShouzuoSession,
  StyleTemplate,
  StyleRecommendation,
  ClothingInfo,
  AiRecognitionResult,
  VideoParams,
  VideoModelId,
  Storyboard,
  StoryboardFrame,
  ShouzuoVideoResult,
  CopywritingItem,
  CopywritingResult,
} from '@/types/shouzuo';

// ============================================================
// 状态接口
// ============================================================

interface ShouzuoVideoState {
  // 当前会话
  session: ShouzuoSession | null;
  currentStep: ShouzuoStep;

  // Step 1: 上传的图片
  uploadedFiles: File[];
  uploadedUrls: string[];

  // 产品信息
  productInfo: { name?: string; description?: string; sellingPoints?: string[] } | null;

  // Step 2: AI 识别结果
  aiRecognition: AiRecognitionResult | null;
  isAnalyzing: boolean;
  needsPreprocessing: boolean;
  preprocessedImageUrl: string | null;
  preprocessingStatus: 'idle' | 'generating' | 'completed' | 'failed';

  // Step 2: 风格模板列表（页面加载时获取）
  styleTemplates: StyleTemplate[];

  // Step 2: 用户编辑的服装信息
  userEditedClothing: ClothingInfo | null;

  // Step 3: 视频参数
  videoParams: VideoParams | null;
  selectedStyle: StyleTemplate | null;

  // Step 4: 故事板
  storyboard: Storyboard | null;
  isStoryboardGenerating: boolean;

  // Step 5: 视频
  videoResult: ShouzuoVideoResult | null;
  isVideoGenerating: boolean;
  isVideoPolling: boolean;
  videoModel: VideoModelId;

  // Step 6: 文案
  copywritingItems: CopywritingItem[];
  isCopywritingGenerating: boolean;

  // 错误
  error: string | null;

  // Actions
  setStep: (step: ShouzuoStep) => void;
  setSession: (session: ShouzuoSession | null) => void;
  setUploadedFiles: (files: File[]) => void;
  setUploadedUrls: (urls: string[]) => void;
  setProductInfo: (info: { name?: string; description?: string; sellingPoints?: string[] } | null) => void;

  // Step 2
  setAiRecognition: (result: AiRecognitionResult | null) => void;
  setIsAnalyzing: (v: boolean) => void;
  setNeedsPreprocessing: (v: boolean) => void;
  setPreprocessedImageUrl: (url: string | null) => void;
  setPreprocessingStatus: (v: 'idle' | 'generating' | 'completed' | 'failed') => void;
  setStyleTemplates: (templates: StyleTemplate[]) => void;
  setUserEditedClothing: (info: ClothingInfo | null) => void;

  // Step 3
  setVideoParams: (params: VideoParams | null) => void;
  setSelectedStyle: (style: StyleTemplate | null) => void;

  // Step 4
  setStoryboard: (storyboard: Storyboard | null) => void;
  setStoryboardGenerating: (v: boolean) => void;

  // Step 5
  setVideoResult: (result: ShouzuoVideoResult | null) => void;
  setVideoGenerating: (v: boolean) => void;
  setVideoPolling: (v: boolean) => void;
  setVideoModel: (model: VideoModelId) => void;

  // Step 6
  setCopywritingItems: (items: CopywritingItem[]) => void;
  setCopywritingGenerating: (v: boolean) => void;

  // 通用
  setError: (error: string | null) => void;
  reset: () => void;
}

// ============================================================
// 初始状态
// ============================================================

const initialState = {
  session: null,
  currentStep: 'upload' as ShouzuoStep,
  uploadedFiles: [],
  uploadedUrls: [],
  productInfo: null,

  // Step 2
  aiRecognition: null,
  isAnalyzing: false,
  needsPreprocessing: false,
  preprocessedImageUrl: null,
  preprocessingStatus: 'idle',
  styleTemplates: [],
  userEditedClothing: null,

  // Step 3
  videoParams: null,
  selectedStyle: null,

  // Step 4
  storyboard: null,
  isStoryboardGenerating: false,

  // Step 5
  videoResult: null,
  isVideoGenerating: false,
  isVideoPolling: false,
  videoModel: 'seedance-2.0' as VideoModelId,

  // Step 6
  copywritingItems: [],
  isCopywritingGenerating: false,

  error: null,
};

// ============================================================
// Store 创建
// ============================================================

export const useShouzuoVideoStore = create<ShouzuoVideoState>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ currentStep: step }),
  setSession: (session) => set({ session }),
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setUploadedUrls: (urls) => set({ uploadedUrls: urls }),
  setProductInfo: (info) => set({ productInfo: info }),

  // Step 2
  setAiRecognition: (result) => set({ aiRecognition: result }),
  setIsAnalyzing: (v) => set({ isAnalyzing: v }),
  setNeedsPreprocessing: (v) => set({ needsPreprocessing: v }),
  setPreprocessedImageUrl: (url) => set({ preprocessedImageUrl: url }),
  setPreprocessingStatus: (v) => set({ preprocessingStatus: v }),
  setStyleTemplates: (templates) => set({ styleTemplates: templates }),
  setUserEditedClothing: (info) => set({ userEditedClothing: info }),

  // Step 3
  setVideoParams: (params) => set({ videoParams: params }),
  setSelectedStyle: (style) => set({ selectedStyle: style }),

  // Step 4
  setStoryboard: (storyboard) => set({ storyboard }),
  setStoryboardGenerating: (v) => set({ isStoryboardGenerating: v }),

  // Step 5
  setVideoResult: (result) => set({ videoResult: result }),
  setVideoGenerating: (v) => set({ isVideoGenerating: v }),
  setVideoPolling: (v) => set({ isVideoPolling: v }),
  setVideoModel: (model) => set({ videoModel: model }),

  // Step 6
  setCopywritingItems: (items) => set({ copywritingItems: items }),
  setCopywritingGenerating: (v) => set({ isCopywritingGenerating: v }),

  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

export default useShouzuoVideoStore;
