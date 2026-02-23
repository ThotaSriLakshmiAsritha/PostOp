export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export type UserRole = 'patient' | 'doctor';

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
}

export interface SymptomLog {
  id?: string;
  patientId: string;
  pain_score: number;
  temperature: number;
  redness_level: 'none' | 'mild' | 'moderate' | 'severe';
  swelling_level: 'none' | 'mild' | 'moderate' | 'severe';
  discharge: boolean;
  mobility_level: 'excellent' | 'good' | 'limited' | 'poor';
  sleep_hours: number;
  appetite: 'excellent' | 'good' | 'poor' | 'none';
  fatigue: 'none' | 'mild' | 'moderate' | 'severe';
  mood: 'excellent' | 'good' | 'moderate' | 'poor';
  antibiotics_taken: boolean;
  pain_meds_taken: boolean;
  dressing_changed: boolean;
  risk?: RiskLevel;
  createdAt?: any;
}

export interface Alert {
  id: string;
  patientId: string;
  type: string;
  message: string;
  risk: RiskLevel;
  acknowledged: boolean;
  createdAt: any;
  acknowledgedAt?: any;
  note?: string;
}

export interface Reminder {
  id: string;
  patientId: string;
  title: string;
  time: string;
  repeat: 'daily' | 'custom';
  enabled: boolean;
  type: 'antibiotic' | 'pain_med' | 'dressing' | 'logging' | 'custom';
  createdAt?: any;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  participants: string[];
  createdAt: any;
}
