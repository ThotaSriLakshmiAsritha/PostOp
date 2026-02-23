import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth';
import { db } from '../config/firebase';
import { firebaseConfig } from '../config/firebaseConfig';
import type { FirestoreDoctor, FirestorePatient } from './firestoreModels';

export interface PatientRegistrationInput {
  email: string;
  password: string;
  name: string;
  hospital_id: string;
  doctor_id?: string;
  surgery_type: string;
  surgery_date: string;
}

export interface RegisteredPatientResult {
  patient_id: string;
  user_id: string;
  email: string;
  password: string;
}

/**
 * Register a patient and link them to a selected doctor.
 * Returns generated patient_id (Firestore doc id).
 */
export async function registerPatient(
  patientData: PatientRegistrationInput
): Promise<RegisteredPatientResult> {
  let secondaryApp: ReturnType<typeof initializeApp> | null = null;
  try {
    const email = patientData.email?.trim().toLowerCase();
    const password = patientData.password;
    const name = patientData.name?.trim();
    const hospital_id = patientData.hospital_id?.trim();
    const doctor_id = patientData.doctor_id?.trim();
    const surgery_type = patientData.surgery_type?.trim();
    const surgery_date = patientData.surgery_date?.trim();
    const surgeryDate = surgery_date ? new Date(`${surgery_date}T00:00:00`) : null;
    const normalizedHospitalId = (hospital_id || '').toLowerCase();
    const normalizedSurgeryType = (surgery_type || '').toLowerCase();

    if (!email || !password || !name || !hospital_id || !surgery_type || !surgery_date || !surgeryDate) {
      throw new Error('email, password, name, hospital_id, surgery_type, and surgery_date are required');
    }

    if (Number.isNaN(surgeryDate.getTime())) {
      throw new Error('Invalid surgery date');
    }

    if (password.length < 8) {
      throw new Error('Patient password must be at least 8 characters');
    }

    let selectedDoctorId = doctor_id || '';
    let doctor: Partial<FirestoreDoctor> | null = null;

    if (selectedDoctorId) {
      const doctorRef = doc(db, 'doctors', selectedDoctorId);
      const doctorSnap = await getDoc(doctorRef);
      if (doctorSnap.exists()) {
        doctor = doctorSnap.data() as Partial<FirestoreDoctor>;
      } else {
        // Allow selecting a doctor by user doc id when doctors collection is not populated.
        const doctorUserRef = doc(db, 'users', selectedDoctorId);
        const doctorUserSnap = await getDoc(doctorUserRef);
        if (!doctorUserSnap.exists()) {
          throw new Error(`Doctor not found for doctor_id: ${selectedDoctorId}`);
        }
        const userData = doctorUserSnap.data() as any;
        if (String(userData?.role || '').toLowerCase() !== 'doctor') {
          throw new Error(`Selected user is not a doctor: ${selectedDoctorId}`);
        }
        doctor = {
          name: userData?.name || '',
          email: userData?.email || '',
          hospital_id: userData?.hospital_id || userData?.hospitalId || '',
          surgery_type: userData?.surgery_type || userData?.surgeryType || '',
        };
      }
    } else {
      // Auto-assign doctor by surgery_type + hospital_id with tolerant matching.
      const doctorsSnap = await getDocs(query(collection(db, 'doctors'), limit(500)));
      const selectedDoctorDoc = doctorsSnap.docs.find((doctorDoc) => {
        const data = doctorDoc.data() as any;
        const candidateHospital = String(data?.hospital_id || data?.hospitalId || '').toLowerCase();
        const candidateSurgery = String(data?.surgery_type || data?.surgeryType || '').toLowerCase();
        return (
          candidateHospital === normalizedHospitalId &&
          candidateSurgery === normalizedSurgeryType
        );
      });

      if (selectedDoctorDoc) {
        selectedDoctorId = selectedDoctorDoc.id;
        doctor = selectedDoctorDoc.data() as Partial<FirestoreDoctor>;
      } else {
        // Fallback to doctors stored only in users collection.
        const doctorUsersSnap = await getDocs(
          query(collection(db, 'users'), where('role', '==', 'doctor'), limit(500))
        );
        const selectedDoctorUser = doctorUsersSnap.docs.find((userDoc) => {
          const data = userDoc.data() as any;
          const candidateHospital = String(data?.hospital_id || data?.hospitalId || '').toLowerCase();
          const candidateSurgery = String(data?.surgery_type || data?.surgeryType || '').toLowerCase();
          return (
            candidateHospital === normalizedHospitalId &&
            candidateSurgery === normalizedSurgeryType
          );
        });

        if (!selectedDoctorUser) {
          throw new Error(
            `No doctor available for surgery type "${surgery_type}" in hospital "${hospital_id}". Please set doctor hospital/surgery in Doctor Settings.`
          );
        }

        const userData = selectedDoctorUser.data() as any;
        selectedDoctorId = selectedDoctorUser.id;
        doctor = {
          name: userData?.name || '',
          email: userData?.email || '',
          hospital_id: userData?.hospital_id || userData?.hospitalId || '',
          surgery_type: userData?.surgery_type || userData?.surgeryType || '',
        };
      }
    }

    if (!doctor?.email) {
      throw new Error(`Doctor email missing for doctor_id: ${selectedDoctorId}`);
    }

    secondaryApp = initializeApp(firebaseConfig, `patient-registration-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    const patientUserId = userCredential.user.uid;

    await setDoc(doc(db, 'users', patientUserId), {
      email,
      role: 'patient',
      name,
      hospital_id,
      surgery_type,
      surgery_date,
      surgeryDate,
      doctor_id: selectedDoctorId,
      doctor_email: doctor.email,
      createdAt: new Date().toISOString(),
    });

    const patientRef = doc(collection(db, 'patients'));
    const patientRecord: FirestorePatient = {
      patient_id: patientRef.id,
      userId: patientUserId,
      email,
      name,
      hospital_id,
      doctor_id: selectedDoctorId,
      doctor_email: doctor.email,
      surgery_type,
      surgery_date,
      surgeryDate,
      created_at: serverTimestamp(),
      latest_risk: 'NORMAL',
      latest_confidence: 0,
    };

    await setDoc(patientRef, patientRecord);
    await signOut(secondaryAuth);

    return {
      patient_id: patientRef.id,
      user_id: patientUserId,
      email,
      password,
    };
  } catch (error) {
    console.error('Failed to register patient:', error);
    throw error;
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch {
        // no-op: app can already be deleted
      }
    }
  }
}
