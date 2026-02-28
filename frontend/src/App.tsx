import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard } from './components/AuthGuard';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TaskListsPage } from './pages/TaskListsPage';
import { TaskListDetailPage } from './pages/TaskListDetailPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { AdminPage } from './pages/AdminPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/task-lists"
        element={
          <AuthGuard>
            <Layout>
              <TaskListsPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/task-lists/:id"
        element={
          <AuthGuard>
            <Layout>
              <TaskListDetailPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/templates"
        element={
          <AuthGuard>
            <Layout>
              <TemplatesPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/templates/:id"
        element={
          <AuthGuard>
            <Layout>
              <TemplateDetailPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route
        path="/admin"
        element={
          <AuthGuard>
            <Layout>
              <AdminPage />
            </Layout>
          </AuthGuard>
        }
      />
      <Route path="/" element={<Navigate to="/task-lists" replace />} />
      <Route path="*" element={<Navigate to="/task-lists" replace />} />
    </Routes>
  );
}
