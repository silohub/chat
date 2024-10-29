import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppStateContext } from "../../state/AppProvider";
import './auth.css';
import headerLogo from "../../assets/Logo-ExpoCTT-joven.svg";
import styles from "../chat/Chat.module.css";

const Auth: React.FC = () => {
    const appStateContext = useContext(AppStateContext);
    const navigate = useNavigate();
    const [logo, setLogo] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(true); // Estado para manejar autenticación

    if (!appStateContext) {
        return <div className="auth-loading">Loading...</div>;
    }

    const { state, login, logout } = appStateContext;

    useEffect(() => {
        if (!appStateContext?.state.isLoading) {
            setLogo(headerLogo);
        }
    }, [appStateContext?.state.isLoading]);

    // Redirección automática después del inicio de sesión exitoso
    useEffect(() => {
        if (state.isAuthenticated) {
            setIsAuthenticating(false);
            navigate("/");  // Redirige una vez autenticado
        } else {
            setIsAuthenticating(true); // Muestra la pantalla solo si aún no está autenticado
        }
    }, [state.isAuthenticated, navigate]);

    // Condición para evitar mostrar el componente Auth mientras autentica
    if (isAuthenticating && state.isAuthenticated) {
        return <div className="auth-loading">Autenticando...</div>;
    }

    return (
        <div className="auth-container">
            {!state.isAuthenticated ? (
                <div className="auth-box">
                    <div className="imageContainer">
                        <img src={logo} className="loginIcon" aria-hidden="true"/>
                    </div>
                    <p className="auth-message">Ingresa para poder iniciar un chat</p>
                    <button className="auth-button" onClick={login}>Ingresar</button>
                </div>
            ) : (
                <div className="auth-box">
                    <h2>Welcome!</h2>
                    <p className="auth-message">You are successfully logged in.</p>
                    <button className="auth-button" onClick={logout}>Sign Out</button>
                </div>
            )}
        </div>
    );
};

export default Auth;
