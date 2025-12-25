import { useContext } from 'react';
import ParentContext from './ParentContext';

export default function useParentContext() {
    const context = useContext(ParentContext);

    if (!context) {
        return {
            activeStudentId: null,
            studentIds: [],
            loading: false,
            setActiveStudentId: async () => {},
        };
    }

    return context;
}