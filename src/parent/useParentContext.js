import { useContext } from 'react';
import ParentContext from './ParentContext';

export default function useParentContext() {
    const context = useContext(ParentContext);

    if (!context) {
        throw new Error('useParentContext must be used within a ParentProvider');
    }

    return context;
}