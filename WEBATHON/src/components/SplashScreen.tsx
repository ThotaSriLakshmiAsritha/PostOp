import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const SplashScreen = () => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
      }}
    >
      <Typography variant="h4" component="h1">
        {t('appTitle', 'Post-Op Guardian')}
      </Typography>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        {t('loading', 'Loading...')}
      </Typography>
    </Box>
  );
};

export default SplashScreen;
