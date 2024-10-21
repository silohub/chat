import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppStateContext } from '../../state/AppProvider';
import MenuContent from './MenuContent';
import styles from './SidebarMenu.module.css';
import {Accordion, AccordionHeader, AccordionItem, AccordionPanel} from "@fluentui/react-components";
import {Stack} from "@fluentui/react";
import Contoso from "../../assets/Contoso.svg";

interface SidebarMenuProps {
    isMenuOpen: boolean;
    toggleMenu: () => void;
}

const SidebarMenuModule: React.FC<SidebarMenuProps> = ({ isMenuOpen, toggleMenu }) => {
    // @ts-ignore
    const { dispatch } = useContext(AppStateContext);
    const appStateContext = useContext(AppStateContext);
    const [ setIsAccordionOpen] = useState({ home: false, another: false });
    const menuRef = useRef<HTMLDivElement | null>(null);
    const ui = appStateContext?.state.frontendSettings?.ui;
    const [logo, setLogo] = useState('');

    const toggleAccordion = (section: string) => {
        // @ts-ignore
        setIsAccordionOpen((prevState) => ({ ...prevState, [section]: !prevState[section] }));
    };

    const handleOptionClick = (option: string) => {
        dispatch({ type: 'INJECT_QUESTION_TEXT', payload: option }); // Inyectamos el texto en el estado global
        toggleMenu(); // Cierra el menú cuando se hace clic en una opción
    };

    const menuSections = {
        home: { title: 'Tomás Hermanos', options: ['¿Quién es Tomás Hermanos?', '¿Cómo me puedo contactar?'] },
        another: { title: 'Otra empresa', options: ['¿Otra pregunta?'] },
    };

    useEffect(() => {
        if (!appStateContext?.state.isLoading) setLogo(ui?.logo || Contoso);
    }, [appStateContext?.state.isLoading]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target) && isMenuOpen) {
                toggleMenu();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen, toggleMenu]);

    return (
        <aside ref={menuRef} className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
            <Stack horizontalAlign="center" verticalAlign="center">
                <img src={logo} className={styles.headerIcon} alt="Logo" aria-hidden="true"/>
                <h1 className={styles.headerTitle}>{ui?.title}</h1>
            </Stack>
            <nav>
                <ul>
                    <Accordion multiple collapsible>
                        <AccordionItem value="home">
                            <AccordionHeader className={styles['accordion-header-custom']}>
                                {menuSections.home.title}
                            </AccordionHeader>
                            <AccordionPanel>
                                <MenuContent section={menuSections.home} onOptionClick={handleOptionClick} />
                            </AccordionPanel>
                        </AccordionItem>

                        <AccordionItem value="another">
                            <AccordionHeader className={styles['accordion-header-custom']}>
                                {menuSections.another.title}
                            </AccordionHeader>
                            <AccordionPanel>
                                <MenuContent section={menuSections.another} onOptionClick={handleOptionClick} />
                            </AccordionPanel>
                        </AccordionItem>
                    </Accordion>
                </ul>
            </nav>
        </aside>
    );
};

export default SidebarMenuModule;
