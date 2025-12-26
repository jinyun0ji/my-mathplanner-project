import { useEffect, useState } from 'react';
import { db } from '../firebase/client';
import { fetchClassStudents } from './studentLoader';

export const useClassStudents = (classId) => {
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isActive = true;

        const loadStudents = async () => {
            if (!classId) {
                if (isActive) {
                    setStudents([]);
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);

            try {
                const fetchedStudents = await fetchClassStudents(db, classId);
                if (isActive) {
                    console.log('👨‍🎓 fetched students', fetchedStudents);
                    setStudents(fetchedStudents);
                }
            } catch (error) {
                console.error('[useClassStudents] 학생 목록 로드 실패:', error);
                if (isActive) setStudents([]);
            } finally {
                if (isActive) setIsLoading(false);
            }
        };

        loadStudents();

        return () => {
            isActive = false;
        };
    }, [classId]);

    return { students, isLoading };
};