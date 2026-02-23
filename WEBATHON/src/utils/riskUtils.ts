import { ChipProps } from '@mui/material';

export const getRiskColor = (risk: 'GREEN' | 'YELLOW' | 'RED'): ChipProps['color'] => {
  switch (risk) {
    case 'GREEN':
      return 'success';
    case 'YELLOW':
      return 'warning';
    case 'RED':
      return 'error';
    default:
      return 'default';
  }
};

export const getRiskLabel = (risk: 'GREEN' | 'YELLOW' | 'RED'): string => {
  return risk;
};
