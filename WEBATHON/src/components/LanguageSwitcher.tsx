import { MenuItem, Select, FormControl } from '@mui/material';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const selectedLanguage = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];

  const handleLanguageChange = (event: any) => {
    i18n.changeLanguage(event.target.value);
  };

  return (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <Select
        value={selectedLanguage}
        onChange={handleLanguageChange}
        sx={{ color: 'white' }}
      >
        <MenuItem value="en">{i18n.t('langEnglish', 'English')}</MenuItem>
        <MenuItem value="hi">{i18n.t('langHindi', '\u0939\u093f\u0902\u0926\u0940')}</MenuItem>
        <MenuItem value="te">{i18n.t('langTelugu', '\u0c24\u0c46\u0c32\u0c41\u0c17\u0c41')}</MenuItem>
      </Select>
    </FormControl>
  );
};

export default LanguageSwitcher;

