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
        <Stack className={styles["menu-content"]} tokens={{ childrenGap: 10 }}>
            {section.options.map((option, index) => (
                <Button
                    key={index}
                    className={styles["menu-button"]}  // Aplicar clase personalizada
                    onClick={() => onOptionClick(option)}
                >
                    <Text>{option}</Text>
                </Button>
            ))}
        </Stack>
    );
};

export default MenuContent;
