import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Chip,
} from '@mui/material';

interface ProductUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onStartAnalysis: () => Promise<void>;
  disabled?: boolean;
}

export default function ProductUpload({
  files,
  onFilesChange,
  onStartAnalysis,
  disabled = false,
}: ProductUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFiles = (fileList: FileList) => {
    const newFiles = Array.from(fileList).filter((f) =>
      f.type.startsWith('image/')
    );
    onFilesChange([...files, ...newFiles]);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onFilesChange(newFiles);
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      await onStartAnalysis();
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        上传产品图片
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        上传服装/产品图片，AI 将自动识别风格特征并推荐合适的视频风格模板
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        建议上传模特穿着的图片，分镜效果更佳。如只有平铺图，系统将自动生成穿着效果图（消耗3积分）。
      </Alert>

      {/* 上传区域 */}
      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragOver ? 'action.hover' : 'transparent',
          transition: 'all 0.2s',
          mb: 3,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        <Typography sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }}>📁</Typography>
        <Typography variant="body1">
          拖拽图片到此处，或 <Box component="span" color="primary.main">点击上传</Box>
        </Typography>
        <Typography variant="caption" color="text.disabled">
          支持 JPG/PNG/WEBP，最多 10 张
        </Typography>
      </Box>

      {/* 已上传文件列表 */}
      {files.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }}>
          {files.map((file, index) => (
            <Chip
              key={index}
              label={file.name}
              onDelete={() => handleRemove(index)}
              sx={{ m: 0.5 }}
            />
          ))}
        </Stack>
      )}

      {/* 开始分析按钮 */}
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={files.length === 0 || disabled || uploading}
        style={{
          background: (files.length === 0 || disabled || uploading) ? '#ccc' : '#7c3aed',
          color: '#fff',
          border: 'none',
          borderRadius: 20,
          padding: '12px 28px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: (files.length === 0 || disabled || uploading) ? 'not-allowed' : 'pointer',
          opacity: (files.length === 0 || disabled || uploading) ? 0.6 : 1,
          position: 'relative',
          zIndex: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {uploading && <CircularProgress size={18} sx={{ color: '#fff' }} />}
        {uploading ? 'AI 识别中...' : '✨ 开始 AI 识别 + 风格推荐'}
      </button>
    </Box>
  );
}
