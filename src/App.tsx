import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
import type { AuthenticationResult, EventMessage } from '@azure/msal-browser';
import { msalConfig } from './config/authConfig';
import { UserProvider } from './context/UserContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import Home from './pages/Home';
import Users from './pages/admin/Users';
import Settings from './pages/admin/Settings';
import Modules from './pages/admin/Modules';
import Menu from './pages/admin/Menu';
import Pages from './pages/admin/Pages';
import Dashboards from './pages/admin/Dashboards';
import BasicPages from './pages/admin/BasicPages';
import BasicPageEdit from './pages/admin/BasicPageEdit';
import DashboardView from './pages/DashboardView';
import BasicPageView from './pages/BasicPageView';
import RecordsList from './pages/records/RecordsList';
import RecordEdit from './pages/records/RecordEdit';
import QuickAddForm from './pages/QuickAddForm';

const msalInstance = new PublicClientApplication(msalConfig);

// Handle redirect response
msalInstance.initialize().then(() => {
  // Handle redirect promise
  msalInstance.handleRedirectPromise()
    .then((response) => {
      if (response) {
        console.log('Login successful:', response);
        msalInstance.setActiveAccount(response.account);
      }
    })
    .catch((error) => {
      console.error('Redirect error:', error);
    });

  // Set active account if available
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  // Listen for sign-in events
  msalInstance.addEventCallback((event: EventMessage) => {
    console.log('MSAL Event:', event.eventType, event);
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      msalInstance.setActiveAccount(payload.account);
    }
  });
});

function AuthStatus() {
  const { accounts, inProgress } = useMsal();

  useEffect(() => {
    console.log('Auth status - accounts:', accounts, 'inProgress:', inProgress);
  }, [accounts, inProgress]);

  return null;
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => {
      setIsInitialized(true);
      console.log('MSAL initialized');
    });
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthStatus />
      <BrowserRouter>
        <AuthenticatedTemplate>
          <UserProvider>
            <ThemeProvider>
            <ToastProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="admin/modules" element={<Modules />} />
                <Route path="admin/menu" element={<Menu />} />
                <Route path="admin/pages" element={<Pages />} />
                <Route path="admin/dashboards" element={<Dashboards />} />
                <Route path="admin/basic-pages" element={<BasicPages />} />
                <Route path="admin/basic-pages/:id" element={<BasicPageEdit />} />
                <Route path="admin/users" element={<Users />} />
                <Route path="admin/settings" element={<Settings />} />
                <Route path="records/:moduleName" element={<RecordsList />} />
                <Route path="records/:moduleName/:id" element={<RecordEdit />} />
                <Route path="dashboard/:slug" element={<DashboardView />} />
                <Route path="page/:slug" element={<BasicPageView />} />
              </Route>
              <Route path="form/:slug" element={<QuickAddForm />} />
            </Routes>
            </ToastProvider>
            </ThemeProvider>
          </UserProvider>
        </AuthenticatedTemplate>
        <UnauthenticatedTemplate>
          <Routes>
            <Route path="form/:slug" element={<QuickAddForm />} />
            <Route path="dashboard/:slug" element={<DashboardView />} />
            <Route path="page/:slug" element={<BasicPageView />} />
            <Route path="*" element={<LoginPage />} />
          </Routes>
        </UnauthenticatedTemplate>
      </BrowserRouter>
    </MsalProvider>
  );
}

export default App;
