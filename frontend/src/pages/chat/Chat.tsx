// Importaciones necesarias
import {useContext, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {CommandBarButton, Dialog, DialogType, IconButton, Stack} from '@fluentui/react'
import {ErrorCircleRegular, ShieldLockRegular, SquareRegular} from '@fluentui/react-icons'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import uuid from 'react-uuid'
import {isEmpty} from 'lodash'
import DOMPurify from 'dompurify'
import {Prism as SyntaxHighlighter} from 'react-syntax-highlighter'
import {nord} from 'react-syntax-highlighter/dist/esm/styles/prism'

import styles from './Chat.module.css'
import {XSSAllowTags} from '../../constants/sanatizeAllowables'

import {
    AzureSqlServerExecResults,
    ChatHistoryLoadingState,
    ChatMessage,
    ChatResponse,
    Citation,
    Conversation,
    conversationApi,
    ConversationRequest,
    CosmosDBStatus,
    ErrorMessage,
    ExecResults,
    historyClear,
    historyGenerate,
    historyUpdate,
    ToolMessageContent,
} from "../../api";
import {Answer} from "../../components/Answer";
import {QuestionInput} from "../../components/QuestionInput";
import {ChatHistoryPanel} from "../../components/ChatHistory/ChatHistoryPanel";
import {AppStateContext} from "../../state/AppProvider";
import {useBoolean} from "@fluentui/react-hooks";
import headerLogo from "../../assets/Logo-ExpoCTT-joven.svg"
import sailoLogo from "../../assets/sailo.svg"

// Definición del estado del mensaje
const enum messageStatus {
    NotRunning = 'Not Running',
    Processing = 'Processing',
    Done = 'Done'
}

// Componente principal del chat
const Chat = () => {
    // Contexto y hooks de estado
    const appStateContext = useContext(AppStateContext)
    const AUTH_ENABLED = appStateContext?.state.frontendSettings?.auth_enabled
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null)

    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [showLoadingMessage, setShowLoadingMessage] = useState<boolean>(false)
    const [activeCitation, setActiveCitation] = useState<Citation>()
    const [isCitationPanelOpen, setIsCitationPanelOpen] = useState<boolean>(false)
    const [isIntentsPanelOpen, setIsIntentsPanelOpen] = useState<boolean>(false)

    const abortFuncs = useRef([] as AbortController[])
    const [showAuthMessage, setShowAuthMessage] = useState<boolean | undefined>()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [execResults, setExecResults] = useState<ExecResults[]>([])
    const [processMessages, setProcessMessages] = useState<messageStatus>(messageStatus.NotRunning)
    const [clearingChat, setClearingChat] = useState<boolean>(false)

    const [hideErrorDialog, {toggle: toggleErrorDialog}] = useBoolean(true)
    const [errorMsg, setErrorMsg] = useState<ErrorMessage | null>()
    const [logo, setLogo] = useState('')
    const [sailo, setsailo] = useState('')

    const [answerId, setAnswerId] = useState<string>('')
    // @ts-ignore
    const {state, dispatch} = useContext(AppStateContext);
    const [questionText, setQuestionText] = useState('');


    // Parámetros del diálogo de error
    const errorDialogContentProps = {
        type: DialogType.close,
        title: errorMsg?.title,
        closeButtonAriaLabel: 'Close',
        subText: errorMsg?.subtitle
    }

    const modalProps = {
        titleAriaId: 'labelId',
        subtitleAriaId: 'subTextId',
        isBlocking: true,
        styles: {main: {maxWidth: 450}}
    }

    // Constantes de roles de mensajes y mensajes de error
    const [ASSISTANT, TOOL, ERROR] = ['assistant', 'tool', 'error']
    const NO_CONTENT_ERROR = 'No content in messages object.'

    // Efecto que muestra el mensaje de autenticación si es necesario
    useEffect(() => {
        if (
            appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.Working &&
            appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured &&
            appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Fail &&
            hideErrorDialog
        ) {
            let subtitle = `${appStateContext.state.isCosmosDBAvailable.status}. Please contact the site administrator.`
            setErrorMsg({
                title: 'Chat history is not enabled',
                subtitle: subtitle
            })
            toggleErrorDialog()
        }
    }, [appStateContext?.state.isCosmosDBAvailable])

    useEffect(() => {
        // Cada vez que el texto inyectado cambie, lo ponemos en el estado local
        setQuestionText(state.injectedQuestionText);
    }, [state.injectedQuestionText]);


    // Manejo de cierre del diálogo de error
    const handleErrorDialogClose = () => {
        toggleErrorDialog()
        setTimeout(() => {
            setErrorMsg(null)
        }, 500)
    }

    // Efecto para cargar el logo al iniciar la app
    useEffect(() => {
        if (!appStateContext?.state.isLoading) {
            setLogo(headerLogo)
            setsailo(sailoLogo)

        }
    }, [appStateContext?.state.isLoading])

    // Efecto que actualiza el estado de carga
    useEffect(() => {
        setIsLoading(appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading)
    }, [appStateContext?.state.chatHistoryLoadingState])

    // Función auxiliar para obtener información de usuario
    const getUserInfoList = async () => {
        if (!AUTH_ENABLED) {
            setShowAuthMessage(false)
            return
        }
        // const userInfoList = await getUserInfo()
        // if (userInfoList.length === 0 && window.location.hostname !== '127.0.0.1') {
        //   setShowAuthMessage(true)
        // } else {
        //   setShowAuthMessage(false)
        // }
    }

    // Variables de mensajes
    let assistantMessage = {} as ChatMessage
    let toolMessage = {} as ChatMessage
    let assistantContent = ''

    // Parseo de resultados de ejecución
    useEffect(() => parseExecResults(execResults), [execResults])

    const parseExecResults = (exec_results_: any): void => {
        if (exec_results_ == undefined) return
        const exec_results = exec_results_.length === 2 ? exec_results_ : exec_results_.splice(2)
        appStateContext?.dispatch({
            type: 'SET_ANSWER_EXEC_RESULT',
            payload: {answerId: answerId, exec_result: exec_results}
        })
    }

    // Procesamiento de los mensajes de resultado
    const processResultMessage = (resultMessage: ChatMessage, userMessage: ChatMessage, conversationId?: string) => {
        if (typeof resultMessage.content === "string" && resultMessage.content.includes('all_exec_results')) {
            const parsedExecResults = JSON.parse(resultMessage.content) as AzureSqlServerExecResults
            setExecResults(parsedExecResults.all_exec_results)
            assistantMessage.context = JSON.stringify({
                all_exec_results: parsedExecResults.all_exec_results
            })
        }

        if (resultMessage.role === ASSISTANT) {
            setAnswerId(resultMessage.id)
            assistantContent += resultMessage.content
            assistantMessage = {...assistantMessage, ...resultMessage}
            assistantMessage.content = assistantContent

            if (resultMessage.context) {
                toolMessage = {
                    id: uuid(),
                    role: TOOL,
                    content: resultMessage.context,
                    date: new Date().toISOString()
                }
            }
        }

        if (resultMessage.role === TOOL) toolMessage = resultMessage

        // Actualización del estado de mensajes según la conversación
        if (!conversationId) {
            isEmpty(toolMessage)
                ? setMessages([...messages, userMessage, assistantMessage])
                : setMessages([...messages, userMessage, toolMessage, assistantMessage])
        } else {
            isEmpty(toolMessage)
                ? setMessages([...messages, assistantMessage])
                : setMessages([...messages, toolMessage, assistantMessage])
        }
    }

    const makeApiRequestWithCosmosDB = async (question: ChatMessage["content"], conversationId?: string) => {
        setIsLoading(true)
        setShowLoadingMessage(true)
        const abortController = new AbortController()
        abortFuncs.current.unshift(abortController)
        const questionContent = typeof question === 'string' ? question : [{
            type: "text",
            text: question[0].text
        }, {type: "image_url", image_url: {url: question[1].image_url.url}}]
        question = typeof question !== 'string' && question[0]?.text?.length > 0 ? question[0].text : question

        const userMessage: ChatMessage = {
            id: uuid(),
            role: 'user',
            content: questionContent as string,
            date: new Date().toISOString()
        }

        let request: ConversationRequest
        let conversation
        if (conversationId) {
            conversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
            if (!conversation) {
                console.error('Conversation not found.')
                setIsLoading(false)
                setShowLoadingMessage(false)
                abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                return
            } else {
                conversation.messages.push(userMessage)
                request = {
                    messages: [...conversation.messages.filter(answer => answer.role !== ERROR)]
                }
            }
        } else {
            request = {
                messages: [userMessage].filter(answer => answer.role !== ERROR)
            }
            setMessages(request.messages)
        }
        let result = {} as ChatResponse
        var errorResponseMessage: string | void = 'Please try again. If the problem persists, please contact the site administrator.'
        try {
            const response = conversationId
                ? await historyGenerate(request, abortController.signal, conversationId)
                : await historyGenerate(request, abortController.signal)
            if (!response?.ok) {
                const responseJson = await response.json()
                errorResponseMessage =
                    responseJson.error === undefined ? errorResponseMessage : parseErrorMessage(responseJson.error)
                let errorChatMsg: ChatMessage = {
                    id: uuid(),
                    role: ERROR,
                    content: `There was an error generating a response. Chat history can't be saved at this time. ${errorResponseMessage}`,
                    date: new Date().toISOString()
                }
                let resultConversation
                if (conversationId) {
                    resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
                    if (!resultConversation) {
                        console.error('Conversation not found.')
                        setIsLoading(false)
                        setShowLoadingMessage(false)
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                        return
                    }
                    resultConversation.messages.push(errorChatMsg)
                } else {
                    setMessages([...messages, userMessage, errorChatMsg])
                    setIsLoading(false)
                    setShowLoadingMessage(false)
                    abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                    return
                }
                appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: resultConversation})
                setMessages([...resultConversation.messages])
                return
            }
            if (response?.body) {
                const reader = response.body.getReader()

                let runningText = ''
                while (true) {
                    setProcessMessages(messageStatus.Processing)
                    const {done, value} = await reader.read()
                    if (done) break

                    var text = new TextDecoder('utf-8').decode(value)
                    const objects = text.split('\n')
                    objects.forEach(obj => {
                        try {
                            if (obj !== '' && obj !== '{}') {
                                runningText += obj
                                result = JSON.parse(runningText)
                                if (!result.choices?.[0]?.messages?.[0].content) {
                                    errorResponseMessage = NO_CONTENT_ERROR
                                    throw Error()
                                }
                                if (result.choices?.length > 0) {
                                    result.choices[0].messages.forEach(msg => {
                                        msg.id = result.id
                                        msg.date = new Date().toISOString()
                                    })
                                    if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                                        setShowLoadingMessage(false)
                                    }
                                    result.choices[0].messages.forEach(resultObj => {
                                        processResultMessage(resultObj, userMessage, conversationId)
                                    })
                                }
                                runningText = ''
                            } else if (result.error) {
                                throw Error(result.error)
                            }
                        } catch (e) {
                            if (!(e instanceof SyntaxError)) {
                                console.error(e)
                                throw e
                            } else {
                                console.log('Incomplete message. Continuing...')
                            }
                        }
                    })
                }

                let resultConversation
                if (conversationId) {
                    resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
                    if (!resultConversation) {
                        console.error('Conversation not found.')
                        setIsLoading(false)
                        setShowLoadingMessage(false)
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                        return
                    }
                    isEmpty(toolMessage)
                        ? resultConversation.messages.push(assistantMessage)
                        : resultConversation.messages.push(toolMessage, assistantMessage)
                } else {
                    resultConversation = {
                        id: result.history_metadata.conversation_id,
                        title: result.history_metadata.title,
                        messages: [userMessage],
                        date: result.history_metadata.date
                    }
                    isEmpty(toolMessage)
                        ? resultConversation.messages.push(assistantMessage)
                        : resultConversation.messages.push(toolMessage, assistantMessage)
                }
                if (!resultConversation) {
                    setIsLoading(false)
                    setShowLoadingMessage(false)
                    abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                    return
                }
                appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: resultConversation})
                isEmpty(toolMessage)
                    ? setMessages([...messages, assistantMessage])
                    : setMessages([...messages, toolMessage, assistantMessage])
            }
        } catch (e) {
            if (!abortController.signal.aborted) {
                let errorMessage = `An error occurred. ${errorResponseMessage}`
                if (result.error?.message) {
                    errorMessage = result.error.message
                } else if (typeof result.error === 'string') {
                    errorMessage = result.error
                }

                // @ts-ignore
                errorMessage = parseErrorMessage(errorMessage)

                let errorChatMsg: ChatMessage = {
                    id: uuid(),
                    role: ERROR,
                    content: errorMessage,
                    date: new Date().toISOString()
                }
                let resultConversation
                if (conversationId) {
                    resultConversation = appStateContext?.state?.chatHistory?.find(conv => conv.id === conversationId)
                    if (!resultConversation) {
                        console.error('Conversation not found.')
                        setIsLoading(false)
                        setShowLoadingMessage(false)
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                        return
                    }
                    resultConversation.messages.push(errorChatMsg)
                } else {
                    if (!result.history_metadata) {
                        console.error('Error retrieving data.', result)
                        let errorChatMsg: ChatMessage = {
                            id: uuid(),
                            role: ERROR,
                            content: errorMessage,
                            date: new Date().toISOString()
                        }
                        setMessages([...messages, userMessage, errorChatMsg])
                        setIsLoading(false)
                        setShowLoadingMessage(false)
                        abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                        return
                    }
                    resultConversation = {
                        id: result.history_metadata.conversation_id,
                        title: result.history_metadata.title,
                        messages: [userMessage],
                        date: result.history_metadata.date
                    }
                    resultConversation.messages.push(errorChatMsg)
                }
                if (!resultConversation) {
                    setIsLoading(false)
                    setShowLoadingMessage(false)
                    abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                    return
                }
                appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: resultConversation})
                setMessages([...messages, errorChatMsg])
            } else {
                setMessages([...messages, userMessage])
            }
        } finally {
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            setProcessMessages(messageStatus.Done)
        }
        return abortController.abort()
    }


    // Función para limpiar el chat
    const clearChat = async () => {
        setClearingChat(true)
        if (appStateContext?.state.currentChat?.id && appStateContext?.state.isCosmosDBAvailable.cosmosDB) {
            let response = await historyClear(appStateContext?.state.currentChat.id)
            if (!response.ok) {
                setErrorMsg({
                    title: 'Error clearing current chat',
                    subtitle: 'Please try again. If the problem persists, please contact the site administrator.'
                })
                toggleErrorDialog()
            } else {
                appStateContext?.dispatch({
                    type: 'DELETE_CURRENT_CHAT_MESSAGES',
                    payload: appStateContext?.state.currentChat.id
                })
                appStateContext?.dispatch({type: 'UPDATE_CHAT_HISTORY', payload: appStateContext?.state.currentChat})
                setActiveCitation(undefined)
                setIsCitationPanelOpen(false)
                setIsIntentsPanelOpen(false)
                setMessages([])
            }
        }
        setClearingChat(false)
    }

    const tryGetRaiPrettyError = (errorMessage: string) => {
        try {
            // Using a regex to extract the JSON part that contains "innererror"
            const match = errorMessage.match(/'innererror': ({.*})\}\}/)
            if (match) {
                // Replacing single quotes with double quotes and converting Python-like booleans to JSON booleans
                const fixedJson = match[1]
                    .replace(/'/g, '"')
                    .replace(/\bTrue\b/g, 'true')
                    .replace(/\bFalse\b/g, 'false')
                const innerErrorJson = JSON.parse(fixedJson)
                let reason = ''
                // Check if jailbreak content filter is the reason of the error
                const jailbreak = innerErrorJson.content_filter_result.jailbreak
                if (jailbreak.filtered === true) {
                    reason = 'Jailbreak'
                }

                // Returning the prettified error message
                if (reason !== '') {
                    return (
                        'The prompt was filtered due to triggering Azure OpenAI’s content filtering system.\n' +
                        'Reason: This prompt contains content flagged as ' +
                        reason +
                        '\n\n' +
                        'Please modify your prompt and retry. Learn more: https://go.microsoft.com/fwlink/?linkid=2198766'
                    )
                }
            }
        } catch (e) {
            console.error('Failed to parse the error:', e)
        }
        return errorMessage
    }

    const parseErrorMessage = (errorMessage: string) => {
        let errorCodeMessage = errorMessage.substring(0, errorMessage.indexOf('-') + 1)
        const innerErrorCue = "{\\'error\\': {\\'message\\': "
        if (errorMessage.includes(innerErrorCue)) {
            try {
                let innerErrorString = errorMessage.substring(errorMessage.indexOf(innerErrorCue))
                if (innerErrorString.endsWith("'}}")) {
                    innerErrorString = innerErrorString.substring(0, innerErrorString.length - 3)
                }
                innerErrorString = innerErrorString.replaceAll("\\'", "'")
                let newErrorMessage = errorCodeMessage + ' ' + innerErrorString
                errorMessage = newErrorMessage
            } catch (e) {
                console.error('Error parsing inner error message: ', e)
            }
        }

        return tryGetRaiPrettyError(errorMessage)
    }

    // Función para iniciar un nuevo chat
    const newChat = () => {
        setProcessMessages(messageStatus.Processing)
        setMessages([])
        setIsCitationPanelOpen(false)
        setIsIntentsPanelOpen(false)
        setActiveCitation(undefined)
        appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: null})
        setProcessMessages(messageStatus.Done)
    }

    // Función para detener la generación de respuestas
    const stopGenerating = () => {
        abortFuncs.current.forEach(a => a.abort())
        setShowLoadingMessage(false)
        setIsLoading(false)
    }

    // Efecto para manejar cambios en el chat actual
    useEffect(() => {
        if (appStateContext?.state.currentChat) {
            setMessages(appStateContext.state.currentChat.messages)
        } else {
            setMessages([])
        }
    }, [appStateContext?.state.currentChat])

    // Guardado de los mensajes en la base de datos
    useLayoutEffect(() => {
        const saveToDB = async (messages: ChatMessage[], id: string) => {
            const response = await historyUpdate(messages, id)
            return response
        }

        if (appStateContext && appStateContext.state.currentChat && processMessages === messageStatus.Done) {
            if (appStateContext.state.isCosmosDBAvailable.cosmosDB) {
                if (!appStateContext?.state.currentChat?.messages) {
                    console.error('Failure fetching current chat state.')
                    return
                }
                const noContentError = appStateContext.state.currentChat.messages.find(m => m.role === ERROR)

                if (!noContentError) {
                    saveToDB(appStateContext.state.currentChat.messages, appStateContext.state.currentChat.id)
                        .then(res => {
                            if (!res.ok) {
                                let errorMessage =
                                    "An error occurred. Answers can't be saved at this time. If the problem persists, please contact the site administrator."
                                let errorChatMsg: ChatMessage = {
                                    id: uuid(),
                                    role: ERROR,
                                    content: errorMessage,
                                    date: new Date().toISOString()
                                }
                                if (!appStateContext?.state.currentChat?.messages) {
                                    let err: Error = {
                                        ...new Error(),
                                        message: 'Failure fetching current chat state.'
                                    }
                                    throw err
                                }
                                setMessages([...appStateContext?.state.currentChat?.messages, errorChatMsg])
                            }
                            return res as Response
                        })
                        .catch(err => {
                            console.error('Error: ', err)
                            let errRes: Response = {
                                ...new Response(),
                                ok: false,
                                status: 500
                            }
                            return errRes
                        })
                }
            } else {
            }
            appStateContext?.dispatch({type: 'UPDATE_CHAT_HISTORY', payload: appStateContext.state.currentChat})
            setMessages(appStateContext.state.currentChat.messages)
            setProcessMessages(messageStatus.NotRunning)
        }
    }, [processMessages])


    // Efecto para obtener la información del usuario si la autenticación está habilitada
    useEffect(() => {
        if (AUTH_ENABLED !== undefined) getUserInfoList()
    }, [AUTH_ENABLED])

    // Scroll automático al final del chat
    useLayoutEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({behavior: 'smooth'})
    }, [showLoadingMessage, processMessages])

    // Mostrar cita activa
    const onShowCitation = (citation: Citation) => {
        setActiveCitation(citation)
        setIsCitationPanelOpen(true)
    }

    // Mostrar resultado de ejecución
    const onShowExecResult = (answerId: string) => {
        setIsIntentsPanelOpen(true)
    }

    const onViewSource = (citation: Citation) => {
        if (citation.url && !citation.url.includes('blob.core')) {
            window.open(citation.url, '_blank')
        }
    }

    // Parsear cita de un mensaje
    const parseCitationFromMessage = (message: ChatMessage) => {
        if (message?.role && message?.role === 'tool' && typeof message?.content === "string") {
            try {
                const toolMessage = JSON.parse(message.content) as ToolMessageContent
                return toolMessage.citations
            } catch {
                return []
            }
        }
        return []
    }

    // Parsear gráficos de un mensaje
    const parsePlotFromMessage = (message: ChatMessage) => {
        if (message?.role && message?.role === "tool" && typeof message?.content === "string") {
            try {
                const execResults = JSON.parse(message.content) as AzureSqlServerExecResults;
                const codeExecResult = execResults.all_exec_results.at(-1)?.code_exec_result;

                if (codeExecResult === undefined) {
                    return null;
                }
                return codeExecResult.toString();
            } catch {
                return null;
            }
        }
        return null;
    }

    // Función para deshabilitar botones
    const disabledButton = () => {
        return (
            isLoading ||
            (messages && messages.length === 0) ||
            clearingChat ||
            appStateContext?.state.chatHistoryLoadingState === ChatHistoryLoadingState.Loading
        )
    }

    const makeApiRequestWithoutCosmosDB = async (question: ChatMessage["content"], conversationId?: string) => {
        setIsLoading(true)
        setShowLoadingMessage(true)
        const abortController = new AbortController()
        abortFuncs.current.unshift(abortController)

        const questionContent = typeof question === 'string' ? question : [{
            type: "text",
            text: question[0].text
        }, {type: "image_url", image_url: {url: question[1].image_url.url}}]
        question = typeof question !== 'string' && question[0]?.text?.length > 0 ? question[0].text : question

        const userMessage: ChatMessage = {
            id: uuid(),
            role: 'user',
            content: questionContent as string,
            date: new Date().toISOString()
        }

        let conversation: Conversation | null | undefined
        if (!conversationId) {
            conversation = {
                id: conversationId ?? uuid(),
                title: question as string,
                messages: [userMessage],
                date: new Date().toISOString()
            }
        } else {
            conversation = appStateContext?.state?.currentChat
            if (!conversation) {
                console.error('Conversation not found.')
                setIsLoading(false)
                setShowLoadingMessage(false)
                abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
                return
            } else {
                conversation.messages.push(userMessage)
            }
        }

        appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: conversation})
        setMessages(conversation.messages)

        const request: ConversationRequest = {
            messages: [...conversation.messages.filter(answer => answer.role !== ERROR)]
        }

        let result = {} as ChatResponse
        try {
            const response = await conversationApi(request, abortController.signal)
            if (response?.body) {
                const reader = response.body.getReader()

                let runningText = ''
                while (true) {
                    setProcessMessages(messageStatus.Processing)
                    const {done, value} = await reader.read()
                    if (done) break

                    var text = new TextDecoder('utf-8').decode(value)
                    const objects = text.split('\n')
                    objects.forEach(obj => {
                        try {
                            if (obj !== '' && obj !== '{}') {
                                runningText += obj
                                result = JSON.parse(runningText)
                                if (result.choices?.length > 0) {
                                    result.choices[0].messages.forEach(msg => {
                                        msg.id = result.id
                                        msg.date = new Date().toISOString()
                                    })
                                    if (result.choices[0].messages?.some(m => m.role === ASSISTANT)) {
                                        setShowLoadingMessage(false)
                                    }
                                    result.choices[0].messages.forEach(resultObj => {
                                        processResultMessage(resultObj, userMessage, conversationId)
                                    })
                                } else if (result.error) {
                                    throw Error(result.error)
                                }
                                runningText = ''
                            }
                        } catch (e) {
                            if (!(e instanceof SyntaxError)) {
                                console.error(e)
                                throw e
                            } else {
                                console.log('Incomplete message. Continuing...')
                            }
                        }
                    })
                }
                conversation.messages.push(toolMessage, assistantMessage)
                appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: conversation})
                setMessages([...messages, toolMessage, assistantMessage])
            }
        } catch (e) {
            if (!abortController.signal.aborted) {
                let errorMessage =
                    'Ha ocurrido un error, por favor, vuelva a intentarlo'
                if (result.error?.message) {
                    errorMessage = result.error.message
                } else if (typeof result.error === 'string') {
                    errorMessage = result.error
                }

                errorMessage = parseErrorMessage(errorMessage)

                let errorChatMsg: ChatMessage = {
                    id: uuid(),
                    role: ERROR,
                    content: errorMessage,
                    date: new Date().toISOString()
                }
                conversation.messages.push(errorChatMsg)
                appStateContext?.dispatch({type: 'UPDATE_CURRENT_CHAT', payload: conversation})
                setMessages([...messages, errorChatMsg])
            } else {
                setMessages([...messages, userMessage])
            }
        } finally {
            setIsLoading(false)
            setShowLoadingMessage(false)
            abortFuncs.current = abortFuncs.current.filter(a => a !== abortController)
            setProcessMessages(messageStatus.Done)
        }

        return abortController.abort()
    }

    // Renderizado del componente
    return (
        <div className={styles.container} role="main">
            {/* Mostrar mensaje de autenticación */}
            {showAuthMessage ? (
                <Stack className={styles.chatEmptyState}>
                    <ShieldLockRegular
                        className={styles.chatIcon}
                        style={{color: 'darkorange', height: '200px', width: '200px'}}
                    />
                    <h1 className={styles.chatEmptyStateTitle}>Authentication Not Configured</h1>
                    <h2 className={styles.chatEmptyStateSubtitle}>
                        This app does not have authentication configured. Please add an identity provider by finding
                        your app in the{' '}
                        <a href="https://portal.azure.com/" target="_blank">
                            Azure Portal
                        </a>
                        and following{' '}
                        <a
                            href="https://learn.microsoft.com/en-us/azure/app-service/scenario-secure-app-authentication-app-service#3-configure-authentication-and-authorization"
                            target="_blank">
                            these instructions
                        </a>
                        .
                    </h2>
                </Stack>
            ) : (
                <Stack horizontal className={styles.chatRoot}>
                    <div className={styles.chatContainer}>
                        {/* Si no hay mensajes, mostrar estado vacío */}
                        {!messages || messages.length < 1 ? (
                            <Stack className={styles.chatEmptyState}>
                                <div className={styles.imageContainer}>
                                    <img src={logo} className={styles.chatIcon} aria-hidden="true"/>
                                </div>
                                <h1 className={styles.chatEmptyStateTitle}>Preguntá lo que quieras</h1>
                                <h2 className={styles.chatEmptyStateSubtitle}>Este chatbot está configurado para
                                    responder tus preguntas</h2>
                            </Stack>
                        ) : (
                            <div className={styles.chatMessageStream} style={{marginBottom: isLoading ? '40px' : '0px'}}
                                 role="log">
                                {messages.map((answer, index) => (
                                    <>
                                        {answer.role === 'user' ? (
                                            <div className={styles.chatMessageUser} tabIndex={0}>
                                                <div className={styles.chatMessageUserMessage}>
                                                    {typeof answer.content === "string" && answer.content ? answer.content : Array.isArray(answer.content) ? <>{answer.content[0].text}
                                                        <img className={styles.uploadedImageChat}
                                                             src={answer.content[1].image_url.url}
                                                             alt="Uploaded Preview"/></> : null}
                                                </div>
                                            </div>
                                        ) : answer.role === 'assistant' ? (
                                            <div className={styles.chatMessageGpt}>
                                                {typeof answer.content === "string" && <Answer
                                                    answer={{
                                                        answer: answer.content,
                                                        citations: parseCitationFromMessage(messages[index - 1]),
                                                        generated_chart: parsePlotFromMessage(messages[index - 1]),
                                                        message_id: answer.id,
                                                        feedback: answer.feedback,
                                                        exec_results: execResults
                                                    }}
                                                    onCitationClicked={c => onShowCitation(c)}
                                                    onExectResultClicked={() => onShowExecResult(answerId)}
                                                />}
                                            </div>
                                        ) : answer.role === ERROR ? (
                                            <div className={styles.chatMessageError}>
                                                <Stack horizontal className={styles.chatMessageErrorContent}>
                                                    <ErrorCircleRegular className={styles.errorIcon}
                                                                        style={{color: 'rgba(182, 52, 67, 1)'}}/>
                                                    <span>Error</span>
                                                </Stack>
                                                <span
                                                    className={styles.chatMessageErrorContent}>{typeof answer.content === "string" && answer.content}</span>
                                            </div>
                                        ) : null}
                                    </>
                                ))}
                                {showLoadingMessage && (
                                    <>
                                        <div className={styles.chatMessageGpt}>
                                            <Answer
                                                answer={{
                                                    answer: "Generando respuesta...",
                                                    citations: [],
                                                    generated_chart: null
                                                }}
                                                onCitationClicked={() => null}
                                                onExectResultClicked={() => null}
                                            />
                                        </div>
                                    </>
                                )}
                                <div ref={chatMessageStreamEnd}/>
                            </div>
                        )}

                        {/* Panel de entrada de preguntas */}
                        <Stack horizontal className={styles.chatInput}>
                            {isLoading && messages.length > 0 && (
                                <Stack
                                    horizontal
                                    className={styles.stopGeneratingContainer}
                                    role="button"
                                    aria-label="Detener"
                                    tabIndex={0}
                                    onClick={stopGenerating}
                                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? stopGenerating() : null)}>
                                    <SquareRegular className={styles.stopGeneratingIcon} aria-hidden="true"/>
                                    <span className={styles.stopGeneratingText} aria-hidden="true">
                    Detener
                  </span>
                                </Stack>
                            )}
                            <Stack>
                                {/* Botones para nuevo chat y limpiar chat */}
                                <CommandBarButton
                                    role="button"
                                    styles={{
                                        icon: {
                                            color: '#183B57'
                                        },
                                        iconDisabled: {
                                            color: '#183B57 !important'
                                        },
                                        root: {
                                            color: '#FFFFFF',
                                            background: '#FFFFFF'
                                        },
                                        rootDisabled: {
                                            background: '#F0F0F0'
                                        }
                                    }}
                                    className={
                                        appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured
                                            ? styles.clearChatBroom
                                            : styles.clearChatBroomNoCosmos
                                    }
                                    iconProps={{iconName: 'Broom'}}
                                    onClick={
                                        appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured
                                            ? clearChat
                                            : newChat
                                    }
                                    disabled={disabledButton()}
                                    aria-label="clear chat button"
                                />
                                <Dialog
                                    hidden={hideErrorDialog}
                                    onDismiss={handleErrorDialogClose}
                                    dialogContentProps={errorDialogContentProps}
                                    modalProps={modalProps}></Dialog>
                            </Stack>
                            <QuestionInput
                                clearOnSend
                                placeholder="..."
                                disabled={isLoading}
                                initialValue={questionText} // Aquí pasamos el texto inyectado
                                onSend={(question, id) => {
                                    console.log('Sending question:', question);
                                    appStateContext?.state.isCosmosDBAvailable?.cosmosDB
                                        ? makeApiRequestWithCosmosDB(question, id)
                                        : makeApiRequestWithoutCosmosDB(question, id)
                                    dispatch({type: 'INJECT_QUESTION_TEXT', payload: ''})
                                }}
                                conversationId={
                                    appStateContext?.state.currentChat?.id ? appStateContext?.state.currentChat?.id : undefined
                                }
                            />
                        </Stack>
                        <div className={styles.sailo}>
                           <span className={styles.sailoText}>Implementado por </span>
                            <a href="https://www.sailo.ag/" target="_blank">
                                <img src={sailo} className={styles.sailoIcon} aria-hidden="true" alt="SaiLO"/>
                            </a>

                        </div>
                    </div>

                    {/* Panel de citas */}
                    {messages && messages.length > 0 && isCitationPanelOpen && activeCitation && (
                        <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel"
                                    aria-label="Citations Panel">
                            <Stack
                                aria-label="Citations Panel Header Container"
                                horizontal
                                className={styles.citationPanelHeaderContainer}
                                horizontalAlign="space-between"
                                verticalAlign="center">
                <span aria-label="Citations" className={styles.citationPanelHeader}>
                  Citations
                </span>
                                <IconButton
                                    iconProps={{iconName: 'Cancel'}}
                                    aria-label="Close citations panel"
                                    onClick={() => setIsCitationPanelOpen(false)}
                                />
                            </Stack>
                            <h5
                                className={styles.citationPanelTitle}
                                tabIndex={0}
                                title={
                                    activeCitation.url && !activeCitation.url.includes('blob.core')
                                        ? activeCitation.url
                                        : activeCitation.title ?? ''
                                }
                                onClick={() => onViewSource(activeCitation)}>
                                {activeCitation.title}
                            </h5>
                            <div tabIndex={0}>
                                <ReactMarkdown
                                    linkTarget="_blank"
                                    className={styles.citationPanelContent}
                                    children={DOMPurify.sanitize(activeCitation.content, {ALLOWED_TAGS: XSSAllowTags})}
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                />
                            </div>
                        </Stack.Item>
                    )}

                    {/* Panel de intents */}
                    {messages && messages.length > 0 && isIntentsPanelOpen && (
                        <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel"
                                    aria-label="Intents Panel">
                            <Stack
                                aria-label="Intents Panel Header Container"
                                horizontal
                                className={styles.citationPanelHeaderContainer}
                                horizontalAlign="space-between"
                                verticalAlign="center">
                <span aria-label="Intents" className={styles.citationPanelHeader}>
                  Intents
                </span>
                                <IconButton
                                    iconProps={{iconName: 'Cancel'}}
                                    aria-label="Close intents panel"
                                    onClick={() => setIsIntentsPanelOpen(false)}
                                />
                            </Stack>
                            <Stack horizontalAlign="space-between">
                                {appStateContext?.state?.answerExecResult[answerId]?.map((execResult: ExecResults, index) => (
                                    <Stack className={styles.exectResultList} verticalAlign="space-between">
                                        <><span>Intent:</span> <p>{execResult.intent}</p></>
                                        {execResult.search_query && <><span>Search Query:</span>
                                            <SyntaxHighlighter
                                                style={nord}
                                                wrapLines={true}
                                                lineProps={{style: {wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}}
                                                language="sql"
                                                PreTag="p">
                                                {execResult.search_query}
                                            </SyntaxHighlighter></>}
                                        {execResult.search_result && <><span>Search Result:</span>
                                            <p>{execResult.search_result}</p></>}
                                        {execResult.code_generated && <><span>Code Generated:</span>
                                            <SyntaxHighlighter
                                                style={nord}
                                                wrapLines={true}
                                                lineProps={{style: {wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}}
                                                language="python"
                                                PreTag="p">
                                                {execResult.code_generated}
                                            </SyntaxHighlighter>
                                        </>}
                                    </Stack>
                                ))}
                            </Stack>
                        </Stack.Item>
                    )}

                    {/* Panel de historial de chat */}
                    {appStateContext?.state.isChatHistoryOpen &&
                        appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured &&
                        <ChatHistoryPanel/>}
                </Stack>
            )}
        </div>
    )
}

export default Chat
