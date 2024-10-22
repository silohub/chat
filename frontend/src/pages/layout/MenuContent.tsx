// MenuContent.tsx
import React from 'react';
import {Stack, Text} from "@fluentui/react";
import {Button} from "@fluentui/react-components";
import styles from './MenuContent.module.css';
interface MenuSection {
    title: string;
    options: string[];
}

interface MenuContentProps {
    section: MenuSection;
    onOptionClick: (option: string) => void;
}

const MenuContent: React.FC<MenuContentProps> = ({ section, onOptionClick }) => {
    return (
        <Stack className={styles["menu-content"]} tokens={{ childrenGap: 4 }}>
            {section.options.map((option, index) => (
                <div
                    key={index}
                    className={styles["menu-button"]}
                    onClick={() => onOptionClick(option)}
                >
                   {option}
                </div>
            ))}
        </Stack>
    );
};

export default MenuContent;
