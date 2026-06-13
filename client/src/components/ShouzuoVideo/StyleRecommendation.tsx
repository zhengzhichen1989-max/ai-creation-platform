import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  TextField,
  IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useShouzuoVideo } from '@/hooks/useShouzuoVideo';
import { getStyleTemplates } from '@/api/shouzuoVideo';
import type { StyleTemplate, AiRecognitionResult, ClothingInfo } from '@/types/shouzuo';

interface StyleRecommendationProps {
  onNext: () => void;
}

export default function StyleRecommendation({ onNext }: StyleRecommendationProps) {
  const {
    session,
    aiRecognition,
    isAnalyzing,
    userEditedClothing,
    setAiRecognition,
    saveUserEditedClothing,
    setSelectedStyle,
  } = useShouzuoVideo();

  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedInfo, setEditedInfo] = useState<ClothingInfo | null>(null);

  // 加载风格模板列表
  useEffect(() => {
    getStyleTemplates().then(setTemplates).catch(console.error);
  }, []);

  // 开始 AI 识别
  useEffect(() => {
    if (session && !aiRecognition) {
      // 调用 AI 识别 API
      // 这里需要在 hook 中实现 analyzeImages
    }
  }, [session]);

  const handleEditToggle = () => {
    if (!isEditing && aiRecognition) {
      setEditedInfo({
        clothing_type: aiRecognition.clothing_type,
        material: aiRecognition.material,
        season: aiRecognition.season,
        main_color: aiRecognition.main_color,
        style_tags: aiRecognition.style_tags,
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSaveEdit = async () => {
    if (editedInfo && session) {
      await saveUserEditedClothing(editedInfo);
      setIsEditing(false);
    }
  };

  const handleSelectStyle = (style: StyleTemplate) => {
    setSelectedStyle(style);
  };

  const handleNext = () => {
    onNext();
  };

  if (isAnalyzing) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          AI 正在识别产品图片...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 2: AI 识别 + 风格推荐
      </Typography>

      {/* AI 识别结果 */}
      {aiRecognition && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">AI 识别结果</Typography>
            <IconButton size="small" onClick={handleEditToggle}>
              {isEditing ? <CheckIcon /> : <EditIcon />}
            </IconButton>
          </Box>

          {isEditing ? (
            <TextField
              multiline
              fullWidth
              rows={4}
              value={JSON.stringify(editedInfo, null, 2)}
              onChange={(e) => {
                try {
                  setEditedInfo(JSON.parse(e.target.value));
                } catch {
                  // ignore
                }
              }}
            />
          ) : (
            <Box>
              <Typography>服装类型: {aiRecognition.clothing_type}</Typography>
              <Typography>材质: {aiRecognition.material}</Typography>
              <Typography>季节: {aiRecognition.season.join(', ')}</Typography>
              <Typography>主色调: {aiRecognition.main_color}</Typography>
              <Box sx={{ mt: 1 }}>
                {aiRecognition.style_tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5 }} />
                ))}
              </Box>
            </Box>
          )}

          {isEditing && (
            <Button onClick={handleSaveEdit} variant="contained" size="small" sx={{ mt: 2 }}>
              保存
            </Button>
          )}
        </Paper>
      )}

      {/* 风格推荐 */}
      <Typography variant="subtitle1" gutterBottom>
        推荐风格
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        {templates.map((style) => (
          <Card
            key={style.style_id}
            sx={{
              cursor: 'pointer',
              border: (theme) => `2px solid ${style.style_id === aiRecognition?.recommendations?.[0]?.style_id ? theme.palette.primary.main : 'transparent'}`,
            }}
            onClick={() => handleSelectStyle(style)}
          >
            <CardContent>
              <Typography variant="h6">{style.emoji} {style.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {style.tagline}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {style.description}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Box sx={{ textAlign: 'right' }}>
        <Button variant="contained" onClick={handleNext} disabled={!aiRecognition}>
          下一步
        </Button>
      </Box>
    </Box>
  );
}
