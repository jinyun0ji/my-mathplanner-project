import {
    collection,
    getDocs,
    query,
    where,
} from 'firebase/firestore';

export const fetchClassStudents = async (db, classId) => {
    if (!db || !classId) return [];
    const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'student'),
        where('classIds', 'array-contains', String(classId)),
    );
    const usersSnap = await getDocs(usersQuery);
    const fetchedStudents = usersSnap.docs.map((docSnap) => ({
        id: docSnap.data()?.uid ?? docSnap.id,
        ...docSnap.data(),
    }));
    return fetchedStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
};