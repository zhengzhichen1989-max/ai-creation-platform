import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Button,
  CircularProgress,
  Divider,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { useShouzuoVideo } from '@/hooks/useShouzuoVideo';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import WorkflowStepper from '@/components/ShouzuoVideo/WorkflowStepper';
import ProductUpload from '@/components/ShouzuoVideo/ProductUpload';
import StyleRecommendation from '@/components/ShouzuoVideo/StyleRecommendation';
import VideoParamsForm from '@/components/ShouzuoVideo/VideoParamsForm';
import StoryboardView from '@/components/ShouzuoVideo/StoryboardView';
import VideoResultView from '@/components/ShouzuoVideo/VideoResultView';
import CopywritingResultView from '@/components/ShouzuoVideo/CopywritingResultView';
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
  const [error, setError] = useState<string | null>(null);

  const {
    session,
    currentStep,
    isAnalyzing,
    isStoryboardGenerating,
    isVideoGenerating,
    isVideoPolling,
    isCopywritingGenerating,
    storyboard,
    videoResult,
    copywritingItems,
    aiRecognition,
    selectedStyle,
    videoParams,
    estimatedCredits,
    error: hookError,
    startAnalysis,
    selectStyle,
    confirmVideoParams,
    generateStoryboard,
    confirmStoryboardAndGenerateVideo,
    generateCopywriting,
    toggleCopywritingSelect,
    getSelectedCopywriting,
    getSelectedVideoUrl,
    stopPolling,
    reset,
  } = useShouzuoVideo();

  const { uploadedFiles, setUploadedFiles, reset: resetStore } = useShouzuoVideoStore();

  // 错误处理
  useEffect(() => {
    if (hookError) {
      setError(hookError);
    }
  }, [hookError]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopPolling();
      reset();
    };
  }, []);

  // 步骤导航
  const handleNext = useCallback(() => {
    // 步骤前进逻辑由各个子组件内部处理
    console.log('[Shouzuo] Next step triggered');
  }, []);

  const handleBack = useCallback(() => {
    navigate('/workspace');
  }, [navigate]);

  // 下载视频
  const handleDownloadVideo = useCallback(async () => {
    const videoUrl = getSelectedVideoUrl();
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
    } catch (err) {
      console.warn('[Shouzuo Video] blob下载失败，尝试直接下载:', err);
      const a = document.createElement('a');
      a.href = videoUrl!;
      a.download = 'shouzuo_video.mp4';
      a.target = '_blank';
      a.click();
    }
  }, [getSelectedVideoUrl]);

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

  // 一键下载
  const handleDownloadAll = useCallback(() => {
    handleDownloadVideo();
    handleDownloadCopywriting();
  }, [handleDownloadVideo, handleDownloadCopywriting]);

  // 渲染当前步骤内容
  const renderStepContent = () => {
    // 全局加载状态
    if (isAnalyzing) {
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            AI 正在识别产品图片...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            识别服装类型、材质、风格特征
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
              await startAnalysis(uploadedFiles);
            }}
            disabled={isAnalyzing}
          />
        );

      case 'ai_recognize':
        return (
          <StyleRecommendation
            onNext={() => {
              // 切换到下一步
              console.log('[Shouzuo] Style selected, move to video params');
            }}
          />
        );

      case 'video_params':
        return (
          <VideoParamsForm
            estimatedCredits={estimatedCredits}
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
            onGenerate={() => generateStoryboard()}
            onConfirm={confirmStoryboardAndGenerateVideo}
            onRegenerate={(count) => generateStoryboard(count)}
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
                  视频生成完成
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
              onToggleSelect={toggleCopywritingSelect}
              onGenerate={() => generateCopywriting('')}
              isGenerating={isCopywritingGenerating}
            />

            {copywritingItems.length > 0 && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleDownloadAll}
                  disabled={copywritingItems.filter((i) => i.selected).length === 0}
                  sx={{ px: 4, py: 1.5 }}
                >
                  一键下载视频 + 文案
                </Button>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          size="small"
          sx={{ minWidth: 'auto' }}
        >
          返回工作台
        </Button>
        <VideocamIcon sx={{ color: 'primary.main', fontSize: 28 }} />
        <Typography variant="h5">
          AI 种草视频生成器
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        上传产品图 → AI识别风格 → 确认参数 → 生成故事板 → 生成视频 → AI文案导出
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <WorkflowStepper activeStep={currentStep} steps={STEPS} />

      <Paper sx={{ p: 3 }}>
        {renderStepContent()}
      </Paper>
    </Box>
  );
}
