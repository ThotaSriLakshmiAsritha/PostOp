import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const GOOGLE_MEET_BASE = 'https://meet.google.com';
const MEET_CHARS = 'abcdefghijklmnopqrstuvwxyz';

type RiskLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

interface PatientDoc {
  userId?: string;
  patient_id?: string;
  doctor_email?: string;
  doctor_id?: string;
  hospital_id?: string;
  name?: string;
}

/**
 * Create a demo Google Meet URL in this format:
 * https://meet.google.com/xxx-xxxx-xxx
 */
export function generateMeetLink(): string {
  const randomPart = (length: number): string =>
    Array.from(
      { length },
      () => MEET_CHARS[Math.floor(Math.random() * MEET_CHARS.length)]
    ).join('');

  const meetCode = `${randomPart(3)}-${randomPart(4)}-${randomPart(3)}`;
  return `${GOOGLE_MEET_BASE}/${meetCode}`;
}

const findPatientDoc = async (patientIdentifier: string) => {
  const byId = await getDoc(doc(db, 'patients', patientIdentifier));
  if (byId.exists()) return byId;

  const byUserId = query(
    collection(db, 'patients'),
    where('userId', '==', patientIdentifier),
    limit(1)
  );
  const byUserIdSnap = await getDocs(byUserId);
  if (!byUserIdSnap.empty) return byUserIdSnap.docs[0];

  const byPatientId = query(
    collection(db, 'patients'),
    where('patient_id', '==', patientIdentifier),
    limit(1)
  );
  const byPatientIdSnap = await getDocs(byPatientId);
  if (!byPatientIdSnap.empty) return byPatientIdSnap.docs[0];

  return null;
};

/**
 * Trigger consultation notification for elevated risk cases.
 * Flow:
 * 1) Skip when risk is NORMAL
 * 2) Resolve patient doc from Firestore (supports doc id / userId / patient_id)
 * 3) Build consultation message
 * 4) Write alert doc so it appears in patient notifications
 */
export async function handleStartConsultation(
  patient_id: string,
  risk: RiskLevel,
  confidence: number
): Promise<void> {
  try {
    if (!patient_id) {
      throw new Error('patient_id is required');
    }

    if (risk === 'NORMAL') {
      return;
    }

    if (risk !== 'WARNING' && risk !== 'CRITICAL') {
      throw new Error(`Invalid risk value: ${risk}`);
    }

    const patientSnap = await findPatientDoc(patient_id);

    if (!patientSnap || !patientSnap.exists()) {
      throw new Error(`Patient document not found: ${patient_id}`);
    }

    const patientData = patientSnap.data() as PatientDoc;
    const doctorEmail = patientData.doctor_email;
    const hospitalId = patientData.hospital_id;
    const patientUserId = patientData.userId || patientData.patient_id || patientSnap.id;
    const patientDisplayName = patientData.name || patient_id;

    if (!patientUserId) {
      throw new Error(`Unable to resolve patient user id for: ${patient_id}`);
    }
    if (!hospitalId) {
      throw new Error(`hospital_id is missing for patient: ${patient_id}`);
    }

    const confidencePercent = confidence <= 1 ? confidence * 100 : confidence;
    const meetLink = generateMeetLink();
    const message = [
      'Doctor requested an immediate consultation.',
      `Risk: ${risk}`,
      `Confidence: ${confidencePercent.toFixed(2)}%`,
      `Hospital ID: ${hospitalId}`,
      `Meeting link: ${meetLink}`,
      `Patient: ${patientDisplayName}`,
    ].join(' ');

    await addDoc(collection(db, 'alerts'), {
      patientId: patientUserId,
      patientDocId: patientSnap.id,
      message,
      risk: risk === 'CRITICAL' ? 'RED' : risk === 'WARNING' ? 'YELLOW' : 'GREEN',
      acknowledged: false,
      category: 'CONSULTATION',
      consultation: {
        risk,
        confidence: Number(confidencePercent.toFixed(2)),
        hospital_id: hospitalId,
        meet_link: meetLink,
        doctor_email: doctorEmail || null,
        doctor_id: patientData.doctor_id || null,
      },
      createdBy: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
      createdAtClient: Date.now(),
    });
  } catch (error) {
    console.error('Failed to start consultation:', error);
    throw error;
  }
}
