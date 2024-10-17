import React, { useContext, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Dialog, Stack, TextField } from '@fluentui/react';
import { CopyRegular } from '@fluentui/react-icons';
import { CosmosDBStatus } from '../../api';
import Contoso from '../../assets/Contoso.svg';
import { HistoryButton, ShareButton } from '../../components/common/Button';
import { AppStateContext } from '../../state/AppProvider';
import SidebarMenuModule from './SidebarMenu.module';
import styles from './Layout.module.css';

const Layout = () => {
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copyClicked, setCopyClicked] = useState(false);
  const [copyText, setCopyText] = useState('Copy URL');
  const [shareLabel, setShareLabel] = useState('Share');
  const [hideHistoryLabel, setHideHistoryLabel] = useState('Hide chat history');
  const [showHistoryLabel, setShowHistoryLabel] = useState('Show chat history');
  const [logo, setLogo] = useState('');
  const appStateContext = useContext(AppStateContext);
  const ui = appStateContext?.state.frontendSettings?.ui;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleShareClick = () => setIsSharePanelOpen(true);
  const handleSharePanelDismiss = () => {
    setIsSharePanelOpen(false);
    setCopyClicked(false);
    setCopyText('Copy URL');
  };
  const handleCopyClick = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyClicked(true);
  };
  const handleHistoryClick = () => appStateContext?.dispatch({ type: 'TOGGLE_CHAT_HISTORY' });

  useEffect(() => {
    if (!appStateContext?.state.isLoading) setLogo(ui?.logo || Contoso);
  }, [appStateContext?.state.isLoading]);

  useEffect(() => {
    if (copyClicked) setCopyText('Copied URL');
  }, [copyClicked]);

  return (
      <div className={styles.layout}>
        <button onClick={toggleMenu} className={`${styles.menuButton} ${isMenuOpen ? styles.hidden : ''}`}>
          ☰
        </button>

        {/* Menú lateral como componente separado */}
        <SidebarMenuModule isMenuOpen={isMenuOpen} toggleMenu={toggleMenu} />

        <header className={styles.header} role="banner">
          <Stack horizontal verticalAlign="center" horizontalAlign="space-between">
            <Stack horizontal verticalAlign="center">
              <img src={logo} className={styles.headerIcon} alt="Logo" aria-hidden="true" />
              <h1 className={styles.headerTitle}>{ui?.title}</h1>
            </Stack>
            <Stack horizontal tokens={{ childrenGap: 4 }} className={styles.shareButtonContainer}>
              {appStateContext?.state.isCosmosDBAvailable?.status !== CosmosDBStatus.NotConfigured && ui?.show_chat_history_button !== false && (
                  <HistoryButton
                      onClick={handleHistoryClick}
                      text={appStateContext?.state?.isChatHistoryOpen ? hideHistoryLabel : showHistoryLabel}
                  />
              )}
              {ui?.show_share_button && <ShareButton onClick={handleShareClick} text={shareLabel} />}
            </Stack>
          </Stack>
        </header>

        <Outlet />

        <Dialog
            onDismiss={handleSharePanelDismiss}
            hidden={!isSharePanelOpen}
            styles={{
              main: [{
                selectors: {
                  '@media (min-width: 480px)': {
                    maxWidth: '600px',
                    background: '#FFFFFF',
                    boxShadow: '0px 14px 28.8px rgba(0, 0, 0, 0.24), 0px 0px 8px rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    minHeight: '100px'
                  }
                }
              }]
            }}
            dialogContentProps={{
              title: 'Share the web app',
              showCloseButton: true
            }}
        >
          <Stack horizontal verticalAlign="center" style={{ gap: '8px' }}>
            <TextField className={styles.urlTextBox} defaultValue={window.location.href} readOnly />
            <div className={styles.copyButtonContainer} role="button" tabIndex={0} aria-label="Copy" onClick={handleCopyClick}>
              <CopyRegular className={styles.copyButton} />
              <span className={styles.copyButtonText}>{copyText}</span>
            </div>
          </Stack>
        </Dialog>
      </div>
  );
};

export default Layout;
