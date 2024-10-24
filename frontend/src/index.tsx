import React, { useContext, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { initializeIcons } from '@fluentui/react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';

import Chat from './pages/chat/Chat';
import Layout from './pages/layout/Layout';
import NoPage from './pages/NoPage';
import { AppStateContext, AppStateProvider } from './state/AppProvider';
import Auth from './pages/auth/Auth';

import './index.css';

initializeIcons();

function PrivateRoute({ children }: { children: JSX.Element }) {
    const context = useContext(AppStateContext);

    if (!context) {
        throw new Error('AppStateContext must be used within AppStateProvider');
    }

    const { state } = context;
    return state.isAuthenticated ? children : <Navigate to="/auth" />;
}

export default function App() {
    const appStateContext = useContext(AppStateContext);
    const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
    useEffect(() => {
        if (appStateContext?.state.frontendSettings?.b2c) {
            try {
                const b2c = appStateContext.state.frontendSettings.b2c;

                console.log("B2C Config:", b2c); // Verificar si los valores están correctos

                const msalConfig = {
                    auth: {
                        clientId: b2c.client_id,
                        authority: b2c.authority,
                        knownAuthorities: [b2c.known_authorities],
                        redirectUri: b2c.redirect_uri,
                    },
                    cache: {
                        cacheLocation: 'localStorage',
                        storeAuthStateInCookie: false,
                    },
                };

                setMsalInstance(new PublicClientApplication(msalConfig));
            } catch (error) {
                console.error("Error initializing MSAL instance:", error);
            }
        }
    }, [appStateContext]);


    useEffect(() => {
        if (msalInstance) {
            const callbackId = msalInstance.addEventCallback((event) => {
                if (event.eventType === 'msal:loginFailure' || event.error) {
                    console.error("MSAL login failed:", event.error);
                }

                if (event.eventType === 'msal:acquireTokenFailure') {
                    console.error("MSAL token acquisition failed:", event.error);
                }

                if (event.eventType === 'msal:handleRedirectEnd') {
                    console.log("Redirect completed");
                }
            });

            // Cleanup el callback cuando el componente se desmonte
            return () => {
                if (callbackId) {
                    msalInstance.removeEventCallback(callbackId);
                }
            };
        }
    }, [msalInstance]);

    if (!msalInstance) {
        // Espera hasta que MSAL esté inicializado
        return <div>Loading...</div>;
    }

    return (
        <MsalProvider instance={msalInstance}>
            <AppStateProvider>
                <HashRouter>
                    <Routes>
                        {/* Ruta para la autenticación */}
                        <Route path="/auth" element={<Auth />} />

                        {/* Redirección por defecto a /auth si no está autenticado */}
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

                        {/* Si el usuario accede a cualquier otra ruta, lo redirige a /auth */}
                        <Route path="*" element={<Navigate to="/auth" />} />
                    </Routes>
                </HashRouter>
            </AppStateProvider>
        </MsalProvider>
    );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
