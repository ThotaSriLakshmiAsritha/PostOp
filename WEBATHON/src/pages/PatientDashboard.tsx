import { Routes, Route, Navigate } from 'react-router-dom';
import PatientLayout from '../components/PatientLayout';
import PatientHome from '../components/patient/PatientHome';
import SymptomLogging from '../components/patient/SymptomLogging';
import TrendsDashboard from '../components/patient/TrendsDashboard';
import RemindersPage from '../components/patient/RemindersPage';
import ChatPage from '../components/patient/ChatPage';
import SymptomLogsViewerPatient from '../components/patient/SymptomLogsViewerPatient';
import PatientSettings from '../components/patient/PatientSettings';
import AppointmentRequestsPage from '../components/patient/AppointmentRequestsPage';

const PatientDashboard = () => {
  return (
    <PatientLayout>
      <Routes>
        <Route path="/" element={<PatientHome />} />
        <Route path="/log" element={<SymptomLogging />} />
        <Route path="/logs" element={<SymptomLogsViewerPatient />} />
        <Route path="/trends" element={<TrendsDashboard />} />
        <Route path="/reminders" element={<RemindersPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/settings" element={<PatientSettings />} />
        <Route path="/appointments" element={<AppointmentRequestsPage />} />
        <Route path="*" element={<Navigate to="/patient" />} />
      </Routes>
    </PatientLayout>
  );
};

export default PatientDashboard;
