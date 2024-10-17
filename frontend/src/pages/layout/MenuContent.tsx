// MenuContent.tsx
import React from 'react';

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
        <ul>
            {section.options.map((option, index) => (
                <li key={index}>
                    <button onClick={() => onOptionClick(option)}>
                        {option}
                    </button>
                </li>
            ))}
        </ul>
    );
};

export default MenuContent;
