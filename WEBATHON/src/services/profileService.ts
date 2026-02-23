import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

interface DoctorLike {
  id: string;
  name?: string;
  email?: string;
  hospital_id?: string;
  surgery_type?: string;
}

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();

const findDoctorByHospitalAndSurgery = async (
  hospital_id: string,
  surgery_type: string
): Promise<DoctorLike | null> => {
  const targetHospital = normalize(hospital_id);
  const targetSurgery = normalize(surgery_type);

  const doctorsSnap = await getDocs(query(collection(db, 'doctors'), limit(500)));
  const doctors = doctorsSnap.docs.map((doctorDoc) => {
    const data: any = doctorDoc.data();
    return {
      id: doctorDoc.id,
      name: data?.name,
      email: data?.email,
      hospital_id: data?.hospital_id || data?.hospitalId,
      surgery_type: data?.surgery_type || data?.surgeryType,
    } as DoctorLike;
  });

  const mapped = doctors.find(
    (d) => normalize(d.hospital_id) === targetHospital && normalize(d.surgery_type) === targetSurgery
  );
  return mapped || null;
};

export const upsertDoctorProfile = async (input: {
  uid: string;
  name: string;
  email: string;
  hospital_id: string;
  surgery_type: string;
  meetLink?: string;
  phone?: string;
  specialization?: string;
}) => {
  const payload = {
    name: input.name,
    email: input.email,
    hospital_id: input.hospital_id,
    surgery_type: input.surgery_type,
    meetLink: input.meetLink || '',
    phone: input.phone || '',
    specialization: input.specialization || '',
    profile_completed: true,
    updated_at: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', input.uid), payload, { merge: true });
  await setDoc(
    doc(db, 'doctors', input.uid),
    {
      ...payload,
      user_id: input.uid,
      created_at: serverTimestamp(),
    },
    { merge: true }
  );
};

export const upsertPatientProfile = async (input: {
  uid: string;
  name: string;
  email: string;
  hospital_id: string;
  surgery_type: string;
  phone?: string;
  emergency_contact?: string;
}) => {
  const mappedDoctor = await findDoctorByHospitalAndSurgery(input.hospital_id, input.surgery_type);

  const userPayload = {
    name: input.name,
    email: input.email,
    hospital_id: input.hospital_id,
    surgery_type: input.surgery_type,
    phone: input.phone || '',
    emergency_contact: input.emergency_contact || '',
    doctor_id: mappedDoctor?.id || null,
    doctor_email: mappedDoctor?.email || null,
    profile_completed: true,
    updated_at: serverTimestamp(),
  };

  await setDoc(doc(db, 'users', input.uid), userPayload, { merge: true });
  await setDoc(
    doc(db, 'patients', input.uid),
    {
      patient_id: input.uid,
      userId: input.uid,
      ...userPayload,
      created_at: serverTimestamp(),
      latest_risk: 'NORMAL',
      latest_confidence: 0,
    },
    { merge: true }
  );

  return mappedDoctor;
};

