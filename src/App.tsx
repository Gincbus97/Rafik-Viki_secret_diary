import { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import CharactersList from './pages/CharactersList';
import CharacterDetail from './pages/CharacterDetail';
import CharacterEdit from './pages/CharacterEdit';
import QuestsPage from './pages/QuestsPage';
import QuestDetail from './pages/QuestDetail';
import FactionsPage from './pages/FactionsPage';
import LocationsPage from './pages/LocationsPage';
import SessionsPage from './pages/SessionsPage';
import ProfilePage from './pages/ProfilePage';
import { BatSticker, MoonSticker, RoseSticker } from './components/Stickers';

function Protected({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-ash">
      <div className="flex gap-2">
        <BatSticker />
        <MoonSticker />
        <RoseSticker />
      </div>
      <p className="font-display text-xl">Открываем склеп...</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/characters" element={<CharactersList />} />
                <Route path="/characters/new" element={<CharacterEdit mode="new" />} />
                <Route path="/characters/:id" element={<CharacterDetail />} />
                <Route path="/characters/:id/edit" element={<CharacterEdit mode="edit" />} />
                <Route path="/quests" element={<QuestsPage />} />
                <Route path="/quests/:id" element={<QuestDetail />} />
                <Route path="/factions" element={<FactionsPage />} />
                <Route path="/locations" element={<LocationsPage />} />
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </Protected>
        }
      />
    </Routes>
  );
}
