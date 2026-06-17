import { create } from 'zustand';

export type ToyVideoStep =
  | 'upload'
  | 'ai_analyze'
  | 'product_info'
  | 'image_enhance'
  | 'template_select'
  | 'params_select'
  | 'storyboard'
  | 'preview'
  | 'generate';

export interface ToyAnalysisResult {
  category: string;
  material: string;
  gameplay: string;
  ageRange: string;
  visualStyle: string;
  keywords: string[];
}

export interface ToyProductInfo {
  name?: string;
  description?: string;
  sellingPoints?: string[];
  ageRange?: string;
  material?: string;
  gameplay?: string;
}

export interface ToyStoryboardShot {
  seq: number;
  seconds: number;
  imagePrompt: string;
  voiceover: string;
  subtitles: string;
}

interface ToyVideoState {
  // 当前步骤
  currentStep: ToyVideoStep;
  setCurrentStep: (step: ToyVideoState['currentStep']) => void;

  // Step 1: 上传的图片
  uploadedImages: string[];
  setUploadedImages: (urls: string[]) => void;

  // Step 2: AI 识别结果
  analysisResult: ToyAnalysisResult | null;
  setAnalysisResult: (result: ToyAnalysisResult | null) => void;

  // Step 3: 产品信息
  productInfo: ToyProductInfo;
  setProductInfo: (info: ToyProductInfo) => void;

  // Step 4: 修图决策
  imageEnhance: 'original' | 'enhanced' | null;
  setImageEnhance: (v: 'original' | 'enhanced' | null) => void;

  // Step 5: 选择的模板
  selectedTemplate: string | null;
  setSelectedTemplate: (id: string | null) => void;

  // Step 6: 参数选择
  selectedLanguage: string | null;
  setSelectedLanguage: (lang: string | null) => void;
  selectedSize: string | null;
  setSelectedSize: (size: string | null) => void;

  // Step 7: 故事板
  storyboard: ToyStoryboardShot[] | null;
  setStoryboard: (shots: ToyStoryboardShot[] | null) => void;

  // Step 9: 任务状态
  taskId: string | null;
  setTaskId: (id: string | null) => void;
  taskStatus: 'idle' | 'processing' | 'completed' | 'failed';
  setTaskStatus: (status: 'idle' | 'processing' | 'completed' | 'failed') => void;
  taskResult: any | null;
  setTaskResult: (result: any | null) => void;

  // 重置
  reset: () => void;
}

const initialState = {
  currentStep: 'upload' as ToyVideoState['currentStep'],
  uploadedImages: [],
  analysisResult: null,
  productInfo: {},
  imageEnhance: null,
  selectedTemplate: null,
  selectedLanguage: null,
  selectedSize: null,
  storyboard: null,
  taskId: null,
  taskStatus: 'idle' as const,
  taskResult: null,
};

export const useToyVideoStore = create<ToyVideoState>((set) => ({
  ...initialState,

  setCurrentStep: (step) => set({ currentStep: step }),
  setUploadedImages: (urls) => set({ uploadedImages: urls }),
  setAnalysisResult: (result) => set({ analysisResult: result }),
  setProductInfo: (info) => set({ productInfo: info }),
  setImageEnhance: (v) => set({ imageEnhance: v }),
  setSelectedTemplate: (id) => set({ selectedTemplate: id }),
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  setSelectedSize: (size) => set({ selectedSize: size }),
  setStoryboard: (shots) => set({ storyboard: shots }),
  setTaskId: (id) => set({ taskId: id }),
  setTaskStatus: (status) => set({ taskStatus: status }),
  setTaskResult: (result) => set({ taskResult: result }),

  reset: () => set(initialState),
}));
