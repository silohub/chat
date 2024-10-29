// AppStateProvider.tsx
import React, { createContext, ReactNode, useEffect, useReducer, useState } from 'react';
import {
    ChatHistoryLoadingState,
    Conversation,
    CosmosDBHealth,
    CosmosDBStatus,
    Feedback,
    FrontendSettings,
    frontendSettings,
    historyEnsure,
    historyList,
} from '../api';
import { AccountInfo, EventType, PublicClientApplication } from '@azure/msal-browser';
import { appStateReducer } from './AppReducer';

export interface AppState {
    isChatHistoryOpen: boolean;
    chatHistoryLoadingState: ChatHistoryLoadingState;
    isCosmosDBAvailable: CosmosDBHealth;
    chatHistory: Conversation[] | null;
    filteredChatHistory: Conversation[] | null;
    currentChat: Conversation | null;
    frontendSettings: FrontendSettings | null;
    feedbackState: { [answerId: string]: Feedback.Neutral | Feedback.Positive | Feedback.Negative };
    isLoading: boolean;
    answerExecResult: { [answerId: string]: [] };
    injectedQuestionText: string;
    isAuthenticated: boolean;
    userName: string | null;
    userSurname: string | null;
    userEmail: string | null; // Nuevo campo para el email
}

export type Action =
    | { type: 'TOGGLE_CHAT_HISTORY' }
    | { type: 'SET_COSMOSDB_STATUS'; payload: CosmosDBHealth }
    | { type: 'UPDATE_CHAT_HISTORY_LOADING_STATE'; payload: ChatHistoryLoadingState }
    | { type: 'UPDATE_CURRENT_CHAT'; payload: Conversation | null }
    | { type: 'UPDATE_FILTERED_CHAT_HISTORY'; payload: Conversation[] | null }
    | { type: 'UPDATE_CHAT_HISTORY'; payload: Conversation }
    | { type: 'UPDATE_CHAT_TITLE'; payload: Conversation }
    | { type: 'DELETE_CHAT_ENTRY'; payload: string }
    | { type: 'DELETE_CHAT_HISTORY' }
    | { type: 'DELETE_CURRENT_CHAT_MESSAGES'; payload: string }
    | { type: 'FETCH_CHAT_HISTORY'; payload: Conversation[] | null }
    | { type: 'FETCH_FRONTEND_SETTINGS'; payload: FrontendSettings | null }
    | {
    type: 'SET_FEEDBACK_STATE';
    payload: { answerId: string; feedback: Feedback.Positive | Feedback.Negative | Feedback.Neutral };
}
    | { type: 'GET_FEEDBACK_STATE'; payload: string }
    | { type: 'SET_ANSWER_EXEC_RESULT'; payload: { answerId: string; exec_result: [] } }
    | { type: 'INJECT_QUESTION_TEXT'; payload: string }
    | { type: 'LOGIN'; payload: { userName: string; userSurname: string; userEmail: string } }
    | { type: 'LOGOUT' };

const initialState: AppState = {
    isChatHistoryOpen: false,
    chatHistoryLoadingState: ChatHistoryLoadingState.Loading,
    chatHistory: null,
    filteredChatHistory: null,
    currentChat: null,
    isCosmosDBAvailable: {
        cosmosDB: false,
        status: CosmosDBStatus.NotConfigured,
    },
    frontendSettings: null,
    feedbackState: {},
    isLoading: true,
    answerExecResult: {},
    injectedQuestionText: '',
    isAuthenticated: sessionStorage.getItem('isAuthenticated') === 'true',
    userName: sessionStorage.getItem('userName'),
    userSurname: sessionStorage.getItem('userSurname'),
    userEmail: sessionStorage.getItem('userEmail'), // Recuperación del email desde sessionStorage
};

