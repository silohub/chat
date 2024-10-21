import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppStateContext } from '../../state/AppProvider';
import MenuContent from './MenuContent';
import styles from './SidebarMenu.module.css';

interface SidebarMenuProps {
    isMenuOpen: boolean;
    toggleMenu: () => void;
}

const SidebarMenuModule: React.FC<SidebarMenuProps> = ({ isMenuOpen, toggleMenu }) => {
    // @ts-ignore
    const { dispatch } = useContext(AppStateContext); // Usamos el dispatch del contexto
    const [isAccordionOpen, setIsAccordionOpen] = useState({ home: false, another: false });
    const menuRef = useRef<HTMLDivElement | null>(null);

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
            <nav>
                <ul>
                    <li>
                        <button
                            onClick={() => toggleAccordion('home')}
                            className={`${styles.accordionButton} ${isAccordionOpen.home ? styles.open : ''}`}
                        >
                            {menuSections.home.title}
                        </button>
                        <div className={`${styles.submenu} ${isAccordionOpen.home ? styles.open : ''}`}>
                            {isAccordionOpen.home && (
                                <MenuContent section={menuSections.home} onOptionClick={handleOptionClick} />
                            )}
                        </div>
                    </li>
                    <li>
                        <button
                            onClick={() => toggleAccordion('another')}
                            className={`${styles.accordionButton} ${isAccordionOpen.another ? styles.open : ''}`}
                        >
                            {menuSections.another.title}
                        </button>
                        <div className={`${styles.submenu} ${isAccordionOpen.another ? styles.open : ''}`}>
                            {isAccordionOpen.another && (
                                <MenuContent section={menuSections.another} onOptionClick={handleOptionClick} />
                            )}
                        </div>
                    </li>
                </ul>
            </nav>
        </aside>
    );
};

export default SidebarMenuModule;
