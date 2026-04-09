import { formatClassLabel, isClosedClass } from '../../utils/classStatus';
import {
    buildStudentParentPhoneLast4Map,
    formatStudentNameWithOptionalParentLast4,
} from '../../utils/parentPhone';

const normalizeText = (value) => String(value || '').trim();
const lower = (value) => normalizeText(value).toLowerCase();

const getStudentClassIds = (student) => {
    if (Array.isArray(student?.classIds)) return student.classIds.map(String);
    if (Array.isArray(student?.classes)) return student.classes.map(String);
    return [];
};

const pickRepresentativeClass = (student, classMap) => {
    const classIds = getStudentClassIds(student);
    if (!classIds.length) return null;

    const linkedClasses = classIds
        .map((classId) => classMap.get(String(classId)) || null)
        .filter(Boolean);

    if (!linkedClasses.length) return null;

    const ongoing = linkedClasses.find((classDoc) => !isClosedClass(classDoc));
    return ongoing || linkedClasses[0] || null;
};

export const getMessengerTargetDisplayName = ({
    user,
    role,
    studentById = new Map(),
    parentLast4Map = {},
}) => {
    if (!user) return '';

    if (role === 'student') {
        return formatStudentNameWithOptionalParentLast4(user, parentLast4Map)
            || normalizeText(user?.name)
            || normalizeText(user?.studentName)
            || normalizeText(user?.id)
            || normalizeText(user?.authUid);
    }

    const directName =
        normalizeText(user?.name)
        || normalizeText(user?.displayName)
        || normalizeText(user?.parentName);

    if (directName) return directName;

    const linkedStudentIds = Array.isArray(user?.studentIds) ? user.studentIds.map(String) : [];
    const linkedStudent = linkedStudentIds
        .map((studentId) => studentById.get(studentId))
        .find(Boolean);

    if (linkedStudent) {
        const baseName = normalizeText(linkedStudent?.name)
            || normalizeText(linkedStudent?.studentName)
            || normalizeText(linkedStudent?.id);
        if (baseName) return `${baseName} 학부모`;
    }

    const fallback = normalizeText(user?.id) || normalizeText(user?.authUid) || 'Unknown parent';
    console.warn('[internal-messenger] parent display name fallback id exposed', {
        parentId: user?.id || null,
        authUid: user?.authUid || null,
    });
    return fallback;
};

export const sortMessengerTargets = (targets = []) => {
    const rank = (role) => (role === 'student' ? 0 : 1);

    return [...targets].sort((left, right) => {
        const roleDiff = rank(left?.role) - rank(right?.role);
        if (roleDiff !== 0) return roleDiff;

        return String(right?.displayName || '').localeCompare(String(left?.displayName || ''), 'ko');
    });
};

export const buildMessengerTargets = ({ students = [], parents = [], classes = [] }) => {
    const safeStudents = Array.isArray(students) ? students : [];
    const safeParents = Array.isArray(parents) ? parents : [];
    const safeClasses = Array.isArray(classes) ? classes : [];

    const classMap = new Map(safeClasses.map((classDoc) => [String(classDoc?.id), classDoc]));
    const studentById = new Map(safeStudents.map((student) => [String(student?.id), student]));
    const parentLast4Map = buildStudentParentPhoneLast4Map(safeStudents, safeParents);

    const studentOptions = safeStudents
        .filter((student) => student?.authUid)
        .map((student) => {
            const representativeClass = pickRepresentativeClass(student, classMap);
            const classLabel = representativeClass
                ? formatClassLabel(representativeClass, { includeClosedBadge: true })
                : '미분류';

            const displayName = getMessengerTargetDisplayName({
                user: student,
                role: 'student',
                studentById,
                parentLast4Map,
            });

            return {
                authUid: String(student.authUid),
                role: 'student',
                displayName,
                searchText: `${lower(displayName)} ${lower(student?.name)} ${lower(classLabel)}`,
                classId: representativeClass?.id ? String(representativeClass.id) : null,
                classLabel,
                classClosed: representativeClass ? isClosedClass(representativeClass) : false,
                userDocId: student?.id ? String(student.id) : null,
                studentId: student?.id ? String(student.id) : null,
                parentId: null,
            };
        });

    const parentOptions = safeParents
        .filter((parent) => parent?.authUid)
        .map((parent) => {
            const displayName = getMessengerTargetDisplayName({
                user: parent,
                role: 'parent',
                studentById,
                parentLast4Map,
            });

            return {
                authUid: String(parent.authUid),
                role: 'parent',
                displayName,
                searchText: lower(displayName),
                classId: null,
                classLabel: null,
                classClosed: false,
                userDocId: parent?.id ? String(parent.id) : null,
                studentId: null,
                parentId: parent?.id ? String(parent.id) : null,
            };
        });

    const merged = [...studentOptions, ...parentOptions];
    const uniqueMap = new Map();
    merged.forEach((target) => {
        if (!uniqueMap.has(target.authUid)) uniqueMap.set(target.authUid, target);
    });

    return sortMessengerTargets(Array.from(uniqueMap.values()));
};

export const groupStudentTargetsByClass = (targets = [], classes = []) => {
    const safeClasses = Array.isArray(classes) ? classes : [];
    const classMap = new Map(safeClasses.map((classDoc) => [String(classDoc?.id), classDoc]));

    const grouped = new Map();
    (Array.isArray(targets) ? targets : []).forEach((target) => {
        if (target?.role !== 'student') return;
        const classKey = target?.classId ? String(target.classId) : '__unclassified__';
        if (!grouped.has(classKey)) {
            const classDoc = classMap.get(classKey) || null;
            grouped.set(classKey, {
                key: classKey,
                classDoc,
                title: classDoc
                    ? formatClassLabel(classDoc, { includeClosedBadge: true })
                    : '미분류',
                items: [],
            });
        }
        grouped.get(classKey).items.push(target);
    });

    const sections = Array.from(grouped.values());
    sections.forEach((section) => {
        section.items = section.items.sort((left, right) => (
            String(right?.displayName || '').localeCompare(String(left?.displayName || ''), 'ko')
        ));
    });

    return sections.sort((left, right) => {
        if (left.key === '__unclassified__') return 1;
        if (right.key === '__unclassified__') return -1;

        const leftClosed = left.classDoc ? isClosedClass(left.classDoc) : true;
        const rightClosed = right.classDoc ? isClosedClass(right.classDoc) : true;
        if (leftClosed !== rightClosed) return leftClosed ? 1 : -1;

        return String(left.title || '').localeCompare(String(right.title || ''), 'ko');
    });
};