import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Card,
  CardContent,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useShouzuoVideo } from '@/hooks/useShouzuoVideo';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import ProductUpload from '@/components/ShouzuoVideo/ProductUpload';
import PreprocessingPreview from '@/components/ShouzuoVideo/PreprocessingPreview';
import VideoParamsForm from '@/components/ShouzuoVideo/VideoParamsForm';
import StoryboardView from '@/components/ShouzuoVideo/StoryboardView';
import VideoResultView from '@/components/ShouzuoVideo/VideoResultView';
import CopywritingResultView from '@/components/ShouzuoVideo/CopywritingResultView';
import { Stepper, Step, StepLabel } from '@mui/material';
import type { VideoParams } from '@/types/shouzuo';

// 6步工作流步骤定义
const STEPS = [
  { id: 'upload', label: '上传产品图' },
  { id: 'ai_recognize', label: 'AI识别+风格推荐' },
  { id: 'video_params', label: '确认视频参数' },
  { id: 'storyboard', label: '生成故事板' },
  { id: 'video', label: '生成视频' },
  { id: 'copywriting', label: 'AI文案+导出' },
];

export default function ShouzuoVideoPage() {
  const navigate = useNavigate();
  const [localError, setLocalError] = useState<string | null>(null);

  // 从 store 读取步骤状态
  const { currentStep, uploadedFiles, uploadedUrls, setUploadedFiles, aiRecognition, styleTemplates, selectedStyle, setSelectedStyle } = useShouzuoVideoStore();

  const {
    isAnalyzing,
    needsPreprocessing,
    preprocessedImageUrl,
    preprocessingStatus,
    isStoryboardGenerating,
    isVideoGenerating,
    isVideoPolling,
    isCopywritingGenerating,
    storyboard,
    videoResult,
    copywritingItems,
    error: hookError,
    startSession,
    analyzeImages,
    fetchStyleTemplates,
    preprocessImage,
    skipPreprocessing,
    confirmVideoParams,
    generateStoryboard,
    generateVideo,
    generateCopywriting,
    getSelectedCopywriting,
    getVideoUrl,
    stopPolling,
    reset,
  } = useShouzuoVideo();

  // 页面加载时获取风格模板
  useEffect(() => {
    fetchStyleTemplates();
  }, [fetchStyleTemplates]);

  // 错误处理
  useEffect(() => {
    if (hookError) {
      setLocalError(hookError);
    }
  }, [hookError]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
      reset();
    };
  }, []); // eslint-disable-line

  const handleBack = useCallback(() => {
    navigate('/workspace');
  }, [navigate]);

  // Step1: 开始分析（先上传图片创建会话，再 AI 识别）
  const handleStartAnalysis = useCallback(async (files: File[]) => {
    try {
      setLocalError(null);
      await startSession(files);
      await analyzeImages();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '操作失败';
      setLocalError(msg);
    }
  }, [startSession, analyzeImages]);

  // 下载视频
  const handleDownloadVideo = useCallback(async () => {
    const videoUrl = getVideoUrl();
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shouzuo_video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      const a = document.createElement('a');
      a.href = videoUrl!;
      a.download = 'shouzuo_video.mp4';
      a.target = '_blank';
      a.click();
    }
  }, [getVideoUrl]);

  // 下载文案
  const handleDownloadCopywriting = useCallback(() => {
    const selected = getSelectedCopywriting();
    if (selected.length === 0) return;
    const text = selected
      .map((item) => `${item.title}\n\n${item.body}\n\n${item.hashtags.map((t) => `#${t}`).join(' ')}`)
      .join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shouzuo_copywriting.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [getSelectedCopywriting]);

  const handleDownloadAll = useCallback(() => {
    handleDownloadVideo();
    handleDownloadCopywriting();
  }, [handleDownloadVideo, handleDownloadCopywriting]);

  // 获取当前步骤索引
  const activeIndex = STEPS.findIndex((s) => s.id === currentStep);

  // 渲染当前步骤内容
  const renderStepContent = () => {
    // AI 识别中
    if (isAnalyzing) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            AI 正在识别产品图片...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            识别服装类型、材质、风格特征，大约需要 10-20 秒
          </Typography>
        </Box>
      );
    }

    switch (currentStep) {
      case 'upload':
        return (
          <ProductUpload
            files={uploadedFiles}
            onFilesChange={setUploadedFiles}
            onStartAnalysis={async () => {
              if (uploadedFiles.length === 0) return;
              await handleStartAnalysis(uploadedFiles);
            }}
            disabled={isAnalyzing}
          />
        );

      case 'ai_recognize':
        return (
          <Box sx={{ py: 2 }}>
            {/* AI 识别完成提示 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
              <Typography variant="h6">AI 识别完成</Typography>
            </Box>

            {/* 识别结果展示 */}
            {aiRecognition && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  🏷️ 产品识别信息
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">服装类型</Typography>
                    <Typography variant="body1" fontWeight="medium">{aiRecognition.clothing_type || '未识别'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">材质</Typography>
                    <Typography variant="body1" fontWeight="medium">{aiRecognition.material || '未识别'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">主色调</Typography>
                    <Typography variant="body1" fontWeight="medium">{aiRecognition.main_color || '未识别'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">适用季节</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {(aiRecognition.season || []).map((s) => (
                        <Chip key={s} label={s} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">风格标签</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {(aiRecognition.style_tags || []).map((tag) => (
                      <Chip key={tag} label={tag} size="small" color="primary" variant="filled" />
                    ))}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* AI 推荐风格模板 */}
            {aiRecognition?.recommendations && aiRecognition.recommendations.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  ✨ AI 推荐视频风格（点击选择）
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                  {aiRecognition.recommendations.map((rec) => {
                    const template = styleTemplates.find((t) => t.style_id === rec.style_id);
                    if (!template) return null;
                    const isSelected = selectedStyle?.style_id === rec.style_id;
                    return (
                      <Card
                        key={rec.style_id}
                        onClick={() => setSelectedStyle(template)}
                        sx={{
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #7c3aed' : '2px solid transparent',
                          borderRadius: 2,
                          transition: 'all 0.2s',
                          '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                          opacity: isSelected ? 1 : 0.85,
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" fontWeight="bold">
                              {template.emoji} {template.name}
                            </Typography>
                            {isSelected && <CheckCircleIcon sx={{ color: '#7c3aed' }} />}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {template.tagline}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1, fontSize: '0.8rem' }}>
                            {template.description}
                          </Typography>
                          <Chip
                            label={`推荐度 ${Math.round(rec.confidence * 100)}%`}
                            size="small"
                            color={rec.confidence > 0.8 ? 'success' : rec.confidence > 0.5 ? 'warning' : 'default'}
                            sx={{ mt: 1 }}
                          />
                          {rec.reason && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                              💡 {rec.reason}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* 其他可选风格 */}
            {styleTemplates.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  其他可选风格
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {styleTemplates
                    .filter((t) => !aiRecognition?.recommendations?.some((r) => r.style_id === t.style_id))
                    .map((t) => {
                      const isSelected = selectedStyle?.style_id === t.style_id;
                      return (
                        <Chip
                          key={t.style_id}
                          label={`${t.emoji} ${t.name}`}
                          onClick={() => setSelectedStyle(t)}
                          color={isSelected ? 'primary' : 'default'}
                          variant={isSelected ? 'filled' : 'outlined'}
                          clickable
                          sx={{ fontWeight: isSelected ? 'bold' : 'normal' }}
                        />
                      );
                    })}
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Step 2.5: 服装预处理（平铺图时显示） */}
            {needsPreprocessing && (
              <Box sx={{ my: 3 }}>
                <PreprocessingPreview
                  originalImageUrl={uploadedUrls[0] || ''}
                  preprocessedImageUrl={preprocessedImageUrl}
                  preprocessingStatus={preprocessingStatus}
                  onPreprocess={preprocessImage}
                  onSkip={skipPreprocessing}
                  onConfirm={() => useShouzuoVideoStore.getState().setStep('video_params')}
                  error={hookError}
                />
              </Box>
            )}

            {/* 下一步按钮（非平铺图时直接显示，平铺图时需先完成预处理或跳过） */}
            {!needsPreprocessing && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <button
                  type="button"
                  onClick={() => useShouzuoVideoStore.getState().setStep('video_params')}
                  disabled={!selectedStyle}
                  style={{
                    background: !selectedStyle ? '#ccc' : '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 20,
                    padding: '12px 32px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: !selectedStyle ? 'not-allowed' : 'pointer',
                    opacity: !selectedStyle ? 0.6 : 1,
                    position: 'relative',
                    zIndex: 10,
                  }}
                >
                  {selectedStyle
                    ? `下一步：确认视频参数（已选「${selectedStyle.name}」）`
                    : '请先选择一个视频风格'}
                </button>
              </Box>
            )}
          </Box>
        );

      case 'video_params':
        return (
          <VideoParamsForm
            onSubmit={async (params: VideoParams) => {
              await confirmVideoParams(params);
            }}
          />
        );

      case 'storyboard':
        return (
          <StoryboardView
            storyboard={storyboard}
            isGenerating={isStoryboardGenerating}
            onGenerate={() => generateStoryboard(4)}
            onConfirm={generateVideo}
            onRegenerate={(count, frameIndex) => generateStoryboard(count || 4, frameIndex)}
          />
        );

      case 'video':
        return (
          <VideoResultView
            result={videoResult}
            isGenerating={isVideoGenerating}
            isPolling={isVideoPolling}
            onDownload={handleDownloadVideo}
          />
        );

      case 'copywriting':
        return (
          <Box>
            {videoResult?.status === 'completed' && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  视频生成完成 🎉
                </Typography>
                <VideoResultView
                  result={videoResult}
                  isGenerating={false}
                  isPolling={false}
                />
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <CopywritingResultView
              items={copywritingItems}
              onToggleSelect={(index) => {
                const updated = copywritingItems.map((item) =>
                  item.index === index ? { ...item, selected: !item.selected } : item
                );
                useShouzuoVideoStore.getState().setCopywritingItems(updated);
              }}
              onGenerate={() => generateCopywriting()}
              isGenerating={isCopywritingGenerating}
            />

            {copywritingItems.length > 0 && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={copywritingItems.filter((i) => i.selected).length === 0}
                  style={{
                    background: copywritingItems.filter((i) => i.selected).length === 0 ? '#ccc' : '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 20,
                    padding: '12px 32px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: copywritingItems.filter((i) => i.selected).length === 0 ? 'not-allowed' : 'pointer',
                    opacity: copywritingItems.filter((i) => i.selected).length === 0 ? 0.6 : 1,
                    position: 'relative',
                    zIndex: 10,
                  }}
                >
                  一键下载视频 + 文案 📦
                </button>
              </Box>
            )}
          </Box>
        );

      default:
        return (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">加载中...</Typography>
          </Box>
        );
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <button
          type="button"
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: '#666',
            fontSize: '14px',
            padding: '4px 8px',
          }}
        >
          ← 返回工作台
        </button>
        <VideocamIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5">
          AI 种草视频生成器
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        上传产品图 → AI识别风格 → 确认参数 → 生成故事板 → 生成视频 → AI文案导出
      </Typography>

      {(localError) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalError(null)}>
          {localError}
        </Alert>
      )}

      {/* 步骤条 */}
      <Box sx={{ mb: 3 }}>
        <Stepper activeStep={activeIndex} alternativeLabel>
          {STEPS.map((step) => (
            <Step key={step.id}>
              <StepLabel>
                <Typography variant="body2">{step.label}</Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      {/* 直接用 Box 包裹，不用 Paper，避免 stacking context 干扰 */}
      <Box sx={{ position: 'relative' }}>
        {renderStepContent()}
      </Box>
    </Box>
  );
}
