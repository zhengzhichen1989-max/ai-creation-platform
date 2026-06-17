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

export interface ToyTemplate {
  id: string;
  name: string;
  category: string;
  duration: number;
  shotCount: number;
}

export interface ToyLanguage {
  value: string;
  label: string;
}

export interface ToySize {
  value: string;
  width: number;
  height: number;
  label: string;
}
