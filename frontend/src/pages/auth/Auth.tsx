import React, {useState, useEffect, useContext} from 'react';
// @ts-ignore
import {useIsAuthenticated, useMsal} from "@azure/msal-react";
// @ts-ignore
import {InteractionStatus} from "@azure/msal-browser";
import {AppStateContext} from "../../state/AppProvider";
import {useNavigate} from "react-router-dom";

const AuthComponent: React.FC = () => {
    const { instance, accounts, inProgress } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [loginDisplay, setLoginDisplay] = useState(false);
    const [dataSource, setDataSource] = useState<{ claim: string; value: any }[]>([]);

    useEffect(() => {
        if (inProgress === InteractionStatus.None) {
            setLoginDisplay(accounts.length > 0);
            const account = instance.getActiveAccount();
            if (account && account.idTokenClaims) {
                getClaims(account.idTokenClaims);
            }
        }
    }, [inProgress, accounts, instance]);

    const getClaims = (claims: Record<string, any>) => {
        const claimsArray = Object.entries(claims).map(([claim, value]) => ({ claim, value }));
        setDataSource(claimsArray);
    };

    const handleLogin = () => {
        instance.loginRedirect();
    };

    const handleLogout = () => {
        instance.logoutRedirect();
    };

    return (
        <div>
            {!loginDisplay ? (
                <div>
                    <p className="welcome">Welcome to the MSAL.js v2 React Quickstart!</p>
                    <p>This sample demonstrates how to configure MSAL React to login, logout, protect a route, and acquire an access token for a protected resource such as the Microsoft Graph.</p>
                    <p>Please sign-in to see your profile information.</p>
                    <button onClick={handleLogin}>Sign In</button>
                </div>
            ) : (
                <div>
                    <p>Login successful!</p>
                    <p>Call a B2C protected web API by selecting the Hello API link above.</p>
                    <p>Claims in your ID token are shown below:</p>

                    <table>
                        <thead>
                        <tr>
                            <th>Claim</th>
                            <th>Value</th>
                        </tr>
                        </thead>
                        <tbody>
                        {dataSource.map((row, index) => (
                            <tr key={index}>
                                <td>{row.claim}</td>
                                <td>{row.value}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    <button onClick={handleLogout}>Sign Out</button>
                </div>
            )}
        </div>
    );
    // @ts-ignore
    // const { dispatch } = useContext(AppStateContext); // Usar dispatch en lugar de setAuthenticated
    // const navigate = useNavigate();
    //
    // const handleLogin = () => {
    //     // Simulación de autenticación exitosa
    //     dispatch({ type: 'LOGIN' }); // Dispara la acción LOGIN para marcar como autenticado
    //     navigate('/'); // Redirige a la página principal
    // };
    //
    // return (
    //     <div>
    //         <h1>Login</h1>
    //         <button onClick={handleLogin}>Iniciar sesión</button>
    //     </div>
    // );
};

export default AuthComponent;
