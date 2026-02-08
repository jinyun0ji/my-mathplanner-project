import React, { useState } from 'react';
import { Icon } from '../../utils/helpers';

export default function AccordionSection({
    title,
    rightSlot = null,
    defaultOpen = false,
    children,
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{title}</span>
                    {rightSlot}
                </div>
                <Icon
                    name="chevronDown"
                    className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                    {children}
                </div>
            )}
        </div>
    );
}