// AppStateProvider.tsx
import React, {createContext, ReactNode, useEffect, useReducer, useState} from 'react';
import {
    ChatHistoryLoadingState,
    Conversation,
    CosmosDBHealth,
    CosmosDBStatus,
    Feedback,
    FrontendSettings,
    frontendSettings,
} from '../api';
import {AccountInfo, EventType, PublicClientApplication} from '@azure/msal-browser';
import {appStateReducer} from './AppReducer';

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
    payload: { answerId: string; feedback: Feedback.Positive | Feedback.Negative | Feedback.Neutral }
}
    | { type: 'GET_FEEDBACK_STATE'; payload: string }
    | { type: 'SET_ANSWER_EXEC_RESULT'; payload: { answerId: string; exec_result: [] } }
    | { type: 'INJECT_QUESTION_TEXT'; payload: string }
    | { type: 'LOGIN' }
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
    isAuthenticated: false
};

// Combina la lógica de autenticación y de estado en un solo contexto
export const AppStateContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<Action>;
    login: () => void;
    logout: () => void;
    resetPassword: () => void;
} | undefined>(undefined);

type AppStateProviderProps = {
    children: ReactNode;
};

export const AppStateProvider: React.FC<AppStateProviderProps> = ({children}) => {
    const [state, dispatch] = useReducer(appStateReducer, initialState);
    const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
    let loginScope = ''
    useEffect(() => {
        const getFrontendSettings = async () => {
            try {
                const response = await frontendSettings();

                if (response && typeof response === "object") {
                    dispatch({type: 'FETCH_FRONTEND_SETTINGS', payload: response});

                    // Configuración MSAL
                    if (response.b2c) {
                        const {
                            client_id,
                            tenant_name,
                            signup_signin_policy,
                            redirect_uri,
                            known_authorities,
                            login_scope
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
                                cacheLocation: "localStorage",
                                storeAuthStateInCookie: false,
                            },
                        };

                        const msalApp = new PublicClientApplication(msalConfig);

                        // Inicializa MSAL antes de manejar redirecciones
                        await msalApp.initialize()
                            .then(() => {
                                return msalApp.handleRedirectPromise();
                            })
                            .then(response => {
                                if (response && 'account' in response) {
                                    msalApp.setActiveAccount(response.account);
                                    dispatch({type: 'LOGIN'});
                                }
                            })
                            .catch(error => {
                                console.error("Error handling redirect promise:", error);
                            });

                        // Maneja eventos de autenticación después de la inicialización
                        msalApp.addEventCallback(event => {
                            if (event.eventType === EventType.LOGIN_SUCCESS && event.payload && 'account' in event.payload) {
                                const account = event.payload.account as AccountInfo;
                                msalApp.setActiveAccount(account);
                                dispatch({type: 'LOGIN'});
                            } else if (event.eventType === EventType.LOGOUT_SUCCESS) {
                                dispatch({type: 'LOGOUT'});
                            }
                        });

                        setMsalInstance(msalApp);
                    }
                } else {
                    console.warn("Frontend settings could not be loaded properly.");
                    dispatch({type: 'FETCH_FRONTEND_SETTINGS', payload: null});
                }
            } catch (error) {
                console.error("Error fetching frontend settings:", error);
                dispatch({type: 'FETCH_FRONTEND_SETTINGS', payload: null});
            }
        };
        getFrontendSettings();
    }, []);


    const login = () => {
        if (msalInstance) {
            msalInstance.loginRedirect({scopes: [loginScope]}).catch(error => {
                console.error("Login error:", error);
            });
        }
    };

    const logout = () => {
        if (msalInstance) {
            msalInstance.logoutRedirect().catch(error => {
                console.error("Logout error:", error);
            });
        }
    };

    const resetPassword = () => {
        const {tenant_name, password_reset_policy} = state.frontendSettings?.b2c || {};
        if (msalInstance && tenant_name && password_reset_policy) {
            msalInstance.loginRedirect({
                authority: `https://${tenant_name}.b2clogin.com/${tenant_name}.onmicrosoft.com/${password_reset_policy}`,
                scopes: ["User.Read"],
            }).catch(error => {
                console.error("Password reset error:", error);
            });
        }
    };

    return (
        <AppStateContext.Provider value={{state, dispatch, login, logout, resetPassword}}>
            {children}
        </AppStateContext.Provider>
    );
};
