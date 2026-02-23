import { useEffect, useState } from 'react';
import {
  subscribeDoctorConsultations,
  type ConsultationDoc,
} from '../services/consultationService';

export function useDoctorConsultations(doctor_id?: string | null) {
  const [consultations, setConsultations] = useState<ConsultationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctor_id) {
      setConsultations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeDoctorConsultations(
      doctor_id,
      (rows) => {
        setConsultations(rows);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load doctor consultations:', err);
        setError('Failed to load consultations');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [doctor_id]);

  return { consultations, loading, error };
}

