// Importaciones necesarias
import { useRef, useState, useEffect, useContext, useLayoutEffect } from 'react'
import { CommandBarButton, IconButton, Dialog, DialogType, Stack } from '@fluentui/react'
import { SquareRegular, ShieldLockRegular, ErrorCircleRegular } from '@fluentui/react-icons'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import uuid from 'react-uuid'
import { isEmpty } from 'lodash'
import DOMPurify from 'dompurify'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism'

import styles from './Chat.module.css'
import Contoso from '../../assets/Contoso.svg'
import { XSSAllowTags } from '../../constants/sanatizeAllowables'

import {
  ChatMessage,
  ConversationRequest,
  conversationApi,
  Citation,
  ToolMessageContent,
  AzureSqlServerExecResults,
  ChatResponse,
  getUserInfo,
  Conversation,
  historyGenerate,
  historyUpdate,
  historyClear,
  ChatHistoryLoadingState,
  CosmosDBStatus,
  ErrorMessage,
  ExecResults,
} from "../../api";
import { Answer } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ChatHistoryPanel } from "../../components/ChatHistory/ChatHistoryPanel";
import { AppStateContext } from "../../state/AppProvider";
import { useBoolean } from "@fluentui/react-hooks";

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
  const ui = appStateContext?.state.frontendSettings?.ui
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

  const [hideErrorDialog, { toggle: toggleErrorDialog }] = useBoolean(true)
  const [errorMsg, setErrorMsg] = useState<ErrorMessage | null>()
  const [logo, setLogo] = useState('')
  const [answerId, setAnswerId] = useState<string>('')
  // @ts-ignore
  const { state, dispatch } = useContext(AppStateContext);
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
    styles: { main: { maxWidth: 450 } }
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
      setLogo(ui?.chat_logo || ui?.logo || Contoso)
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
    const userInfoList = await getUserInfo()
    if (userInfoList.length === 0 && window.location.hostname !== '127.0.0.1') {
      setShowAuthMessage(true)
    } else {
      setShowAuthMessage(false)
    }
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
    appStateContext?.dispatch({ type: 'SET_ANSWER_EXEC_RESULT', payload: { answerId: answerId, exec_result: exec_results } })
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
      assistantMessage = { ...assistantMessage, ...resultMessage }
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

  // Función de llamada a la API sin CosmosDB
  const makeApiRequestWithoutCosmosDB = async (question: ChatMessage["content"], conversationId?: string) => {
    setIsLoading(true)
    setShowLoadingMessage(true)
    const abortController = new AbortController()
    abortFuncs.current.unshift(abortController)

    // Resto del código que gestiona el proceso de llamada a la API
    // ...
  }

  // Función de llamada a la API con CosmosDB
  const makeApiRequestWithCosmosDB = async (question: ChatMessage["content"], conversationId?: string) => {
    setIsLoading(true)
    setShowLoadingMessage(true)
    const abortController = new AbortController()
    abortFuncs.current.unshift(abortController)

    // Resto del código que gestiona el proceso de llamada a la API con CosmosDB
    // ...
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
        appStateContext?.dispatch({ type: 'UPDATE_CHAT_HISTORY', payload: appStateContext?.state.currentChat })
        setActiveCitation(undefined)
        setIsCitationPanelOpen(false)
        setIsIntentsPanelOpen(false)
        setMessages([])
      }
    }
    setClearingChat(false)
  }

  // Función para obtener los errores en formato específico de RAI
  const tryGetRaiPrettyError = (errorMessage: string) => {
    // Proceso de parsing de errores
    // ...
  }

  const parseErrorMessage = (errorMessage: string) => {
    // Proceso para parsear errores con formato específico
    // ...
  }

  // Función para iniciar un nuevo chat
  const newChat = () => {
    setProcessMessages(messageStatus.Processing)
    setMessages([])
    setIsCitationPanelOpen(false)
    setIsIntentsPanelOpen(false)
    setActiveCitation(undefined)
    appStateContext?.dispatch({ type: 'UPDATE_CURRENT_CHAT', payload: null })
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

    // Condiciones para guardar los mensajes según el estado de CosmosDB y de la aplicación
    // ...
  }, [processMessages])

  // Efecto para obtener la información del usuario si la autenticación está habilitada
  useEffect(() => {
    if (AUTH_ENABLED !== undefined) getUserInfoList()
  }, [AUTH_ENABLED])

  // Scroll automático al final del chat
  useLayoutEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: 'smooth' })
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
      }
      catch {
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

  // Renderizado del componente
  return (
      <div className={styles.container} role="main">
        {/* Mostrar mensaje de autenticación */}
        {showAuthMessage ? (
            <Stack className={styles.chatEmptyState}>
              <ShieldLockRegular
                  className={styles.chatIcon}
                  style={{ color: 'darkorange', height: '200px', width: '200px' }}
              />
              <h1 className={styles.chatEmptyStateTitle}>Authentication Not Configured</h1>
              <h2 className={styles.chatEmptyStateSubtitle}>
                This app does not have authentication configured. Please add an identity provider by finding your app in the{' '}
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
                      <img src={logo} className={styles.chatIcon} aria-hidden="true" />
                      <h1 className={styles.chatEmptyStateTitle}>{ui?.chat_title}</h1>
                      <h2 className={styles.chatEmptyStateSubtitle}>{ui?.chat_description}</h2>
                    </Stack>
                ) : (
                    <div className={styles.chatMessageStream} style={{ marginBottom: isLoading ? '40px' : '0px' }} role="log">
                      {messages.map((answer, index) => (
                          <>
                            {answer.role === 'user' ? (
                                <div className={styles.chatMessageUser} tabIndex={0}>
                                  <div className={styles.chatMessageUserMessage}>
                                    {typeof answer.content === "string" && answer.content ? answer.content : Array.isArray(answer.content) ? <>{answer.content[0].text} <img className={styles.uploadedImageChat} src={answer.content[1].image_url.url} alt="Uploaded Preview" /></> : null}
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
                                    <ErrorCircleRegular className={styles.errorIcon} style={{ color: 'rgba(182, 52, 67, 1)' }} />
                                    <span>Error</span>
                                  </Stack>
                                  <span className={styles.chatMessageErrorContent}>{typeof answer.content === "string" && answer.content}</span>
                                </div>
                            ) : null}
                          </>
                      ))}
                      {showLoadingMessage && (
                          <>
                            <div className={styles.chatMessageGpt}>
                              <Answer
                                  answer={{
                                    answer: "Generating answer...",
                                    citations: [],
                                    generated_chart: null
                                  }}
                                  onCitationClicked={() => null}
                                  onExectResultClicked={() => null}
                              />
                            </div>
                          </>
                      )}
                      <div ref={chatMessageStreamEnd} />
                    </div>
                )}

                {/* Panel de entrada de preguntas */}
                <Stack horizontal className={styles.chatInput}>
                  {isLoading && messages.length > 0 && (
                      <Stack
                          horizontal
                          className={styles.stopGeneratingContainer}
                          role="button"
                          aria-label="Stop generating"
                          tabIndex={0}
                          onClick={stopGenerating}
                          onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? stopGenerating() : null)}>
                        <SquareRegular className={styles.stopGeneratingIcon} aria-hidden="true" />
                        <span className={styles.stopGeneratingText} aria-hidden="true">
                    Stop generating
                  </span>
                      </Stack>
                  )}
                  <Stack>
                    {/* Botones para nuevo chat y limpiar chat */}
                    <CommandBarButton
                        role="button"
                        styles={{
                          icon: {
                            color: '#FFFFFF'
                          },
                          iconDisabled: {
                            color: '#BDBDBD !important'
                          },
                          root: {
                            color: '#FFFFFF',
                            background:
                                'radial-gradient(109.81% 107.82% at 100.1% 90.19%, #0F6CBD 33.63%, #2D87C3 70.31%, #8DDDD8 100%)'
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
                        iconProps={{ iconName: 'Broom' }}
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
                      placeholder="Type a new question..."
                      disabled={false} // Puedes controlar el estado aquí
                      onSend={(question) => {
                        console.log('Sending question:', question);
                        dispatch({ type: 'INJECT_QUESTION_TEXT', payload: '' }); // Limpiamos el texto después de enviar
                      }}
                      initialValue={questionText} // Aquí pasamos el texto inyectado
                  />
                </Stack>
              </div>

              {/* Panel de citas */}
              {messages && messages.length > 0 && isCitationPanelOpen && activeCitation && (
                  <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Citations Panel">
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
                          iconProps={{ iconName: 'Cancel' }}
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
                          children={DOMPurify.sanitize(activeCitation.content, { ALLOWED_TAGS: XSSAllowTags })}
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                      />
                    </div>
                  </Stack.Item>
              )}

              {/* Panel de intents */}
              {messages && messages.length > 0 && isIntentsPanelOpen && (
                  <Stack.Item className={styles.citationPanel} tabIndex={0} role="tabpanel" aria-label="Intents Panel">
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
                          iconProps={{ iconName: 'Cancel' }}
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
                                  lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                                  language="sql"
                                  PreTag="p">
                                {execResult.search_query}
                              </SyntaxHighlighter></>}
                            {execResult.search_result && <><span>Search Result:</span> <p>{execResult.search_result}</p></>}
                            {execResult.code_generated && <><span>Code Generated:</span>
                              <SyntaxHighlighter
                                  style={nord}
                                  wrapLines={true}
                                  lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
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
                  appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && <ChatHistoryPanel />}
            </Stack>
        )}
      </div>
  )
}

export default Chat