export const AppStateContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<Action>;
    login: () => void;
    logout: () => void;
    resetPassword: () => void;
    editProfile: () => void;
} | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appStateReducer, initialState);
    const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
    let loginScope = '';

    // Nueva función fetchChatHistory
    const fetchChatHistory = async (offset = 0): Promise<Conversation[] | null> => {
        const result = await historyList(offset)
            .then((response) => {
                if (response) {
                    dispatch({ type: 'FETCH_CHAT_HISTORY', payload: response });
                } else {
                    dispatch({ type: 'FETCH_CHAT_HISTORY', payload: null });
                }
                return response;
            })
            .catch((_err) => {
                dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
                dispatch({ type: 'FETCH_CHAT_HISTORY', payload: null });
                console.error('There was an issue fetching your data.');
                return null;
            });
        return result;
    };

    // Nueva función getHistoryEnsure
    const getHistoryEnsure = async () => {
        dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Loading });
        historyEnsure()
            .then((response) => {
                if (response?.cosmosDB) {
                    fetchChatHistory()
                        .then((res) => {
                            if (res) {
                                dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Success });
                                dispatch({ type: 'SET_COSMOSDB_STATUS', payload: response });
                            } else {
                                dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
                                dispatch({
                                    type: 'SET_COSMOSDB_STATUS',
                                    payload: { cosmosDB: false, status: CosmosDBStatus.NotWorking },
                                });
                            }
                        })
                        .catch((_err) => {
                            dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
                            dispatch({
                                type: 'SET_COSMOSDB_STATUS',
                                payload: { cosmosDB: false, status: CosmosDBStatus.NotWorking },
                            });
                        });
                } else {
                    dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
                    dispatch({ type: 'SET_COSMOSDB_STATUS', payload: response });
                }
            })
            .catch((_err) => {
                dispatch({ type: 'UPDATE_CHAT_HISTORY_LOADING_STATE', payload: ChatHistoryLoadingState.Fail });
                dispatch({ type: 'SET_COSMOSDB_STATUS', payload: { cosmosDB: false, status: CosmosDBStatus.NotConfigured } });
            });
    };

    useEffect(() => {
        getHistoryEnsure(); // Llamada a getHistoryEnsure en useEffect
    }, []);

    useEffect(() => {
        const getFrontendSettings = async () => {
            try {
                const response = await frontendSettings();

                if (response && typeof response === 'object') {
                    dispatch({ type: 'FETCH_FRONTEND_SETTINGS', payload: response });

                    if (response.b2c) {
                        const {
                            client_id,
                            tenant_name,
                            signup_signin_policy,
                            redirect_uri,
                            known_authorities,
                            login_scope,
                        } = response.b2c;
                        loginScope = login_scope;

                        const msalConfig = {
                            auth: {
                                clientId: client_id,
                                authority: `https://${tenant_name}.b2clogin.com/${tenant_name}.onmicrosoft.com/${signup_signin_policy}`,
                                knownAuthorities: [known_authorities],
                                redirectUri: redirect_uri || window.location.origin,
                            },
                            cache: {
                                cacheLocation: 'localStorage',
                                storeAuthStateInCookie: false,
                            },
                        };

                        const msalApp = new PublicClientApplication(msalConfig);

                        await msalApp
                            .initialize()
                            .then(() => msalApp.handleRedirectPromise())
                            .then((response) => {
                                if (response && 'account' in response) {
                                    const givenName = String(response.account?.idTokenClaims?.given_name ?? '');
                                    const familyName = String(response.account?.idTokenClaims?.family_name ?? '');
                                    const email = String(response.account?.idTokenClaims?.email ?? '');
                                    msalApp.setActiveAccount(response.account);

                                    // Guardar datos en sessionStorage
                                    sessionStorage.setItem('isAuthenticated', 'true');
                                    sessionStorage.setItem('userName', givenName);
                                    sessionStorage.setItem('userSurname', familyName);
                                    sessionStorage.setItem('userEmail', email); // Almacena el email

                                    dispatch({
                                        type: 'LOGIN',
                                        payload: { userName: givenName, userSurname: familyName, userEmail: email },
                                    });
                                }
                            })
                            .catch((error) => {
                                console.error('Error handling redirect promise:', error);
                            });

                        msalApp.addEventCallback((event) => {
                            if (event.eventType === EventType.LOGIN_SUCCESS && event.payload && 'account' in event.payload) {
                                const account = event.payload.account as AccountInfo;
                                const givenName = String(account?.idTokenClaims?.given_name ?? '');
                                const familyName = String(account?.idTokenClaims?.family_name ?? '');
                                const email = String(account?.idTokenClaims?.email ?? '');

                                msalApp.setActiveAccount(account);

                                // Guardar datos en sessionStorage
                                sessionStorage.setItem('isAuthenticated', 'true');
                                sessionStorage.setItem('userName', givenName);
                                sessionStorage.setItem('userSurname', familyName);
                                sessionStorage.setItem('userEmail', email); // Almacena el email

                                dispatch({
                                    type: 'LOGIN',
                                    payload: { userName: givenName, userSurname: familyName, userEmail: email },
                                });
                            } else if (event.eventType === EventType.LOGOUT_SUCCESS) {
                                // Limpiar datos de sessionStorage
                                sessionStorage.removeItem('isAuthenticated');
                                sessionStorage.removeItem('userName');
                                sessionStorage.removeItem('userSurname');
                                sessionStorage.removeItem('userEmail'); // Remueve el email

                                dispatch({ type: 'LOGOUT' });
                            }
                        });

                        setMsalInstance(msalApp);
                    }
                }
            } catch (error) {
                console.error('Error fetching frontend settings:', error);
                dispatch({ type: 'FETCH_FRONTEND_SETTINGS', payload: null });
            }
        };
        getFrontendSettings();
    }, []);

    const login = () => {
        if (msalInstance) {
            msalInstance.loginRedirect({ scopes: [loginScope] }).catch((error) => {
                console.error('Login error:', error);
            });
        }
    };

    const logout = () => {
        if (msalInstance) {
            msalInstance.logoutRedirect().catch((error) => {
                console.error('Logout error:', error);
            });
        }
    };

    const resetPassword = () => {
        const { tenant_name, password_reset_policy } = state.frontendSettings?.b2c || {};
        if (msalInstance && tenant_name && password_reset_policy) {
            msalInstance.loginRedirect({
                authority: `https://${tenant_name}.b2clogin.com/${tenant_name}.onmicrosoft.com/${password_reset_policy}`,
                scopes: ['User.Read'],
            }).catch((error) => {
                console.error('Password reset error:', error);
            });
        }
    };

    const editProfile = () => {
        const { tenant_name, edit_profile_policy } = state.frontendSettings?.b2c || {};
        if (msalInstance && tenant_name && edit_profile_policy) {
            msalInstance.loginRedirect({
                authority: `https://${tenant_name}.b2clogin.com/${tenant_name}.onmicrosoft.com/${edit_profile_policy}`,
                scopes: ["openid", "profile"]
            }).catch(error => {
                console.error("Profile edit error:", error);
            });
        }
    };

    return (
        <AppStateContext.Provider value={{ state, dispatch, login, logout, resetPassword, editProfile }}>
            {children}
        </AppStateContext.Provider>
    );
};
