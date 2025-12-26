import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
} from 'firebase/firestore';

const chunkArray = (items, size = 10) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

export const fetchClassStudentUids = async (db, classId) => {
    if (!db || !classId) return [];
    const classRef = doc(db, 'classes', String(classId));
    const classSnap = await getDoc(classRef);

    if (!classSnap.exists()) return [];

    const { students: classStudentUids = [] } = classSnap.data() || {};
    console.log('📦 class.students', classStudentUids);
    if (!Array.isArray(classStudentUids) || classStudentUids.length === 0) return [];

    return [...new Set(classStudentUids.map((id) => String(id)).filter(Boolean))];
};

export const fetchClassStudents = async (db, classId) => {
    const studentUids = await fetchClassStudentUids(db, classId);
    if (studentUids.length === 0) return [];

    const chunks = chunkArray(studentUids, 10);
    const fetchedStudents = (
        await Promise.all(
            chunks.map(async (chunk) => {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('role', '==', 'student'),
                    where('uid', 'in', chunk),
                );
                const usersSnap = await getDocs(usersQuery);
                return usersSnap.docs.map((docSnap) => ({
                    id: docSnap.data()?.uid ?? docSnap.id,
                    ...docSnap.data(),
                }));
            }),
        )
    ).flat();

    return fetchedStudents.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
};