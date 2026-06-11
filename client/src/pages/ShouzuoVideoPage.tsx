import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Button,
  Divider,
  CircularProgress,
  TextField,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Collapse,
  Slider,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useNavigate } from 'react-router-dom';
import { useShouzuoVideo } from '@/hooks/useShouzuoVideo';
import { useShouzuoVideoStore } from '@/stores/shouzuoVideo.store';
import { uploadReferenceImage } from '@/api/tasks';
import { generateProductDescription } from '@/api/shouzuoVideo';
import { compressImage } from '@/utils/compressImage';
import type { ProductInfo } from '@/types/shouzuo';
import { VIDEO_MODELS } from '@/types/shouzuo';
import WorkflowStepper from '@/components/ShouzuoVideo/WorkflowStepper';
import ProductUpload from '@/components/ShouzuoVideo/ProductUpload';
import StyleSelector from '@/components/ShouzuoVideo/StyleSelector';
import StoryboardView from '@/components/ShouzuoVideo/StoryboardView';
import VideoResultView from '@/components/ShouzuoVideo/VideoResultView';
import CopywritingResultView from '@/components/ShouzuoVideo/CopywritingResultView';

export default function ShouzuoVideoPage() {
  const navigate = useNavigate();
  const [productDescription, setProductDescription] = useState('');
  const [storyboardFrameCount, setStoryboardFrameCount] = useState(4);
  const [videoDuration, setVideoDuration] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [sellingPoints, setSellingPoints] = useState<string[]>([]);
  const [sellingPointInput, setSellingPointInput] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);

  const {
    uploadedFiles,
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
    startAnalysis,
    selectStyle,
    generateStoryboard,
    regenerateStoryboard,
    regenerateSingleFrame,
    regeneratingFrameIndex,
    confirmStoryboardAndGenerateVideo,
    generateCopywriting,
    toggleCopywritingSelect,
    setVideoModel,
    getSelectedCopywriting,
    getSelectedVideoUrl,
    stopPolling,
  } = useShouzuoVideo();

  const { uploadedUrls, setUploadedFiles, reset } = useShouzuoVideoStore();

  useEffect(() => {
    if (uploadedFiles.length > 0 && !showProductForm) {
      setShowProductForm(true);
    }
  }, [uploadedFiles.length]);

  useEffect(() => {
    return () => {
      stopPolling();
      reset();
    };
  }, []);

  const addSellingPoint = useCallback(() => {
    const trimmed = sellingPointInput.trim();
    if (trimmed && sellingPoints.length < 5) {
      setSellingPoints((prev) => [...prev, trimmed]);
      setSellingPointInput('');
    }
  }, [sellingPointInput, sellingPoints.length]);

  const removeSellingPoint = useCallback((index: number) => {
    setSellingPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const buildProductInfo = useCallback((): ProductInfo | undefined => {
    if (!productName.trim() && !productDesc.trim() && sellingPoints.length === 0) {
      return undefined;
    }
    return {
      name: productName.trim(),
      description: productDesc.trim(),
      sellingPoints,
      ...(productPrice.trim() && { price: productPrice.trim() }),
      ...(targetAudience.trim() && { targetAudience: targetAudience.trim() }),
    };
  }, [productName, productDesc, sellingPoints, productPrice, targetAudience]);

  const handleGenerateDescription = useCallback(async () => {
    let imageUrls: string[] = uploadedUrls.length > 0 ? uploadedUrls : [];

    if (imageUrls.length === 0 && uploadedFiles.length > 0) {
      setIsGeneratingDescription(true);
      try {
        const urls: string[] = [];
        for (let i = 0; i < Math.min(uploadedFiles.length, 3); i++) {
          const compressed = await compressImage(uploadedFiles[i], {
            maxWidth: 1200, maxHeight: 1200, quality: 0.85,
          });
          const result = await uploadReferenceImage(compressed);
          urls.push(result.url);
        }
        imageUrls = urls;
      } catch (err) {
        console.error('[AI Desc] upload failed:', err);
        setIsGeneratingDescription(false);
        return;
      }
    }

    if (imageUrls.length === 0) {
      console.warn('[AI Desc] no images available');
      setIsGeneratingDescription(false);
      return;
    }

    if (uploadedUrls.length > 0) {
      setIsGeneratingDescription(true);
    }
    try {
      const result = await generateProductDescription(imageUrls);
      setProductName(result.productName);
      setProductDesc(result.productDescription);
      setSellingPoints(result.sellingPoints.slice(0, 5));
    } catch (err) {
      console.error('[AI Desc] generation failed:', err);
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [uploadedUrls, uploadedFiles]);

  const handleStartAnalysis = useCallback(async () => {
    if (uploadedFiles.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of uploadedFiles) {
        const compressed = await compressImage(file, {
          maxWidth: 1200, maxHeight: 1200, quality: 0.85,
        });
        const result = await uploadReferenceImage(compressed);
        urls.push(result.url);
      }
      const productInfo = buildProductInfo();
      await startAnalysis(urls, productInfo);
    } catch (err) {
      console.error('Upload/Analysis error:', err);
    } finally {
      setUploading(false);
    }
  }, [uploadedFiles, startAnalysis, buildProductInfo]);

  const handleConfirmStoryboard = useCallback(() => {
    confirmStoryboardAndGenerateVideo(videoDuration);
  }, [confirmStoryboardAndGenerateVideo, videoDuration]);

  const handleGenerateCopywriting = useCallback(() => {
    generateCopywriting(productDescription);
  }, [generateCopywriting, productDescription]);

  const handleDownload = useCallback(() => {
    const selected = getSelectedCopywriting();
    const videoUrl = getSelectedVideoUrl();

    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'shouzuo_video.mp4';
      a.click();
    }

    if (selected.length > 0) {
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
    }
  }, [getSelectedCopywriting, getSelectedVideoUrl]);

  const renderProductInfoForm = () => {
    const doGenerate = () => {
      handleGenerateDescription().catch(err => {
        console.error('[AI Desc] uncaught error:', err);
      });
    };

    return (
      <>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Box
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1 }}
            onClick={() => setShowProductForm(!showProductForm)}
          >
            <Typography variant="subtitle2" color="primary" sx={{ mr: 1 }}>
              填写产品信息（可选，填写后故事板和视频将包含产品信息，更适合带货）
            </Typography>
            {showProductForm ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Box>
          <button
            type="button"
            onClick={doGenerate}
            disabled={isGeneratingDescription}
            style={{
              flexShrink: 0,
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: isGeneratingDescription ? '#e0e0e0' : '#1976d2',
              color: isGeneratingDescription ? '#9e9e9e' : '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: isGeneratingDescription ? 'not-allowed' : 'pointer',
              minWidth: 140,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'background-color 0.2s',
              outline: 'none',
              boxShadow: isGeneratingDescription ? 'none' : '0 2px 4px rgba(25,118,210,0.3)',
              position: 'relative',
              zIndex: 99999,
            }}
          >
            {isGeneratingDescription ? (
              <CircularProgress size={16} sx={{ color: '#9e9e9e' }} />
            ) : (
              '✨ AI一键生成描述'
            )}
          </button>
        </Box>

        <Collapse in={showProductForm}>
          <Stack spacing={2}>
            <TextField
              label="产品名称"
              placeholder="例如：手工编织棉麻托特包"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              fullWidth
              size="small"
              InputProps={{ sx: { borderRadius: 1.5 } }}
            />

            <TextField
              label="产品描述"
              placeholder="简要描述产品特点、材质、适用场景等"
              value={productDesc}
              onChange={(e) => setProductDesc(e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
              InputProps={{ sx: { borderRadius: 1.5 } }}
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                核心卖点（最多5条）
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  placeholder="输入一条卖点，按回车添加"
                  value={sellingPointInput}
                  onChange={(e) => setSellingPointInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSellingPoint();
                    }
                  }}
                  size="small"
                  fullWidth
                  disabled={sellingPoints.length >= 5}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={addSellingPoint}
                          disabled={!sellingPointInput.trim() || sellingPoints.length >= 5}
                          size="small"
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 1.5 },
                  }}
                />
              </Box>
              {sellingPoints.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {sellingPoints.map((point, i) => (
                    <Chip
                      key={i}
                      label={point}
                      size="small"
                      onDelete={() => removeSellingPoint(i)}
                      deleteIcon={<DeleteIcon />}
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="价格（可选）"
                placeholder="例如：¥89"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputProps={{ sx: { borderRadius: 1.5 } }}
              />
              <TextField
                label="目标人群（可选）"
                placeholder="例如：18-30岁女性"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                InputProps={{ sx: { borderRadius: 1.5 } }}
              />
            </Box>
          </Stack>
        </Collapse>
      </>
    );
  };

  const renderStepContent = () => {
    if (uploading) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={48} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            正在上传并分析产品图...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            AI 正在理解你的产品风格和特征
          </Typography>
        </Box>
      );
    }

    switch (currentStep) {
      case 'upload':
        return (
          <Box>
            <ProductUpload
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              onStartAnalysis={handleStartAnalysis}
              disabled={uploading}
            />
            {renderProductInfoForm()}
          </Box>
        );

      case 'analyze':
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={48} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              AI 正在分析产品图
            </Typography>
            <Typography variant="body2" color="text.secondary">
              识别品类、颜色、风格...
            </Typography>
          </Box>
        );

      case 'select_style':
        return (
          <Box>
            {analysisResult?.analyzedByAI && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'success.50', borderColor: 'success.light' }}>
                <Typography variant="subtitle2" color="success.main" sx={{ mb: 1 }}>
                  GPT-4o 分析结果
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {analysisResult.colors?.map((c) => (
                    <Chip key={c} label={c} size="small" color="primary" variant="outlined" />
                  ))}
                  {analysisResult.materials?.map((m) => (
                    <Chip key={m} label={m} size="small" color="secondary" variant="outlined" />
                  ))}
                  {analysisResult.style && (
                    <Chip label={`推荐风格：${analysisResult.style}`} size="small" color="success" />
                  )}
                </Box>
                {analysisResult.styleReason && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {analysisResult.styleReason}
                  </Typography>
                )}
              </Paper>
            )}
            {analysisResult?.aiError && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                AI 分析未完成：{analysisResult.aiError}，请手动选择风格
              </Alert>
            )}
            <StyleSelector
              styles={recommendedStyles}
              selectedId={selectedStyle?.id}
              onSelect={selectStyle}
            />
          </Box>
        );

      case 'storyboard':
        return (
          <Box>
            {currentStep === 'storyboard' && !storyboard && !isStoryboardGenerating && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  已选择风格：{selectedStyle?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedStyle?.description}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  接下来将为你的产品生成 {storyboardFrameCount} 个分镜帧的故事板
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                  <Typography variant="body2" sx={{ minWidth: 60, whiteSpace: 'nowrap' }}>
                    分镜数量：{storyboardFrameCount}
                  </Typography>
                  <Slider
                    value={storyboardFrameCount}
                    onChange={(_, v) => setStoryboardFrameCount(v as number)}
                    min={4}
                    max={8}
                    step={1}
                    marks={[
                      { value: 4, label: '4' },
                      { value: 5, label: '5' },
                      { value: 6, label: '6' },
                      { value: 8, label: '8' },
                    ]}
                    valueLabelDisplay="auto"
                    sx={{ flex: 1 }}
                  />
                </Box>

                <Button
                  variant="contained"
                  sx={{ mt: 2 }}
                  onClick={() => generateStoryboard(storyboardFrameCount, productDescription)}
                  disabled={isStoryboardGenerating}
                >
                  开始生成故事板
                </Button>
              </Paper>
            )}

            <StoryboardView
              storyboard={storyboard}
              isGenerating={isStoryboardGenerating}
              regeneratingFrameIndex={regeneratingFrameIndex}
              onConfirm={handleConfirmStoryboard}
              onRegenerateFrame={(frameIndex, feedback) => {
                regenerateSingleFrame(frameIndex, feedback);
              }}
            />
          </Box>
        );

      case 'confirm_board':
        return (
          <Box>
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderColor: 'primary.main', borderWidth: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                🎬 选择视频生成模型
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                不同模型生成效果和价格不同，请根据需求选择
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {VIDEO_MODELS.map((model) => (
                  <Paper
                    key={model.id}
                    variant="outlined"
                    onClick={() => setVideoModel(model.id)}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      borderColor: videoModel === model.id ? 'primary.main' : 'divider',
                      borderWidth: videoModel === model.id ? 2 : 1,
                      bgcolor: videoModel === model.id ? 'primary.50' : 'background.paper',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography fontSize="1.5rem">{model.icon}</Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={600}>
                          {model.name}
                          {videoModel === model.id && (
                            <Chip label="已选" color="primary" size="small" sx={{ ml: 1, height: 20 }} />
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {model.description}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5, mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 0.5 }}>
                ⏱ 视频时长
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                选择生成视频的时长（更长视频消耗更多积分）
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Slider
                  value={videoDuration}
                  onChange={(_, v) => setVideoDuration(v as number)}
                  min={5}
                  max={15}
                  step={1}
                  marks={[
                    { value: 5, label: '5秒' },
                    { value: 8, label: '8秒' },
                    { value: 10, label: '10秒' },
                    { value: 12, label: '12秒' },
                    { value: 15, label: '15秒' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}秒`}
                  sx={{ flex: 1 }}
                />
                <Chip label={`${videoDuration}秒`} color="primary" size="small" />
              </Box>
            </Paper>

            {storyboard && (
              <StoryboardView
                storyboard={storyboard}
                isGenerating={isStoryboardGenerating}
                regeneratingFrameIndex={regeneratingFrameIndex}
                onConfirm={handleConfirmStoryboard}
                onRegenerate={(count, fb) => {
                  setStoryboardFrameCount(count);
                  regenerateStoryboard(count, fb);
                }}
                onRegenerateFrame={(frameIndex, feedback) => {
                  regenerateSingleFrame(frameIndex, feedback);
                }}
              />
            )}
          </Box>
        );

      case 'generate':
        return (
          <VideoResultView
            result={videoResult}
            isGenerating={isVideoGenerating}
            isPolling={isVideoPolling}
          />
        );

      case 'copywriting':
      case 'download':
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

            {copywritingItems.length === 0 ? (
              <CopywritingResultView
                items={copywritingItems}
                onToggleSelect={toggleCopywritingSelect}
                onGenerate={handleGenerateCopywriting}
                isGenerating={isCopywritingGenerating}
              />
            ) : (
              <Box>
                <CopywritingResultView
                  items={copywritingItems}
                  onToggleSelect={toggleCopywritingSelect}
                  onGenerate={handleGenerateCopywriting}
                  isGenerating={isCopywritingGenerating}
                />

                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleDownload}
                    disabled={copywritingItems.filter((i) => i.selected).length === 0}
                    sx={{ px: 4, py: 1.5 }}
                  >
                    一键下载视频 + 文案
                  </Button>
                </Box>
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
          onClick={() => navigate('/workspace')}
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
        上传产品图 → 填写产品信息 → AI 分析风格 → 生成故事板 → 确认分镜 → 生成视频 + 文案
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => { /* cleared via setStep */ }}>
          {error}
        </Alert>
      )}

      <WorkflowStepper activeStep={currentStep} />

      <Paper sx={{ p: 3 }}>
        {renderStepContent()}
      </Paper>
    </Box>
  );
}
