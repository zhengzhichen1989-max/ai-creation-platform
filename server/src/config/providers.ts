// ============================================================
// AI创作聚合平台 - 多平台路由配置
// ============================================================

/** 模型对应的 provider 和调用方式 */
export interface ModelProviderConfig {
  provider: 'dmxapi' | 'grsai';
  endpoint: string;
  method: string;
}

/** 每个模型对应的 provider 和调用端点 */
export const MODEL_PROVIDER_MAP: Record<string, ModelProviderConfig> = {
  // GrsAI 图片模型
  'gpt-image-2-vip': { provider: 'grsai', endpoint: '/v1/draw/completions', method: 'POST' },
  'gpt-image-2': { provider: 'grsai', endpoint: '/v1/draw/completions', method: 'POST' },
  'nano-banana-pro': { provider: 'grsai', endpoint: '/v1/draw/nano-banana', method: 'POST' },
  'nano-banana-fast': { provider: 'grsai', endpoint: '/v1/draw/nano-banana', method: 'POST' },
  'flux-pro': { provider: 'grsai', endpoint: '/v1/draw/completions', method: 'POST' },
  // DMXAPI 视频模型 (baseUrl 已含 /v1，seedance/kling 使用 /responses 端点，sora 使用 /videos)
  'doubao-seedance-2-0-260128': { provider: 'dmxapi', endpoint: '/responses', method: 'POST' },
  'doubao-seedance-2-0-fast-260128': { provider: 'dmxapi', endpoint: '/responses', method: 'POST' },
  'sora-2': { provider: 'dmxapi', endpoint: '/videos', method: 'POST' },
  'kling-v3-video-generation': { provider: 'dmxapi', endpoint: '/responses', method: 'POST' },
  // DMXAPI 文案模型
  'deepseek-chat': { provider: 'dmxapi', endpoint: '/chat/completions', method: 'POST' },
  'qwen-max': { provider: 'dmxapi', endpoint: '/chat/completions', method: 'POST' },
};

/** 获取模型的 provider 配置 */
export function getModelProviderConfig(modelId: string): ModelProviderConfig | undefined {
  return MODEL_PROVIDER_MAP[modelId];
}
