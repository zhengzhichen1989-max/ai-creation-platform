import { Box, Card, CardContent, Typography, Avatar, Divider, Button } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import { useCurrentUser, useLogout } from '@/hooks/useAuth';

export default function ProfilePage() {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        个人中心
      </Typography>

      <Card sx={{ maxWidth: 480 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
            <PersonIcon sx={{ fontSize: 40 }} />
          </Avatar>

          <Typography variant="h6">{user?.nickname || '用户'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {user?.email}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ textAlign: 'left', px: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                用户ID
              </Typography>
              <Typography variant="body2">{user?.id}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                昵称
              </Typography>
              <Typography variant="body2">{user?.nickname}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                邮箱
              </Typography>
              <Typography variant="body2">{user?.email}</Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Button variant="outlined" color="error" onClick={logout} fullWidth>
            退出登录
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
