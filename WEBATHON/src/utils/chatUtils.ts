import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Deterministic room id for a doctor-patient assignment
export function getAssignedRoomId(doctorId: string, patientId: string) {
  return `doctor_${doctorId}_patient_${patientId}`;
}

// Ensure a room exists for a validated doctor-patient assignment
export async function ensureAssignedChatRoom(
  doctorId: string,
  patientId: string,
  participants: string[]
) {
  const roomId = getAssignedRoomId(doctorId, patientId);
  const roomRef = doc(db, 'chatRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) {
    await setDoc(roomRef, {
      doctor_id: doctorId,
      patient_id: patientId,
      participants: participants.sort(),
      createdAt: serverTimestamp(),
    });
  }
  return roomId;
}

export async function getOrCreateRoomMeetingLink(roomId: string): Promise<string> {
  const roomRef = doc(db, 'chatRooms', roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) {
    throw new Error(`Chat room not found: ${roomId}`);
  }

  const current = roomSnap.data() as any;
  // Prefer doctor's configured common Meet room if available.
  let meetLink = '';
  const doctorId = String(current?.doctor_id || '').trim();
  if (doctorId) {
    const doctorDoc = await getDoc(doc(db, 'doctors', doctorId));
    if (doctorDoc.exists()) {
      meetLink = String((doctorDoc.data() as any)?.meetLink || '').trim();
    }
    if (!meetLink) {
      const doctorUserDoc = await getDoc(doc(db, 'users', doctorId));
      if (doctorUserDoc.exists()) {
        meetLink = String((doctorUserDoc.data() as any)?.meetLink || '').trim();
      }
    }
  }
  if (!meetLink) {
    if (current?.meetLink) {
      meetLink = String(current.meetLink);
    }
  }

  if (!meetLink) {
    throw new Error('Doctor meet link not configured. Please set it in Doctor Settings.');
  }

  await setDoc(
    roomRef,
    {
      meetLink,
      meetLinkUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return meetLink;
}
