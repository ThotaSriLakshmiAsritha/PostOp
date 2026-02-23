import { Routes, Route, Navigate } from 'react-router-dom';
import DoctorLayout from '../components/DoctorLayout';
import DoctorHome from '../components/doctor/DoctorHome';
import PatientList from '../components/doctor/PatientList';
import PatientDetail from '../components/doctor/PatientDetail';
import DoctorChatPage from '../components/doctor/DoctorChatPage';
import DoctorSettings from '../components/doctor/DoctorSettings';
import SymptomLogsViewer from '../components/doctor/SymptomLogsViewer';
import PatientRegistrationForm from '../components/doctor/PatientRegistrationForm';
import AppointmentRequestsPage from '../components/doctor/AppointmentRequestsPage';
import DoctorRemindersPage from '../components/doctor/DoctorRemindersPage';

const DoctorDashboard = () => {
  return (
    <DoctorLayout>
      <Routes>
        <Route path="/" element={<DoctorHome />} />
        <Route path="/patients" element={<PatientList />} />
        <Route path="/patients/register" element={<PatientRegistrationForm />} />
        <Route path="/patients/:patientId" element={<PatientDetail />} />
        <Route path="/chat/:patientId" element={<DoctorChatPage />} />
        <Route path="/settings" element={<DoctorSettings />} />
        <Route path="/logs" element={<SymptomLogsViewer />} />
        <Route path="/appointments" element={<AppointmentRequestsPage />} />
        <Route path="/reminders" element={<DoctorRemindersPage />} />
        <Route path="*" element={<Navigate to="/doctor" />} />
      </Routes>
    </DoctorLayout>
  );
};

export default DoctorDashboard;
