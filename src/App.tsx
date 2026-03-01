import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import StudentBracketPage from './pages/StudentBracketPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import MasterBracketPage from './pages/MasterBracketPage';
import VideoLibraryPage from './pages/VideoLibraryPage';
import InstructionsPage from './pages/InstructionsPage';
import SettingsPage from './pages/SettingsPage';
import EmbedBracketPage from './pages/EmbedBracketPage';
import PrintBracketPage from './pages/PrintBracketPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import LandingPage from './pages/LandingPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="accueil" element={<LandingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="student-bracket" element={<StudentBracketPage />} />
            <Route path="teacher-dashboard" element={<TeacherDashboardPage />} />
            <Route path="complete-profile" element={<CompleteProfilePage />} />
            <Route path="master-bracket" element={<MasterBracketPage />} />
            <Route path="video-library" element={<VideoLibraryPage />} />
            <Route path="instructions" element={<InstructionsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="embed/:seasonId" element={<EmbedBracketPage />} />
          <Route path="print/:seasonId" element={<PrintBracketPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App
