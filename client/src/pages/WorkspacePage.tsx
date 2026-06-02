import { useState, useCallback, useEffect } from 'react';
import { Box, Grid, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { ModelSelector } from '@/components/ModelSelector/ModelSelector';
import { PromptInput } from '@/components/PromptInput/PromptInput';
import { ImageUpload, UploadedReferenceImage } from '@/components/ImageUpload/ImageUpload';
import { ImageResult } from '@/components/ResultViewer/ImageResult';
import { VideoResult } from '@/components/ResultViewer/VideoResult';
import { TextResult } from '@/components/ResultViewer/TextResult';
import { TaskStatus } from '@/components/ResultViewer/TaskStatus';
import { useCreateTask, useTaskPolling } from '@/hooks/useTasks';
import { useBalance } from '@/hooks/useCredits';
import type { AIModel } from '@/api/models';
import type { GenerationTask, ReferenceImage } from '@/api/tasks';

type ActiveTab = 'image' | 'video' | 'text';

export default function WorkspacePage() {
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('image');
  const [selectedDuration, setSelectedDuration] = useState<number | undefined>(undefined);
  const [referenceImages, setReferenceImages] = useState<UploadedReferenceImage[]>([]);

  const createTaskMutation = useCreateTask();
  const { task, isPolling, poll } = useTaskPolling();
  const { data: balanceData, refetch: refetchBalance } = useBalance();

  const [insufficientDialogOpen, setInsufficientDialogOpen] = useState(false);

  const balance = balanceData?.balance ?? 0;

  // 当 selectedModel 变化时重置 duration 和参考图
  useEffect(() => {
    if (selectedModel?.type === 'video' && selectedModel.durationOptions?.length) {
      setSelectedDuration(selectedModel.durationOptions[0]);
    } else {
      setSelectedDuration(undefined);
    }
    // 模型切换时清空参考图
    setReferenceImages([]);
  }, [selectedModel?.id]);

  // 当 tab 变化时清除已选模型和参考图
  useEffect(() => {
    setSelectedModel(null);
    setReferenceImages([]);
  }, [activeTab]);

  // 计算实际积分
  const actualCost = selectedModel?.type === 'video' && selectedDuration && selectedModel.durationPricing
    ? (selectedModel.durationPricing[selectedDuration] ?? selectedModel.costCredits)
    : (selectedModel?.costCredits ?? 0);

  const handleGenerate = useCallback(() => {
    if (!selectedModel) return;

    // Check balance
    if (balance < actualCost) {
      setInsufficientDialogOpen(true);
      return;
    }

    // 构建参考图数据（只传 url 和 role）
    const refImages: ReferenceImage[] | undefined = referenceImages.length > 0
      ? referenceImages.map(img => ({ url: img.url, role: img.role }))
      : undefined;

    createTaskMutation.mutate(
      {
        modelId: selectedModel.id,
        prompt,
        params: selectedDuration ? { duration: selectedDuration } : {},
        duration: selectedDuration,
        referenceImages: refImages,
      },
      {
        onSuccess: (data) => {
          poll(data.id, selectedModel.type as 'image' | 'video' | 'text');
          refetchBalance();
        },
      },
    );
  }, [selectedModel, prompt, balance, actualCost, selectedDuration, referenceImages, createTaskMutation, poll, refetchBalance]);

  const isGenerating = createTaskMutation.isPending || isPolling;
  const canGenerate = selectedModel && prompt.trim().length > 0 && !isGenerating;

  /** Render the appropriate result viewer based on task type */
  const renderResult = (task: GenerationTask) => {
    if (task.type === 'image') {
      return <ImageResult task={task} />;
    }
    if (task.type === 'video') {
      return <VideoResult task={task} />;
    }
    if (task.type === 'text') {
      return <TextResult task={task} />;
    }
    return null;
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        AI创作工作台
      </Typography>

      <Grid container spacing={3}>
        {/* Left panel: Model Selection */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <ModelSelector
              activeTab={activeTab}
              onTabChange={setActiveTab}
              selectedModelId={selectedModel?.id ?? null}
              onSelectModel={setSelectedModel}
            />
          </Paper>
        </Grid>

        {/* Right panel: Prompt + Upload + Result */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onGenerate={handleGenerate}
              disabled={!canGenerate}
              isGenerating={isGenerating}
              costCredits={actualCost}
              currentBalance={balance}
              selectedModelName={selectedModel?.name ?? ''}
              selectedModelType={selectedModel?.type}
              durationOptions={selectedModel?.durationOptions}
              durationPricing={selectedModel?.durationPricing}
              selectedDuration={selectedDuration}
              onDurationChange={setSelectedDuration}
            />

            {/* 参考图上传区域 */}
            <ImageUpload
              modelId={selectedModel?.id ?? null}
              modelType={selectedModel?.type}
              value={referenceImages}
              onChange={setReferenceImages}
            />
          </Paper>

          {/* Task progress or result */}
          {isPolling && task && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <TaskStatus task={task} />
            </Paper>
          )}

          {task && (task.status === 'completed') && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                生成结果
              </Typography>
              {renderResult(task as GenerationTask)}
            </Paper>
          )}

          {!task && !isPolling && (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                选择一个模型并输入提示词开始创作
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* Insufficient credits dialog */}
      <Dialog open={insufficientDialogOpen} onClose={() => setInsufficientDialogOpen(false)}>
        <DialogTitle>积分不足</DialogTitle>
        <DialogContent>
          <Typography>
            当前积分余额 {balance}，生成此内容需要 {actualCost} 积分。
            请先充值后再试。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInsufficientDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            startIcon={<AccountBalanceWalletIcon />}
            onClick={() => {
              setInsufficientDialogOpen(false);
              window.location.href = '/credits';
            }}
          >
            去充值
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
