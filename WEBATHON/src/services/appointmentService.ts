import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type AppointmentStatus = 'pending' | 'accepted' | 'rejected';
export type AppointmentRequestedBy = 'patient' | 'doctor';

export interface AppointmentRequest {
  id: string;
  patientId: string;
  doctorId: string;
  requestedBy: AppointmentRequestedBy;
  status: AppointmentStatus;
  proposedAt: string;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
}

const toTime = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const toGoogleDate = (date: Date) =>
  `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

export const buildGoogleCalendarUrl = (input: {
  title: string;
  startAt: string;
  details?: string;
}) => {
  const startDate = new Date(input.startAt);
  const safeStart = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
  const endDate = new Date(safeStart);
  endDate.setHours(endDate.getHours() + 1);

  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(input.title)}` +
    `&dates=${toGoogleDate(safeStart)}/${toGoogleDate(endDate)}` +
    `&details=${encodeURIComponent(input.details || '')}`
  );
};

export const createAppointmentRequest = async (input: {
  patientId: string;
  doctorId: string;
  requestedBy: AppointmentRequestedBy;
  proposedAt: string;
  note?: string;
}) => {
  const ref = doc(collection(db, 'appointment_requests'));
  await setDoc(ref, {
    patientId: input.patientId,
    doctorId: input.doctorId,
    requestedBy: input.requestedBy,
    status: 'pending',
    proposedAt: input.proposedAt,
    note: input.note || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const subscribePatientAppointments = (
  patientId: string,
  onData: (rows: AppointmentRequest[]) => void,
  onError: (error: unknown) => void
) => {
  const q = query(collection(db, 'appointment_requests'), where('patientId', '==', patientId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AppointmentRequest[];
      rows.sort((a, b) => {
        const ta = Date.parse(a.proposedAt || '') || 0;
        const tb = Date.parse(b.proposedAt || '') || 0;
        return tb - ta;
      });
      onData(rows);
    },
    onError
  );
};

export const subscribeDoctorAppointments = (
  doctorId: string,
  onData: (rows: AppointmentRequest[]) => void,
  onError: (error: unknown) => void
) => {
  const q = query(collection(db, 'appointment_requests'), where('doctorId', '==', doctorId));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AppointmentRequest[];
      rows.sort((a, b) => {
        const ta = Date.parse(a.proposedAt || '') || 0;
        const tb = Date.parse(b.proposedAt || '') || 0;
        return tb - ta;
      });
      onData(rows);
    },
    onError
  );
};

const upsertAppointmentReminders = async (requestId: string, appointment: AppointmentRequest) => {
  const proposedDate = new Date(appointment.proposedAt);
  const dayLabel = Number.isNaN(proposedDate.getTime())
    ? 'Scheduled appointment'
    : proposedDate.toLocaleString();

  const patientCalendarUrl = buildGoogleCalendarUrl({
    title: 'Doctor Appointment',
    startAt: appointment.proposedAt,
    details: appointment.note || '',
  });
  const doctorCalendarUrl = buildGoogleCalendarUrl({
    title: 'Patient Appointment',
    startAt: appointment.proposedAt,
    details: appointment.note || '',
  });

  await setDoc(
    doc(db, 'reminders', `appointment_${requestId}_patient`),
    {
      ownerId: appointment.patientId,
      ownerRole: 'patient',
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      type: 'appointment',
      title: 'Doctor Appointment',
      time: Number.isNaN(proposedDate.getTime()) ? '09:00' : toTime(proposedDate),
      repeat: 'custom',
      enabled: true,
      appointmentRequestId: requestId,
      scheduledAt: appointment.proposedAt,
      note: appointment.note || '',
      message: `Appointment confirmed for ${dayLabel}`,
      googleCalendarUrl: patientCalendarUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await setDoc(
    doc(db, 'reminders', `appointment_${requestId}_doctor`),
    {
      ownerId: appointment.doctorId,
      ownerRole: 'doctor',
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      type: 'appointment',
      title: 'Patient Appointment',
      time: Number.isNaN(proposedDate.getTime()) ? '09:00' : toTime(proposedDate),
      repeat: 'custom',
      enabled: true,
      appointmentRequestId: requestId,
      scheduledAt: appointment.proposedAt,
      note: appointment.note || '',
      message: `Appointment confirmed for ${dayLabel}`,
      googleCalendarUrl: doctorCalendarUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const respondToAppointmentRequest = async (input: {
  requestId: string;
  status: Exclude<AppointmentStatus, 'pending'>;
}) => {
  const requestRef = doc(db, 'appointment_requests', input.requestId);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) {
    throw new Error('Appointment request not found');
  }
  const appointment = { id: snap.id, ...snap.data() } as AppointmentRequest;

  await updateDoc(requestRef, {
    status: input.status,
    updatedAt: serverTimestamp(),
    respondedAt: serverTimestamp(),
  });

  if (input.status === 'accepted') {
    await upsertAppointmentReminders(input.requestId, appointment);
  }
};
