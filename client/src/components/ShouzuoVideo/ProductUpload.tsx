import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface ProductUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onStartAnalysis: () => void;
  disabled?: boolean;
  maxFiles?: number;
}

export default function ProductUpload({
  files,
  onFilesChange,
  onStartAnalysis,
  disabled = false,
  maxFiles = 5,
}: ProductUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      const combined = [...files, ...dropped].slice(0, maxFiles);
      onFilesChange(combined);
    },
    [files, maxFiles, onFilesChange],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(e.target.files ?? []);
      const combined = [...files, ...selected].slice(0, maxFiles);
      onFilesChange(combined);
    },
    [files, maxFiles, onFilesChange],
  );

  const removeFile = useCallback(
    (index: number) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange],
  );

  const previews = files.map((f) => URL.createObjectURL(f));

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Step 1: 上传产品图
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        上传 1-{maxFiles} 张产品图（支持多角度），JPG/PNG 格式
      </Typography>

      {/* 上传区域 */}
      <Paper
        variant="outlined"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        sx={{
          p: 4,
          mb: 2,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          bgcolor: dragOver ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => document.getElementById('shouzuo-file-input')?.click()}
      >
        <input
          id="shouzuo-file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={handleFileInput}
        />
        <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          拖拽图片到此处，或点击上传
        </Typography>
        <Typography variant="caption" color="text.disabled">
          支持 JPG / PNG / WebP（建议 1000x1000 以上）
        </Typography>
      </Paper>

      {/* 已上传预览 */}
      {previews.length > 0 && (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              mb: 2,
            }}
          >
            {previews.map((url, i) => (
              <Box
                key={i}
                sx={{
                  position: 'relative',
                  width: 140,
                  height: 140,
                  flexShrink: 0,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: 'grey.100',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <img
                  src={url}
                  alt={`产品图 ${i + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgba(255,0,0,0.7)' },
                    width: 24,
                    height: 24,
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
            {files.length < maxFiles && (
              <Box
                sx={{
                  width: 140,
                  height: 140,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1.5,
                  border: '2px dashed',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  bgcolor: 'background.paper',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
                onClick={() => document.getElementById('shouzuo-file-input')?.click()}
              >
                <AddIcon sx={{ color: 'text.disabled' }} />
              </Box>
            )}
          </Box>
        </>
      )}

      {/* 开始分析按钮 */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={files.length === 0 || disabled}
        onClick={onStartAnalysis}
        sx={{ mt: 2, py: 1.5 }}
      >
        {files.length === 0 ? '请先上传产品图' : `开始分析 (${files.length} 张)`}
      </Button>
    </Box>
  );
}
