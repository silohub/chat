// Auth.tsx
import React, { useContext } from 'react';
import {AppStateContext} from "../../state/AppProvider";

const Auth: React.FC = () => {
    const appStateContext = useContext(AppStateContext);

    if (!appStateContext) {
        return <div>Loading...</div>;
    }

    const { state, login, logout, resetPassword } = appStateContext;

    return (
        <div>
            {!state.isAuthenticated ? (
                <div>
                    <p>Welcome! Please sign in to view your profile.</p>
                    <button onClick={login}>Sign In</button>
                    <button onClick={resetPassword}>Forgot Password?</button>
                </div>
            ) : (
                <div>
                    <p>Login successful!</p>
                    <button onClick={logout}>Sign Out</button>
                </div>
            )}
        </div>
    );
};

export default Auth;
