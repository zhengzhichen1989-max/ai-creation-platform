import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Snackbar,
  Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AddIcon from '@mui/icons-material/Add';
import {
  adminListPackages,
  adminCreatePackage,
  adminUpdatePackage,
  adminDeletePackage,
  adminListModels,
  adminCreateModel,
  adminUpdateModel,
  adminDeleteModel,
  type AdminCreditPackage,
  type AdminPackageCreatePayload,
  type AdminPackageUpdatePayload,
  type AdminAiModel,
  type AdminModelCreatePayload,
  type AdminModelUpdatePayload,
} from '@/api/admin';
import UserListTab from './admin/UserListTab';
import OperationLogTab from './admin/OperationLogTab';

// ---- 通用 Tab Panel ----

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

// ============================================================
// 积分套餐管理
// ============================================================

interface PackageFormData {
  id: string;
  name: string;
  credits: string;
  price_cents: string;
  unit_label: string;
  enabled: boolean;
  sort_order: string;
}

const defaultPackageForm: PackageFormData = {
  id: '',
  name: '',
  credits: '',
  price_cents: '',
  unit_label: '',
  enabled: true,
  sort_order: '0',
};

function PackageManager() {
  const [packages, setPackages] = useState<AdminCreditPackage[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormData>(defaultPackageForm);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchPackages = useCallback(async () => {
    try {
      const data = await adminListPackages();
      setPackages(data);
    } catch {
      setSnackbar({ open: true, message: '获取积分套餐失败', severity: 'error' });
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(defaultPackageForm);
    setDialogOpen(true);
  };

  const openEditDialog = (pkg: AdminCreditPackage) => {
    setEditingId(pkg.id);
    setForm({
      id: pkg.id,
      name: pkg.name,
      credits: String(pkg.credits),
      price_cents: String(pkg.price_cents),
      unit_label: pkg.unit_label || '',
      enabled: pkg.enabled === 1,
      sort_order: String(pkg.sort_order),
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingId) {
        const payload: AdminPackageUpdatePayload = {
          name: form.name,
          credits: parseInt(form.credits, 10),
          price_cents: parseInt(form.price_cents, 10),
          unit_label: form.unit_label,
          enabled: form.enabled ? 1 : 0,
          sort_order: parseInt(form.sort_order, 10),
        };
        await adminUpdatePackage(editingId, payload);
        setSnackbar({ open: true, message: '套餐更新成功', severity: 'success' });
      } else {
        const payload: AdminPackageCreatePayload = {
          id: form.id,
          name: form.name,
          credits: parseInt(form.credits, 10),
          price_cents: parseInt(form.price_cents, 10),
          unit_label: form.unit_label,
          enabled: form.enabled ? 1 : 0,
          sort_order: parseInt(form.sort_order, 10),
        };
        await adminCreatePackage(payload);
        setSnackbar({ open: true, message: '套餐创建成功', severity: 'success' });
      }
      handleCloseDialog();
      fetchPackages();
    } catch {
      setSnackbar({ open: true, message: '操作失败，请检查输入', severity: 'error' });
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await adminDeletePackage(id);
      setSnackbar({ open: true, message: '套餐已下架', severity: 'success' });
      fetchPackages();
    } catch {
      setSnackbar({ open: true, message: '下架失败', severity: 'error' });
    }
  };

  const updateForm = (field: keyof PackageFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">积分套餐管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          新增套餐
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>名称</TableCell>
              <TableCell align="right">积分</TableCell>
              <TableCell align="right">价格(分)</TableCell>
              <TableCell>单位标签</TableCell>
              <TableCell align="right">排序</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{pkg.id}</TableCell>
                <TableCell>{pkg.name}</TableCell>
                <TableCell align="right">{pkg.credits}</TableCell>
                <TableCell align="right">{pkg.price_cents}</TableCell>
                <TableCell>{pkg.unit_label || '-'}</TableCell>
                <TableCell align="right">{pkg.sort_order}</TableCell>
                <TableCell>
                  <Chip
                    label={pkg.enabled ? '上架' : '已下架'}
                    color={pkg.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEditDialog(pkg)} title="编辑">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {pkg.enabled === 1 && (
                    <IconButton size="small" color="error" onClick={() => handleDisable(pkg.id)} title="下架">
                      <DeleteForeverIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {packages.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 新增/编辑 Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '编辑积分套餐' : '新增积分套餐'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="套餐ID"
            value={form.id}
            onChange={(e) => updateForm('id', e.target.value)}
            disabled={!!editingId}
            fullWidth
            size="small"
          />
          <TextField
            label="套餐名称"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="积分数量"
            type="number"
            value={form.credits}
            onChange={(e) => updateForm('credits', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="价格(分)"
            type="number"
            value={form.price_cents}
            onChange={(e) => updateForm('price_cents', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="单位标签"
            value={form.unit_label}
            onChange={(e) => updateForm('unit_label', e.target.value)}
            fullWidth
            size="small"
            placeholder="如：约0.10元/积分"
          />
          <TextField
            label="排序权重"
            type="number"
            value={form.sort_order}
            onChange={(e) => updateForm('sort_order', e.target.value)}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={
              <Switch checked={form.enabled} onChange={(e) => updateForm('enabled', e.target.checked)} />
            }
            label="上架"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingId ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

// ============================================================
// AI模型管理
// ============================================================

interface ModelFormData {
  id: string;
  name: string;
  type: string;
  category: string;
  cost_credits: string;
  adapter_class: string;
  config: string;
  enabled: boolean;
  sort_order: string;
  duration_options: string;
  duration_pricing: string;
  resolution_options: string;
  resolution_pricing: string;
}

const defaultModelForm: ModelFormData = {
  id: '',
  name: '',
  type: 'image',
  category: 'starter',
  cost_credits: '',
  adapter_class: '',
  config: '{}',
  enabled: true,
  sort_order: '0',
  duration_options: '',
  duration_pricing: '',
  resolution_options: '',
  resolution_pricing: '',
};

const MODEL_TYPES = [
  { value: 'image', label: '图片生成' },
  { value: 'video', label: '视频生成' },
  { value: 'text', label: '文案生成' },
];

const MODEL_CATEGORIES = [
  { value: 'starter', label: '入门' },
  { value: 'standard', label: '标准' },
  { value: 'advanced', label: '高级' },
  { value: 'flagship', label: '旗舰' },
];

function ModelManager() {
  const [models, setModels] = useState<AdminAiModel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ModelFormData>(defaultModelForm);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchModels = useCallback(async () => {
    try {
      const data = await adminListModels();
      setModels(data);
    } catch {
      setSnackbar({ open: true, message: '获取AI模型失败', severity: 'error' });
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(defaultModelForm);
    setDialogOpen(true);
  };

  const openEditDialog = (model: AdminAiModel) => {
    setEditingId(model.id);
    setForm({
      id: model.id,
      name: model.name,
      type: model.type,
      category: model.category,
      cost_credits: String(model.cost_credits),
      adapter_class: model.adapter_class,
      config: model.config || '{}',
      enabled: model.enabled === 1,
      sort_order: String(model.sort_order),
      duration_options: model.duration_options || '',
      duration_pricing: model.duration_pricing || '',
      resolution_options: (model as any).resolution_options || '',
      resolution_pricing: (model as any).resolution_pricing || '',
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingId) {
        const payload: AdminModelUpdatePayload = {
          name: form.name,
          type: form.type as 'image' | 'video' | 'text',
          category: form.category as 'starter' | 'standard' | 'advanced' | 'flagship',
          cost_credits: parseInt(form.cost_credits, 10),
          adapter_class: form.adapter_class,
          config: form.config,
          enabled: form.enabled ? 1 : 0,
          sort_order: parseInt(form.sort_order, 10),
          duration_options: form.duration_options || null,
          duration_pricing: form.duration_pricing || null,
          resolution_options: form.resolution_options || null,
          resolution_pricing: form.resolution_pricing || null,
        };
        await adminUpdateModel(editingId, payload);
        setSnackbar({ open: true, message: '模型更新成功', severity: 'success' });
      } else {
        const payload: AdminModelCreatePayload = {
          id: form.id,
          name: form.name,
          type: form.type as 'image' | 'video' | 'text',
          category: form.category as 'starter' | 'standard' | 'advanced' | 'flagship',
          cost_credits: parseInt(form.cost_credits, 10),
          adapter_class: form.adapter_class,
          config: form.config,
          enabled: form.enabled ? 1 : 0,
          sort_order: parseInt(form.sort_order, 10),
          duration_options: form.duration_options || null,
          duration_pricing: form.duration_pricing || null,
          resolution_options: form.resolution_options || null,
          resolution_pricing: form.resolution_pricing || null,
        };
        await adminCreateModel(payload);
        setSnackbar({ open: true, message: '模型创建成功', severity: 'success' });
      }
      handleCloseDialog();
      fetchModels();
    } catch {
      setSnackbar({ open: true, message: '操作失败，请检查输入', severity: 'error' });
    }
  };

  const handleDisable = async (id: string) => {
    try {
      await adminDeleteModel(id);
      setSnackbar({ open: true, message: '模型已下架', severity: 'success' });
      fetchModels();
    } catch {
      setSnackbar({ open: true, message: '下架失败', severity: 'error' });
    }
  };

  const updateForm = (field: keyof ModelFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">AI模型管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          新增模型
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>名称</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>定位</TableCell>
              <TableCell align="right">消耗积分</TableCell>
              <TableCell>适配器</TableCell>
              <TableCell align="right">排序</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 13 }}>{model.id}</TableCell>
                <TableCell>{model.name}</TableCell>
                <TableCell>
                  <Chip label={model.type === 'image' ? '图片' : model.type === 'video' ? '视频' : '文案'} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip
                    label={MODEL_CATEGORIES.find((c) => c.value === model.category)?.label || model.category}
                    size="small"
                    color={
                      model.category === 'flagship' ? 'primary' :
                      model.category === 'advanced' ? 'secondary' :
                      'default'
                    }
                  />
                </TableCell>
                <TableCell align="right">{model.cost_credits}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{model.adapter_class}</TableCell>
                <TableCell align="right">{model.sort_order}</TableCell>
                <TableCell>
                  <Chip
                    label={model.enabled ? '启用' : '已下架'}
                    color={model.enabled ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEditDialog(model)} title="编辑">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {model.enabled === 1 && (
                    <IconButton size="small" color="error" onClick={() => handleDisable(model.id)} title="下架">
                      <DeleteForeverIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 新增/编辑 Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '编辑AI模型' : '新增AI模型'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="模型ID"
            value={form.id}
            onChange={(e) => updateForm('id', e.target.value)}
            disabled={!!editingId}
            fullWidth
            size="small"
          />
          <TextField
            label="模型名称"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="模型类型"
            select
            value={form.type}
            onChange={(e) => updateForm('type', e.target.value)}
            fullWidth
            size="small"
          >
            {MODEL_TYPES.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="模型定位"
            select
            value={form.category}
            onChange={(e) => updateForm('category', e.target.value)}
            fullWidth
            size="small"
          >
            {MODEL_CATEGORIES.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="单次消耗积分"
            type="number"
            value={form.cost_credits}
            onChange={(e) => updateForm('cost_credits', e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="适配器类名"
            value={form.adapter_class}
            onChange={(e) => updateForm('adapter_class', e.target.value)}
            fullWidth
            size="small"
            placeholder="如 FluxAdapter"
          />
          <TextField
            label="配置JSON"
            value={form.config}
            onChange={(e) => updateForm('config', e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={3}
            placeholder='{"defaultWidth": 1024}'
          />
          <TextField
            label="时长选项(JSON数组)"
            value={form.duration_options}
            onChange={(e) => updateForm('duration_options', e.target.value)}
            fullWidth
            size="small"
            placeholder='[5,10,15]'
            helperText="仅视频模型需要，如 [5,10,15]"
          />
          <TextField
            label="时长定价(JSON对象)"
            value={form.duration_pricing}
            onChange={(e) => updateForm('duration_pricing', e.target.value)}
            fullWidth
            size="small"
            placeholder='{"5":15,"10":25,"15":35}'
            helperText="仅视频模型需要，键为秒数，值为积分"
          />
          <TextField
            label="分辨率选项(JSON数组)"
            value={form.resolution_options}
            onChange={(e) => updateForm('resolution_options', e.target.value)}
            fullWidth
            size="small"
            placeholder='["720p","1080p"]'
            helperText="仅视频模型需要，如 [&quot;720p&quot;,&quot;1080p&quot;]"
          />
          <TextField
            label="分辨率附加定价(JSON对象)"
            value={form.resolution_pricing}
            onChange={(e) => updateForm('resolution_pricing', e.target.value)}
            fullWidth
            size="small"
            placeholder='{"720p":0,"1080p":5}'
            helperText="仅视频模型，叠加在时长定价之上，如 {&quot;720p&quot;:0,&quot;1080p&quot;:5}"
          />
          <TextField
            label="排序权重"
            type="number"
            value={form.sort_order}
            onChange={(e) => updateForm('sort_order', e.target.value)}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={
              <Switch checked={form.enabled} onChange={(e) => updateForm('enabled', e.target.checked)} />
            }
            label="启用"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>
            {editingId ? '保存' : '创建'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

// ============================================================
// AdminPage 主页面
// ============================================================

export default function AdminPage() {
  const [tabValue, setTabValue] = useState(0);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        管理后台
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="积分套餐管理" />
          <Tab label="AI模型管理" />
          <Tab label="用户管理" />
          <Tab label="操作日志" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <PackageManager />
      </TabPanel>
      <TabPanel value={tabValue} index={1}>
        <ModelManager />
      </TabPanel>
      <TabPanel value={tabValue} index={2}>
        <UserListTab />
      </TabPanel>
      <TabPanel value={tabValue} index={3}>
        <OperationLogTab />
      </TabPanel>
    </Box>
  );
}
