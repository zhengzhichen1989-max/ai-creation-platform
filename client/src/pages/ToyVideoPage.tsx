import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Radio,
  RadioGroup,
  FormControlLabel as RadioFormControlLabel,
} from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useToyVideo } from '@/hooks/useToyVideo';
import { useToyVideoStore } from '@/stores/toyVideo.store';
import * as toyApi from '@/api/toy-video';
import type { ToyVideoStep, ToyTemplate, ToyLanguage, ToySize } from '@/types/toy-video';

// 步骤定义
const STEPS = [
  { id: 'upload', label: '上传产品图' },
  { id: 'ai_analyze', label: 'AI识别' },
  { id: 'product_info', label: '填写产品信息' },
  { id: 'image_enhance', label: '修图决策' },
  { id: 'template_select', label: '选择内容套路' },
  { id: 'params_select', label: '选择参数' },
  { id: 'storyboard', label: '生成故事板' },
  { id: 'preview', label: '预览与调整' },
  { id: 'generate', label: '生成视频' },
];

export default function ToyVideoPage() {
  const navigate = useNavigate();
  const [localError, setLocalError] = useState<string | null>(null);

  // 从 store 读取状态
  const {
    currentStep,
    uploadedImages,
    setUploadedImages,
    analysisResult,
    setAnalysisResult,
    productInfo,
    setProductInfo,
    selectedTemplate,
    setSelectedTemplate,
    selectedLanguage,
    setSelectedLanguage,
    selectedSize,
    setSelectedSize,
    storyboard,
    setStoryboard,
    taskId,
    setTaskId,
    taskStatus,
    setTaskStatus,
  } = useToyVideoStore();

  const {
    isAnalyzing,
    isGeneratingStoryboard,
    isCreatingTask,
    error: hookError,
    analyzeImage,
    generateStoryboard,
    createVideoTask,
    getTaskStatus,
  } = useToyVideo();

  // 页面加载时获取模板、语言、尺寸列表
  const [templates, setTemplates] = useState<ToyTemplate[]>([]);
  const [languages, setLanguages] = useState<ToyLanguage[]>([]);
  const [sizes, setSizes] = useState<ToySize[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesRes, languagesRes, sizesRes] = await Promise.all([
          toyApi.getToyTemplates(),
          toyApi.getToyLanguages(),
          toyApi.getToySizes(),
        ]);
        setTemplates(templatesRes.data || []);
        setLanguages(languagesRes.data || []);
        setSizes(sizesRes.data || []);
      } catch (error) {
        console.error('[ToyVideo] 获取数据失败:', error);
      }
    };
    fetchData();
  }, []);

  // 处理图片上传
  const handleImageUpload = (imageUrls: string[]) => {
    setUploadedImages(imageUrls);
    setLocalError(null);
  };

  // 处理 AI 识别
  const handleAnalyze = async () => {
    if (uploadedImages.length === 0) {
      setLocalError('请先上传产品图片');
      return;
    }

    try {
      const result = await analyzeImage(uploadedImages[0]);
      setAnalysisResult(result);
      setLocalError(null);
    } catch (error: any) {
      setLocalError(error.message || '识别失败');
    }
  };

  // 处理产品信息提交
  const handleProductInfoSubmit = () => {
    if (!productInfo.name) {
      setLocalError('请填写产品名称');
      return;
    }
    setLocalError(null);
    setCurrentStep('template_select');
  };

  // 处理故事板生成
  const handleGenerateStoryboard = async () => {
    if (!selectedTemplate || !selectedLanguage) {
      setLocalError('请选择模板和语言');
      return;
    }

    try {
      const result = await generateStoryboard({
        templateId: selectedTemplate,
        productInfo,
        language: selectedLanguage,
      });
      setStoryboard(result.shots || []);
      setLocalError(null);
    } catch (error: any) {
      setLocalError(error.message || '生成失败');
    }
  };

  // 处理视频生成
  const handleGenerateVideo = async () => {
    if (!selectedTemplate || !selectedLanguage || !selectedSize || !storyboard) {
      setLocalError('请完成前面的步骤');
      return;
    }

    try {
      const result = await createVideoTask({
        templateId: selectedTemplate,
        language: selectedLanguage,
        size: selectedSize,
        productInfo,
        storyboard,
      });
      setTaskId(result.taskId);
      setTaskStatus('processing');
      setLocalError(null);
    } catch (error: any) {
      setLocalError(error.message || '创建任务失败');
    }
  };

  // 轮询任务状态
  useEffect(() => {
    if (!taskId || taskStatus !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const result = await getTaskStatus(taskId);
        if (result.status === 'completed' || result.status === 'failed') {
          setTaskStatus(result.status);
          clearInterval(interval);
        }
      } catch (error) {
        console.error('[ToyVideo] 轮询失败:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [taskId, taskStatus]);

  // 渲染当前步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 'upload':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              上传产品图片（支持多张）
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              建议上传 3-5 张图片，包括正面、侧面、细节、包装等角度
            </Typography>
            {/* 图片上传组件 - 需要创建 */}
            <Box
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                id="toy-image-upload"
                onChange={(e) => {
                  // TODO: 实际上传逻辑
                  console.log('上传图片:', e.target.files);
                }}
              />
              <label htmlFor="toy-image-upload">
                <Typography>点击上传图片</Typography>
              </label>
            </Box>
            {uploadedImages.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {uploadedImages.map((url, index) => (
                  <img key={index} src={url} alt="" style={{ width: 100, height: 100, objectFit: 'cover' }} />
                ))}
              </Box>
            )}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => setCurrentStep('ai_analyze')}
                disabled={uploadedImages.length === 0}
              >
                下一步
              </Button>
            </Box>
          </Box>
        );

      case 'ai_analyze':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              AI 识别品类/特征
            </Typography>
            <Button
              variant="contained"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              sx={{ mt: 2 }}
            >
              {isAnalyzing ? <CircularProgress size={24} /> : '开始识别'}
            </Button>
            {analysisResult && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle1">识别结果：</Typography>
                <Typography>品类: {analysisResult.category}</Typography>
                <Typography>材质: {analysisResult.material}</Typography>
                <Typography>玩法: {analysisResult.gameplay}</Typography>
                <Typography>适用年龄: {analysisResult.ageRange}</Typography>
                <Typography>视觉风格: {analysisResult.visualStyle}</Typography>
              </Box>
            )}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => setCurrentStep('product_info')}
                disabled={!analysisResult}
              >
                下一步
              </Button>
            </Box>
          </Box>
        );

      case 'product_info':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              填写产品信息
            </Typography>
            <TextField
              fullWidth
              label="产品名称"
              value={productInfo.name || ''}
              onChange={(e) => setProductInfo({ ...productInfo, name: e.target.value })}
              sx={{ mb: 2, mt: 2 }}
            />
            <TextField
              fullWidth
              label="核心卖点（每行一个）"
              multiline
              rows={4}
              value={(productInfo.sellingPoints || []).join('\n')}
              onChange={(e) => setProductInfo({ ...productInfo, sellingPoints: e.target.value.split('\n') })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="适用年龄"
              value={productInfo.ageRange || ''}
              onChange={(e) => setProductInfo({ ...productInfo, ageRange: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="材质"
              value={productInfo.material || ''}
              onChange={(e) => setProductInfo({ ...productInfo, material: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="玩法"
              value={productInfo.gameplay || ''}
              onChange={(e) => setProductInfo({ ...productInfo, gameplay: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={handleProductInfoSubmit}>
                下一步
              </Button>
            </Box>
          </Box>
        );

      case 'template_select':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              选择内容套路
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {templates.map((template) => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card
                    variant={selectedTemplate === template.id ? 'elevation' : 'outlined'}
                    elevation={selectedTemplate === template.id ? 4 : 0}
                    sx={{
                      cursor: 'pointer',
                      border: selectedTemplate === template.id ? '2px solid' : '1px solid',
                      borderColor: selectedTemplate === template.id ? 'primary.main' : 'divider',
                    }}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardContent>
                      <Typography variant="h6">{template.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        时长: {template.duration}秒 | 分镜数: {template.shotCount}
                      </Typography>
                      <Chip label={template.category === 'electric' ? '电动玩具' : '积木/拼搭'} size="small" sx={{ mt: 1 }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => setCurrentStep('params_select')}
                disabled={!selectedTemplate}
              >
                下一步
              </Button>
            </Box>
          </Box>
        );

      case 'params_select':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              选择平台和语言
            </Typography>
            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>讲解语言</InputLabel>
              <Select
                value={selectedLanguage}
                label="讲解语言"
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {languages.map((lang) => (
                  <MenuItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>视频尺寸</InputLabel>
              <Select
                value={selectedSize}
                label="视频尺寸"
                onChange={(e) => setSelectedSize(e.target.value)}
              >
                {sizes.map((size) => (
                  <MenuItem key={size.value} value={size.value}>
                    {size.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => setCurrentStep('storyboard')}
                disabled={!selectedLanguage || !selectedSize}
              >
                下一步
              </Button>
            </Box>
          </Box>
        );

      case 'storyboard':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              生成故事板（分镜）
            </Typography>
            <Button
              variant="contained"
              onClick={handleGenerateStoryboard}
              disabled={isGeneratingStoryboard}
              sx={{ mt: 2 }}
            >
              {isGeneratingStoryboard ? <CircularProgress size={24} /> : '生成故事板'}
            </Button>
            {storyboard && storyboard.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  故事板预览：
                </Typography>
                {storyboard.map((shot: any, index: number) => (
                  <Paper key={index} sx={{ p: 2, mb: 1 }}>
                    <Typography variant="subtitle2">第 {shot.seq} 镜（{shot.seconds}秒）</Typography>
                    <Typography variant="body2">画面: {shot.imagePrompt}</Typography>
                    <Typography variant="body2">配音: {shot.voiceover}</Typography>
                    <Typography variant="body2">字幕: {shot.subtitles}</Typography>
                  </Paper>
                ))}
              </Box>
            )}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => setCurrentStep('generate')}
                disabled={!storyboard || storyboard.length === 0}
              >
                生成视频
              </Button>
            </Box>
          </Box>
        );

      case 'generate':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              生成最终视频
            </Typography>
            <Button
              variant="contained"
              onClick={handleGenerateVideo}
              disabled={isCreatingTask}
              sx={{ mt: 2 }}
            >
              {isCreatingTask ? <CircularProgress size={24} /> : '开始生成'}
            </Button>
            {taskId && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography>任务 ID: {taskId}</Typography>
                <Typography>状态: {taskStatus}</Typography>
                {taskStatus === 'processing' && <CircularProgress size={24} sx={{ mt: 1 }} />}
                {taskStatus === 'completed' && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    视频生成完成！
                  </Alert>
                )}
                {taskStatus === 'failed' && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    视频生成失败，请重试
                  </Alert>
                )}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        <VideocamIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        玩具 AI 视频生成器
      </Typography>

      <Stepper activeStep={STEPS.findIndex(s => s.id === currentStep)} sx={{ mb: 4 }}>
        {STEPS.map((step) => (
          <Step key={step.id}>
            <StepLabel>{step.label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {localError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLocalError(null)}>
          {localError}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>{renderStepContent()}</Paper>
    </Box>
  );
}
