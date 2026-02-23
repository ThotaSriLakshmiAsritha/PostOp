import { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  List,
  ListItem,
  Avatar,
  IconButton,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import SendIcon from '@mui/icons-material/Send';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

import { ensureAssignedChatRoom, getOrCreateRoomMeetingLink } from '../../utils/chatUtils';
import { resolvePairForPatientUser } from '../../utils/assignmentUtils';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any;
}

const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resolve assignment pair and room. Patient can only chat with assigned doctor.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setPairError(null);
        const pair = await resolvePairForPatientUser(user.uid);
        if (!pair || !pair.doctorUserId) {
          setRoomId(null);
          setMeetLink(null);
          setPairError(
            t(
              'assignmentMissing',
              'No assigned doctor mapping found. Chat and video are available only for assigned doctor-patient pairs.'
            )
          );
          return;
        }

        const resolvedRoomId = await ensureAssignedChatRoom(
          pair.doctorId,
          pair.patientId,
          [user.uid, pair.doctorUserId]
        );
        setRoomId(resolvedRoomId);
        const roomMeetLink = await getOrCreateRoomMeetingLink(resolvedRoomId);
        setMeetLink(roomMeetLink);
      } catch (err) {
        console.error('Error loading meet link:', err);
        setPairError(t('loadChatFailed', 'Failed to load chat assignment.'));
        setRoomId(null);
      }
    })();
  }, [user, t]);

  // Subscribe to room messages only after assignment validation.
  useEffect(() => {
    if (!user || !roomId) return;
    let unsub: (() => void) | null = null;

    (async () => {
      try {
        const messagesRef = collection(db, `chatRooms/${roomId}/messages`);
        const q = query(messagesRef, orderBy('createdAt', 'asc'));
        unsub = onSnapshot(
          q,
          (snapshot) => {
            const msgs: Message[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              msgs.push({
                id: d.id,
                text: data.text,
                senderId: data.senderId,
                senderName: data.senderName || t('unknown', 'Unknown'),
                createdAt: data.createdAt,
              });
            });
            setMessages(msgs);
          },
          (err) => {
            console.error('Snapshot listener error for room messages:', err);
          }
        );
      } catch (err) {
        console.error('Error subscribing to room messages:', err);
      }
    })();

    return () => {
      try {
        if (unsub) unsub();
      } catch (e) {
        // noop
      }
    };
  }, [user, roomId, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !roomId) return;

    try {
      // optimistic UI
      const tempId = `local-${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        text: newMessage,
        senderId: user.uid,
        senderName: (user as any).name || (user as any).email || t('you', 'You'),
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, tempMsg]);

      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: newMessage,
        senderId: user.uid,
        senderName: (user as any).name || (user as any).email || t('unknown', 'Unknown'),
        createdAt: serverTimestamp(),
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleVideoCall = () => {
    if (meetLink) {
      window.open(meetLink, '_blank');
    } else {
      alert(
        t(
          'noMeetLink',
          'No video meeting link configured. Please ask your doctor to set a meeting link in their profile.'
        )
      );
    }
  };

  return (
    <Container maxWidth="md">
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">{t('chat')}</Typography>
        <Box display="flex" gap={1} alignItems="center">
          {meetLink ? (
            <Button variant="outlined" size="small" href={meetLink} target="_blank">
              {t('joinMeet', 'Join Meeting')}
            </Button>
          ) : (
            <Button variant="outlined" size="small" disabled>
              {t('noMeet', 'No link')}
            </Button>
          )}
          <Button variant="contained" startIcon={<VideoCallIcon />} onClick={handleVideoCall}>
            {t('startVideo', 'Start Video Call')}
          </Button>
        </Box>
      </Box>

      {pairError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {pairError}
        </Alert>
      )}

      <Paper sx={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <List>
            {messages.length === 0 ? (
              <ListItem>
                <Typography color="text.secondary">
                  {t('noMessages', 'No messages yet. Start the conversation!')}
                </Typography>
              </ListItem>
            ) : (
              messages.map((msg) => (
                <ListItem
                  key={msg.id}
                  sx={{ justifyContent: msg.senderId === user?.uid ? 'flex-end' : 'flex-start' }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: msg.senderId === user?.uid ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: 1,
                      maxWidth: '70%',
                    }}
                  >
                    <Avatar>{msg.senderName?.[0] ?? '?'}</Avatar>
                    <Box
                      sx={{
                        bgcolor: msg.senderId === user?.uid ? 'primary.main' : 'grey.300',
                        color: msg.senderId === user?.uid ? 'white' : 'black',
                        p: 1.5,
                        borderRadius: 2,
                      }}
                    >
                      <Typography variant="body1">{msg.text}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                      </Typography>
                    </Box>
                  </Box>
                </ListItem>
              ))
            )}
            <div ref={messagesEndRef} />
          </List>
        </Box>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box display="flex" gap={1}>
            <TextField
              fullWidth
              placeholder={t('typeMessage', 'Type a message...')}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <IconButton color="primary" onClick={handleSend} disabled={!newMessage.trim() || !roomId}>
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChatPage;
