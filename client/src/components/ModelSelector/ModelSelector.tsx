import { Box } from '@mui/material';
import { ModelTabs } from './ModelTabs';
import { ModelCard } from './ModelCard';
import { useModels } from '@/hooks/useModels';
import type { AIModel } from '@/api/models';

interface ModelSelectorProps {
  activeTab: 'image' | 'video' | 'text';
  onTabChange: (tab: 'image' | 'video' | 'text') => void;
  selectedModelId: string | null;
  onSelectModel: (model: AIModel) => void;
}

export function ModelSelector({
  activeTab,
  onTabChange,
  selectedModelId,
  onSelectModel,
}: ModelSelectorProps) {
  const { data: models, isLoading } = useModels(activeTab);

  return (
    <Box>
      <ModelTabs activeTab={activeTab} onTabChange={onTabChange} />

      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          加载中...
        </Box>
      )}

      {!isLoading && models && models.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          暂无可用模型
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
        {models?.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            selected={model.id === selectedModelId}
            onClick={() => onSelectModel(model)}
          />
        ))}
      </Box>
    </Box>
  );
}
