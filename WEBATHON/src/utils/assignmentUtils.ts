import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface AssignmentPair {
  patientDocId: string;
  patientId: string;
  patientUserId: string | null;
  doctorId: string;
  doctorUserId: string | null;
  doctorEmail: string | null;
  hospitalId: string | null;
}

const getFirstByField = async (
  collectionName: string,
  field: string,
  value: string
) => {
  const q = query(collection(db, collectionName), where(field, '==', value), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0];
};

type DocLike = {
  id: string;
  data: () => Record<string, any>;
};

const asDocLike = (id: string, data: Record<string, any>): DocLike => ({
  id,
  data: () => data,
});

const findPatientUserDocByIdentifier = async (patientIdentifier: string): Promise<DocLike | null> => {
  const byUserDocId = await getDoc(doc(db, 'users', patientIdentifier));
  if (byUserDocId.exists()) {
    const data = byUserDocId.data() as Record<string, any>;
    if (String(data?.role || '').toLowerCase() === 'patient') {
      return asDocLike(byUserDocId.id, data);
    }
  }

  const byUid = await getFirstByField('users', 'uid', patientIdentifier);
  if (byUid) {
    const data = byUid.data() as Record<string, any>;
    if (String(data?.role || '').toLowerCase() === 'patient') {
      return asDocLike(byUid.id, data);
    }
  }

  return null;
};

const findPatientDocByIdentifier = async (patientIdentifier: string) => {
  const byDocId = await getDoc(doc(db, 'patients', patientIdentifier));
  if (byDocId.exists()) return byDocId;

  const byUserId = await getFirstByField('patients', 'userId', patientIdentifier);
  if (byUserId) return byUserId;

  const byPatientId = await getFirstByField('patients', 'patient_id', patientIdentifier);
  if (byPatientId) return byPatientId;

  // Fallback for deployments where patient profile is only stored in users collection.
  const userPatientDoc = await findPatientUserDocByIdentifier(patientIdentifier);
  if (userPatientDoc) return userPatientDoc;

  return null;
};

const resolveDoctorUserId = async (
  doctorId: string | null,
  doctorEmail: string | null
): Promise<string | null> => {
  if (doctorId) {
    const directUser = await getDoc(doc(db, 'users', doctorId));
    if (directUser.exists()) return doctorId;

    const doctorDoc = await getDoc(doc(db, 'doctors', doctorId));
    if (doctorDoc.exists()) {
      const data = doctorDoc.data() as any;
      if (data?.user_id) return String(data.user_id);
      if (!doctorEmail && data?.email) {
        doctorEmail = String(data.email);
      }
    }
  }

  if (doctorEmail) {
    const byEmail = await getFirstByField('users', 'email', doctorEmail);
    if (byEmail) return byEmail.id;
  }

  return null;
};

const resolvePatientUserId = async (
  patientData: any,
  patientIdentifier: string
): Promise<string | null> => {
  if (patientData?.userId) return String(patientData.userId);
  if (patientData?.uid) return String(patientData.uid);

  const identifierUser = await getDoc(doc(db, 'users', patientIdentifier));
  if (identifierUser.exists()) {
    return patientIdentifier;
  }

  if (patientData?.patient_id) {
    const patientIdUser = await getDoc(doc(db, 'users', String(patientData.patient_id)));
    if (patientIdUser.exists()) return String(patientData.patient_id);
  }

  return null;
};

export async function resolvePairForPatientUser(
  patientUserId: string
): Promise<AssignmentPair | null> {
  const patientDoc = await findPatientDocByIdentifier(patientUserId);
  if (!patientDoc) return null;

  const data = patientDoc.data() as any;
  const doctorId = String(data?.doctor_id || data?.doctorId || data?.assignedDoctorId || '');
  const doctorEmail = data?.doctor_email ? String(data.doctor_email) : null;
  if (!doctorId && !doctorEmail) return null;

  const doctorUserId = await resolveDoctorUserId(doctorId || null, doctorEmail);
  if (!doctorUserId) return null;

  const resolvedPatientUserId = await resolvePatientUserId(data, patientUserId);
  if (resolvedPatientUserId && resolvedPatientUserId !== patientUserId) return null;

  return {
    patientDocId: patientDoc.id,
    patientId: String(data?.patient_id || patientDoc.id),
    patientUserId: resolvedPatientUserId || patientUserId,
    doctorId: doctorId || doctorUserId,
    doctorUserId,
    doctorEmail,
    hospitalId: data?.hospital_id ? String(data.hospital_id) : null,
  };
}

export async function resolvePairForDoctorAndPatient(
  doctorUserId: string,
  patientIdentifier: string
): Promise<AssignmentPair | null> {
  const patientDoc = await findPatientDocByIdentifier(patientIdentifier);
  if (!patientDoc) return null;

  const data = patientDoc.data() as any;
  const doctorId = String(data?.doctor_id || data?.doctorId || data?.assignedDoctorId || '');
  const doctorEmail = data?.doctor_email ? String(data.doctor_email) : null;
  if (!doctorId && !doctorEmail) return null;

  const assignedDoctorUserId = await resolveDoctorUserId(doctorId || null, doctorEmail);
  if (!assignedDoctorUserId || assignedDoctorUserId !== doctorUserId) return null;

  const patientUserId = await resolvePatientUserId(data, patientIdentifier);

  return {
    patientDocId: patientDoc.id,
    patientId: String(data?.patient_id || patientDoc.id),
    patientUserId,
    doctorId: doctorId || assignedDoctorUserId,
    doctorUserId: assignedDoctorUserId,
    doctorEmail,
    hospitalId: data?.hospital_id ? String(data.hospital_id) : null,
  };
}
