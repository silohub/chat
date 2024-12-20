// SidebarMenuModule.tsx

import React, {useContext, useEffect, useRef, useState} from 'react';
import {AppStateContext} from '../../state/AppProvider';
import MenuContent from './MenuContent';
import styles from './SidebarMenu.module.css';
import {Accordion, AccordionHeader, AccordionItem, AccordionPanel} from "@fluentui/react-components";
import {Stack} from "@fluentui/react";
// @ts-ignore
import sectionsData from "../../assets/options.json";
import headerLogo from "../../assets/Logo-ctt.svg";
import primaryLogo from "../../assets/Logo-Tomas.svg";
import stickers from "../../assets/Stickers.png";
import {Person20Filled, Power20Filled} from "@fluentui/react-icons";

interface SidebarMenuProps {
    isMenuOpen: boolean;
    toggleMenu: () => void;
}

interface MenuSection {
    title: string;
    icon: string;
    options: string[];
}

interface Links {
    title: string;
    link: string;
}

const SidebarMenuModule: React.FC<SidebarMenuProps> = ({isMenuOpen, toggleMenu}) => {
    // Acceder al contexto global
    const appStateContext = useContext(AppStateContext);
    const {state, dispatch} = appStateContext || {};
    const {userName, userSurname, userEmail} = state || {}; // Extraer nombre y apellido
    const logout = appStateContext?.logout;

    const menuRef = useRef<HTMLDivElement | null>(null);
    const ui = state?.frontendSettings?.ui;
    const [logo, setLogo] = useState(''); // Estado para el logo
    const [mainLogo, setMainLogo] = useState('');
    const [stickerImg, setStickers] = useState('');
    const [menuSections, setMenuSections] = useState<MenuSection[]>([]); // Estado para las secciones del menú
    const [links, setLinks] = useState<Links[]>([]);

    // Maneja la opción seleccionada en el menú
    const handleOptionClick = (option: string) => {
        dispatch?.({type: 'INJECT_QUESTION_TEXT', payload: option}); // Inyecta el texto en el estado global
        toggleMenu(); // Cierra el menú cuando se hace clic en una opción
    };

    // Cargar secciones del archivo JSON al montar el componente
    useEffect(() => {
        setMenuSections(sectionsData.sections); // Asignar las secciones desde el archivo JSON
        // setLinks(sectionsData.links);
    }, []);

    // Cargar el logo cuando el estado de carga ha finalizado
    useEffect(() => {
        if (!state?.isLoading) {
            setLogo(headerLogo);
            setMainLogo(primaryLogo);
            setStickers(stickers);
        }
    }, [state?.isLoading]);

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

    const handleEditProfile = () => {
        if (appStateContext?.editProfile) {
            appStateContext.editProfile();
        }
    };

    return (
        <aside ref={menuRef} className={`${styles.sidebar} ${isMenuOpen ? styles.open : ''}`}>
            <Stack horizontal horizontalAlign="center" verticalAlign="center">
                <div className={styles.headerIconContainer}>
                    <img src={logo} className={styles.headerIcon} alt="Logo" aria-hidden="true"/>
                    <img src={mainLogo} className={styles.headerIcon} alt="Logo" aria-hidden="true"/>

                </div>
            </Stack>
            {/*<div className={styles.linksContainer}>*/}
            {/*    {links.map((link, index) => (*/}
            {/*        <a className={styles.links} href={link.link} target="_blank">*/}
            {/*            <div>{link.title}</div>*/}
            {/*            <ArrowUpRight20Filled/>*/}
            {/*        </a>*/}
            {/*    ))}*/}
            {/*</div>*/}
            <div className={styles.userInfo}>
                {userName && userSurname ?
                    <p className={styles.userName}>{userName} {userSurname}</p> :
                    <p className={styles.userName}>{userEmail} </p>}
                <div className={styles.optionsContainer}>
                    <span className={styles.options} onClick={handleEditProfile}><Person20Filled/>Perfil</span>
                    <span className={styles.options} onClick={logout}><Power20Filled/>Salir</span>
                </div>
            </div>
            <nav>
                <ul>
                    <Accordion multiple collapsible>
                        {menuSections.map((section, index) => (
                            <AccordionItem key={index} value={section.title} className="accordionItemCustom">
                                <AccordionHeader
                                    expandIconPosition="end"
                                    className={styles.accordionHeaderCustom}
                                >
                                    {/*<span className={styles.iconWrapper}>*/}
                                    {/*  {section.icon && (*/}
                                    {/*      <img*/}
                                    {/*          src={section.icon}*/}
                                    {/*          alt={`${section.title} icon`}*/}
                                    {/*          className={styles.iconImage}*/}
                                    {/*      />*/}
                                    {/*  )}*/}
                                    {/*</span>*/}
                                    {section.title}
                                </AccordionHeader>
                                <AccordionPanel>
                                    <MenuContent section={section} onOptionClick={handleOptionClick}/>
                                </AccordionPanel>
                            </AccordionItem>
                        ))}
                    </Accordion>
                    {/*<div className={styles.linksContainer}>*/}
                    {/*    <button className={styles.authButton} onClick={logout}>Cerrar Sesión</button>*/}
                    {/*</div>*/}
                </ul>
            </nav>
            <div className={styles.stickers}>
                <img src={stickerImg} className={styles.stickerImg} alt="Logo" aria-hidden="true"/>
            </div>
        </aside>
    );
};

export default SidebarMenuModule;
