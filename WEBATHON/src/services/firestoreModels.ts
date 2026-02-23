import { type Timestamp } from 'firebase/firestore';

/**
 * Firestore data model
 *
 * patients/{patient_id}
 * - patient_id
 * - name
 * - hospital_id
 * - doctor_id
 * - doctor_email
 * - surgery_type
 * - created_at
 *
 * doctors/{doctor_id}
 * - name
 * - hospital_id
 * - email
 */
export interface FirestorePatient {
  patient_id: string;
  userId?: string;
  email?: string;
  name: string;
  hospital_id: string;
  doctor_id: string;
  doctor_email: string;
  surgery_type: string;
  surgery_date?: string;
  surgeryDate?: Date | Timestamp | any;
  created_at: Timestamp | any;
  latest_risk?: 'NORMAL' | 'WARNING' | 'CRITICAL';
  latest_confidence?: number;
}

export interface FirestoreDoctor {
  name: string;
  hospital_id: string;
  email: string;
  surgery_type?: string;
  surgeryType?: string;
}

/**
 * consultations/{consultation_id}
 * consultation_id format: ${doctor_id}_${patient_id}
 */
export interface FirestoreConsultation {
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  meet_link: string;
  created_at: Timestamp | any;
  last_used_at: Timestamp | any;
}
