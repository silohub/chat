import React, { useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { initializeIcons } from '@fluentui/react';

import Chat from './pages/chat/Chat';
import Layout from './pages/layout/Layout';
import NoPage from './pages/NoPage';
import { AppStateContext, AppStateProvider } from './state/AppProvider';
import Auth from './pages/auth/Auth';
import './index.css';

initializeIcons();

// Componente para manejar rutas privadas
function PrivateRoute({ children }: { children: JSX.Element }) {
    const appStateContext = useContext(AppStateContext);

    // Si el contexto no está disponible, renderizamos un mensaje de error
    if (!appStateContext) {
        return <div>Error: AppStateContext not available</div>;
    }

    // Si está autenticado, renderiza el componente hijo; de lo contrario, redirige a /auth
    return appStateContext.state.isAuthenticated ? children : <Navigate to="/auth" />;
}

// Componente principal de rutas de la aplicación
function AppRoutes() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <Layout />
                        </PrivateRoute>
                    }
                >
                    <Route index element={<Chat />} />
                    <Route path="*" element={<NoPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/auth" />} />
            </Routes>
        </HashRouter>
    );
}

// Renderizado principal
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <AppStateProvider>
            <AppRoutes />
        </AppStateProvider>
    </React.StrictMode>
);
