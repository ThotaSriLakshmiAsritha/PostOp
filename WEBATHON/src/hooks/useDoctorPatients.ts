import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface DoctorPatient {
  id: string;
  patient_id: string;
  userId?: string;
  name: string;
  hospital_id: string;
  doctor_id: string;
  doctor_email: string;
  surgery_type: string;
  created_at?: any;
  latest_risk?: 'NORMAL' | 'WARNING' | 'CRITICAL';
  latest_confidence?: number;
}

/**
 * Real-time patient list for a doctor.
 * Automatically updates when patients are added/changed.
 */
export function useDoctorPatients(doctor_id?: string | null, doctor_email?: string | null) {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctor_id && !doctor_email) {
      setPatients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const snapshotsByKey = new Map<string, DoctorPatient[]>();
    const unsubscribers: Array<() => void> = [];
    const normalizedDoctorId = String(doctor_id || '').trim();
    const normalizedDoctorEmail = String(doctor_email || '').trim().toLowerCase();

    const isAssignedToDoctor = (row: any) => {
      const doctorIds = [
        row?.doctor_id,
        row?.doctorId,
        row?.assignedDoctorId,
      ]
        .filter(Boolean)
        .map((v: unknown) => String(v).trim());

      const doctorEmails = [
        row?.doctor_email,
        row?.doctorEmail,
      ]
        .filter(Boolean)
        .map((v: unknown) => String(v).trim().toLowerCase());

      const matchesId = normalizedDoctorId
        ? doctorIds.some((id) => id === normalizedDoctorId)
        : false;
      const matchesEmail = normalizedDoctorEmail
        ? doctorEmails.some((email) => email === normalizedDoctorEmail)
        : false;

      return matchesId || matchesEmail;
    };

    const recompute = () => {
      const merged = new Map<string, DoctorPatient>();
      snapshotsByKey.forEach((rows) => {
        rows.forEach((row) => {
          if (isAssignedToDoctor(row)) {
            merged.set(row.id, row);
          }
        });
      });

      const next = Array.from(merged.values());
      // Client-side sort avoids composite index requirements.
      next.sort((a, b) => {
        const ta =
          a.created_at && typeof a.created_at.toDate === 'function'
            ? a.created_at.toDate().getTime()
            : 0;
        const tb =
          b.created_at && typeof b.created_at.toDate === 'function'
            ? b.created_at.toDate().getTime()
            : 0;
        return tb - ta;
      });

      setPatients(next);
      setLoading(false);
    };

    const addSubscription = (
      key: string,
      q: ReturnType<typeof query>,
      mapper?: (docData: Record<string, any>, docId: string) => DoctorPatient
    ) => {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const rows = snapshot.docs.map((patientDoc) => {
            const data = patientDoc.data() as Record<string, any>;
            if (mapper) return mapper(data, patientDoc.id);
            return {
              id: patientDoc.id,
              ...data,
            } as DoctorPatient;
          });
          snapshotsByKey.set(key, rows);
          recompute();
        },
        (err) => {
          console.error('Failed to subscribe doctor patients:', err);
          setError('Failed to load assigned patients');
          setLoading(false);
        }
      );
      unsubscribers.push(unsubscribe);
    };

    if (doctor_id) {
      addSubscription(
        'byDoctorId',
        query(collection(db, 'patients'), where('doctor_id', '==', doctor_id))
      );
    }

    if (doctor_email) {
      addSubscription(
        'byDoctorEmail',
        query(collection(db, 'patients'), where('doctor_email', '==', doctor_email))
      );
    }

    // Fallback for apps where patient records primarily live in users/{uid} with role="patient".
    addSubscription(
      'fromUsersCollection',
      query(collection(db, 'users'), where('role', '==', 'patient')),
      (data, docId) =>
        ({
          id: data.patient_id || data.uid || docId,
          patient_id: data.patient_id || data.uid || docId,
          userId: data.uid || docId,
          name: data.name || '',
          hospital_id: data.hospital_id || '',
          doctor_id: data.doctor_id || data.doctorId || data.assignedDoctorId || '',
          doctor_email: data.doctor_email || data.doctorEmail || '',
          surgery_type: data.surgery_type || data.surgeryType || data.doctor_specialization || '',
          created_at: data.created_at || data.createdAt || null,
          latest_risk:
            (String(data.latest_risk || data.current_risk || '').toUpperCase() === 'CRITICAL' ||
            String(data.latest_risk || data.current_risk || '').toUpperCase() === 'RED')
              ? 'CRITICAL'
              : (String(data.latest_risk || data.current_risk || '').toUpperCase() === 'WARNING' ||
                  String(data.latest_risk || data.current_risk || '').toUpperCase() === 'YELLOW')
                ? 'WARNING'
                : 'NORMAL',
          latest_confidence: Number(data.latest_confidence ?? data.confidence ?? 0),
        }) as DoctorPatient
    );

    // Fallback for legacy/mixed schemas (doctorId/assignedDoctorId/doctorEmail or case differences).
    addSubscription('fallbackAllPatients', query(collection(db, 'patients')));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [doctor_id, doctor_email]);

  return { patients, loading, error };
}
