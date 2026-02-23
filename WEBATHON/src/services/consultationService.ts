import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ConsultationDoc {
  id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  meet_link: string;
  created_at?: any;
  last_used_at?: any;
}

/**
 * Generate a demo-safe Google Meet style URL:
 * https://meet.google.com/xxx-xxxx-xxx
 */
const GOOGLE_MEET_BASE = 'https://meet.google.com';
const MEET_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const MEET_LINK_REGEX = /^https:\/\/meet\.google\.com\/[a-z0-9-]+(?:[/?].*)?$/i;

export function generateMeetLink(seed?: string): string {
  const segment = (size: number) =>
    Array.from(
      { length: size },
      () => MEET_CHARS[Math.floor(Math.random() * MEET_CHARS.length)]
    ).join('');

  // Keep signature flexible for existing callsites.
  void seed;
  return `${GOOGLE_MEET_BASE}/${segment(3)}-${segment(4)}-${segment(3)}`;
}

const resolveDoctorMeetingLink = async (doctorId: string): Promise<string | null> => {
  const doctorDoc = await getDoc(doc(db, 'doctors', doctorId));
  if (doctorDoc.exists()) {
    const link = String((doctorDoc.data() as any)?.meetLink || '').trim();
    if (MEET_LINK_REGEX.test(link)) return link;
  }

  const doctorUserDoc = await getDoc(doc(db, 'users', doctorId));
  if (doctorUserDoc.exists()) {
    const link = String((doctorUserDoc.data() as any)?.meetLink || '').trim();
    if (MEET_LINK_REGEX.test(link)) return link;
  }

  return null;
};

const findPatientDoc = async (patient_id: string) => {
  // Expected primary path: patients/{patient_id}
  const byDocId = await getDoc(doc(db, 'patients', patient_id));
  if (byDocId.exists()) return byDocId;

  // Fallback for legacy storage where patient_id is a field.
  const byField = await getDocs(
    query(collection(db, 'patients'), where('patient_id', '==', patient_id), limit(1))
  );
  if (!byField.empty) return byField.docs[0];

  throw new Error(`Patient not found for id: ${patient_id}`);
};

/**
 * Idempotent get-or-create for doctor-patient consultation link.
 * Reuses an existing link if present, creates one otherwise.
 */
export async function getOrCreateConsultation(patient_id: string): Promise<string> {
  if (!patient_id) {
    throw new Error('patient_id is required');
  }

  const patientSnap = await findPatientDoc(patient_id);
  const patientData = patientSnap.data() as any;
  const doctor_id = String(patientData?.doctor_id || '').trim();
  const canonicalPatientId = String(patientData?.patient_id || patientSnap.id).trim();

  if (!doctor_id) {
    throw new Error(`doctor_id missing for patient: ${patient_id}`);
  }

  const consultation_id = `${doctor_id}_${canonicalPatientId}`;
  const consultationRef = doc(db, 'consultations', consultation_id);
  const consultationSnap = await getDoc(consultationRef);
  const doctorMeetLink = await resolveDoctorMeetingLink(doctor_id);

  // Doctor's configured Meet link is authoritative common room for this doctor.
  if (doctorMeetLink) {
    await setDoc(
      consultationRef,
      {
        consultation_id,
        patient_id: canonicalPatientId,
        doctor_id,
        meet_link: doctorMeetLink,
        created_at: consultationSnap.exists()
          ? (consultationSnap.data() as any)?.created_at || serverTimestamp()
          : serverTimestamp(),
        last_used_at: serverTimestamp(),
      },
      { merge: true }
    );
    return doctorMeetLink;
  }

  if (consultationSnap.exists()) {
    const current = consultationSnap.data() as any;
    const currentLink = String(current?.meet_link || '').trim();
    if (MEET_LINK_REGEX.test(currentLink)) return currentLink;

    throw new Error('Doctor meet link not configured. Please save a valid Meet link in Doctor Settings.');
  }

  throw new Error('Doctor meet link not configured. Please save a valid Meet link in Doctor Settings.');
}

/**
 * Start call flow:
 * 1) get or create persistent consultation link
 * 2) update last_used_at
 * 3) open in new tab
 */
export async function handleVideoCall(patient_id: string): Promise<string> {
  const meet_link = await getOrCreateConsultation(patient_id);

  const patientSnap = await findPatientDoc(patient_id);
  const patientData = patientSnap.data() as any;
  const doctor_id = String(patientData?.doctor_id || '').trim();
  const canonicalPatientId = String(patientData?.patient_id || patientSnap.id).trim();
  const consultation_id = `${doctor_id}_${canonicalPatientId}`;
  const consultationRef = doc(db, 'consultations', consultation_id);

  await updateDoc(consultationRef, {
    last_used_at: serverTimestamp(),
  });

  window.open(meet_link, '_blank');
  return meet_link;
}

/**
 * Realtime consultations for doctor dashboard.
 */
export function subscribeDoctorConsultations(
  doctor_id: string,
  onData: (rows: ConsultationDoc[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const consultationsQuery = query(
    collection(db, 'consultations'),
    where('doctor_id', '==', doctor_id)
  );

  return onSnapshot(
    consultationsQuery,
    (snapshot) => {
      const rows = snapshot.docs
        .map((row) => ({ id: row.id, ...(row.data() as any) } as ConsultationDoc))
        .sort((a, b) => {
          const ta = a.last_used_at?.toDate ? a.last_used_at.toDate().getTime() : 0;
          const tb = b.last_used_at?.toDate ? b.last_used_at.toDate().getTime() : 0;
          return tb - ta;
        });
      onData(rows);
    },
    (err) => {
      if (onError) onError(err as Error);
    }
  );
}
