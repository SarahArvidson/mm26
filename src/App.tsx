import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import StudentBracketPage from './pages/StudentBracketPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import MasterBracketPage from './pages/MasterBracketPage';
import VideoLibraryPage from './pages/VideoLibraryPage';
import InstructionsPage from './pages/InstructionsPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LoginPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="student-bracket" element={<StudentBracketPage />} />
          <Route path="teacher-dashboard" element={<TeacherDashboardPage />} />
          <Route path="master-bracket" element={<MasterBracketPage />} />
          <Route path="video-library" element={<VideoLibraryPage />} />
          <Route path="instructions" element={<InstructionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App
