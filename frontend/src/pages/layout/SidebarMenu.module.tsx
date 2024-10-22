import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppStateContext } from '../../state/AppProvider';
import MenuContent from './MenuContent';
import styles from './SidebarMenu.module.css';
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel } from "@fluentui/react-components";
import { Stack } from "@fluentui/react";
import Contoso from "../../assets/Contoso.svg";
// @ts-ignore
import sectionsData from "../../assets/options.json";
import headerLogo from "../../assets/CTT.jpg"
interface SidebarMenuProps {
    isMenuOpen: boolean;
    toggleMenu: () => void;
}

interface MenuSection {
    title: string;
    options: string[];
}

const SidebarMenuModule: React.FC<SidebarMenuProps> = ({ isMenuOpen, toggleMenu }) => {
    // Acceder al contexto global
    // @ts-ignore
    const { dispatch } = useContext(AppStateContext);
    const appStateContext = useContext(AppStateContext);

    const menuRef = useRef<HTMLDivElement | null>(null);
    const ui = appStateContext?.state.frontendSettings?.ui;

    const [logo, setLogo] = useState(''); // Estado para el logo
    const [menuSections, setMenuSections] = useState<MenuSection[]>([]); // Estado para las secciones del menú

    // Maneja la opción seleccionada en el menú
    const handleOptionClick = (option: string) => {
        dispatch({ type: 'INJECT_QUESTION_TEXT', payload: option }); // Inyecta el texto en el estado global
        toggleMenu(); // Cierra el menú cuando se hace clic en una opción
    };

    // Cargar secciones del archivo JSON al montar el componente
    useEffect(() => {
        setMenuSections(sectionsData.sections); // Asignar las secciones desde el archivo JSON
    }, []);

    // Cargar el logo cuando el estado de carga ha finalizado
    useEffect(() => {
        if (!appStateContext?.state.isLoading) setLogo(headerLogo);
    }, [appStateContext?.state.isLoading]);

    // Cerrar el menú cuando se hace clic fuera del área del menú
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
            <Stack  horizontal horizontalAlign="center" verticalAlign="center">
                <img src={logo} className={styles.headerIcon} alt="Logo" aria-hidden="true" />
                <h1 className={styles.headerTitle}>{ui?.title}</h1>
            </Stack>
            <nav>
                <ul>
                    <Accordion multiple collapsible>
                        {/* Mapear las secciones del JSON para generar los ítems del acordeón */}
                        {menuSections.map((section, index) => (
                            <AccordionItem key={index} value={section.title}>
                                <AccordionHeader
                                    expandIconPosition="end"
                                    className={styles.accordionHeaderCustom}>
                                    {section.title}
                                </AccordionHeader>
                                <AccordionPanel>
                                    <MenuContent section={section} onOptionClick={handleOptionClick} />
                                </AccordionPanel>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </ul>
            </nav>
        </aside>
    );
};

export default SidebarMenuModule;
