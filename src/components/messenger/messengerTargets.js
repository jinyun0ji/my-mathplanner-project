import { formatClassLabel, isClosedClass } from '../../utils/classStatus';
import {
    buildStudentParentPhoneLast4Map,
    formatStudentNameWithOptionalParentLast4,
} from '../../utils/parentPhone';

const normalizeText = (value) => String(value || '').trim();
const lower = (value) => normalizeText(value).toLowerCase();
const compareDisplayNameAsc = (left, right) => (
    String(left?.displayName || '').localeCompare(String(right?.displayName || ''), 'ko')
);
const STAFF_ROLE_LABEL_MAP = {
    admin: '운영자',
    staff: '운영자',
    teacher: '강사',
    teaching: '강사',
};

const ENDED_STATUS_KEYWORDS = [
    '퇴원',
    '전반',
    '종강',
    'inactive',
    'withdraw',
    'ended',
    '종료',
];

const isEndedStatus = (value) => {
    const text = lower(value);
    if (!text) return false;
    return ENDED_STATUS_KEYWORDS.some((keyword) => text.includes(keyword));
};

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

const appendParentSuffix = (name) => {
    const normalized = normalizeText(name);
    if (!normalized) return '';
    return normalized.endsWith('학부모') ? normalized : `${normalized} 학부모`;
};

const hasParentSuffix = (value) => normalizeText(value).includes('학부모');

const getArrayField = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
const getAuthUid = (user) => normalizeText(user?.authUid || user?.uid || user?.studentAuthUid || user?.studentUid || user?.parentUid);
const getUserName = (user) => normalizeText(user?.name) || normalizeText(user?.displayName) || normalizeText(user?.studentName);

const getRoomStudentIds = (room) => [
    normalizeText(room?.studentId),
    ...getArrayField(room?.studentIds),
].filter(Boolean);

const getRoomParentIds = (room) => [
    normalizeText(room?.parentId),
    normalizeText(room?.parentUid),
    ...getArrayField(room?.parentUids),
].filter(Boolean);

const getStudentNameFromIds = (studentIds, studentById) => (
    studentIds.map((studentId) => studentById.get(String(studentId))).find(Boolean)?.name
    || ''
);

const isParentRole = (role) => ['parent', 'guardian', '학부모'].includes(lower(role));

const hasParentRoomHint = (room, counterpartyUid = '') => {
    const roleValues = room?.participantRoles && typeof room.participantRoles === 'object'
        ? Object.values(room.participantRoles)
        : [];
    const counterpartyRole = counterpartyUid && room?.participantRoles
        ? room.participantRoles[counterpartyUid]
        : '';
    return isParentRole(counterpartyRole)
        || roleValues.some(isParentRole)
        || getRoomParentIds(room).length > 0
        || Boolean(room?.parentName);
};

const getParticipantNameByRole = (room, roleMatcher) => {
    const roles = room?.participantRoles && typeof room.participantRoles === 'object' ? room.participantRoles : {};
    const names = room?.participantNames && typeof room.participantNames === 'object' ? room.participantNames : {};
    const matchedUid = Object.keys(roles).find((uid) => roleMatcher(roles[uid]));
    return matchedUid ? normalizeText(names[matchedUid]) : '';
};

const resolveParentRoomDisplayName = (room, parent, studentById) => {
    const participantParentName = getParticipantNameByRole(room, isParentRole);
    if (participantParentName) return hasParentSuffix(participantParentName) ? participantParentName : appendParentSuffix(participantParentName);

    const parentName = normalizeText(room?.parentName)
        || normalizeText(room?.counterpartName)
        || normalizeText(parent?.parentName)
        || normalizeText(parent?.name)
        || normalizeText(parent?.displayName);
    if (parentName) return hasParentSuffix(parentName) ? parentName : appendParentSuffix(parentName);

    const studentName = normalizeText(room?.studentName)
        || getStudentNameFromIds(getRoomStudentIds(room), studentById);
    if (studentName) return appendParentSuffix(studentName);

    return '이름 미등록 학부모';
};

const buildUserLookups = ({ students = [], parents = [] }) => {
    const safeStudents = Array.isArray(students) ? students : [];
    const safeParents = Array.isArray(parents) ? parents : [];
    const studentById = new Map();
    const studentByAuthUid = new Map();
    safeStudents.forEach((student) => {
        [student?.id, student?.studentId, student?.docId].filter(Boolean).forEach((id) => studentById.set(String(id), student));
        [student?.authUid, student?.uid, student?.studentAuthUid, student?.studentUid].filter(Boolean).forEach((uid) => studentByAuthUid.set(String(uid), student));
    });
    const parentById = new Map();
    const parentByAuthUid = new Map();
    safeParents.forEach((parent) => {
        [parent?.id, parent?.parentId, parent?.docId].filter(Boolean).forEach((id) => parentById.set(String(id), parent));
        [parent?.authUid, parent?.uid, parent?.parentUid].filter(Boolean).forEach((uid) => parentByAuthUid.set(String(uid), parent));
    });
    const parentLast4Map = buildStudentParentPhoneLast4Map(safeStudents, safeParents);

    return {
        studentById,
        studentByAuthUid,
        parentById,
        parentByAuthUid,
        parentLast4Map,
    };
};


const getRoomType = (room) => normalizeText(room?.roomType || room?.channel);

const getStudentDisplayNameForRoom = (room, { studentById, studentByAuthUid, parentLast4Map }) => {
    const directStudent = getRoomStudentIds(room).map((studentId) => studentById.get(String(studentId)) || studentByAuthUid.get(String(studentId))).find(Boolean)
        || (room?.studentDocId ? studentById.get(String(room.studentDocId)) : null);
    const directName = getUserName(directStudent) || normalizeText(room?.studentName);
    if (directName) return directName;

    const roles = room?.participantRoles && typeof room.participantRoles === 'object' ? room.participantRoles : {};
    const userDocIds = room?.participantUserDocIds && typeof room.participantUserDocIds === 'object' ? room.participantUserDocIds : {};
    const participantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];
    const roleStudentId = Object.keys(roles).find((uid) => lower(roles[uid]) === 'student');
    const roleStudent = roleStudentId ? (studentByAuthUid.get(roleStudentId) || studentById.get(String(userDocIds[roleStudentId] || ''))) : null;
    const participantStudent = roleStudent || participantIds.map((participantId) => studentByAuthUid.get(participantId) || studentById.get(String(userDocIds[participantId] || ''))).find(Boolean);
    const participantName = roleStudentId ? normalizeText(room?.participantNames?.[roleStudentId]) : '';
    if (!participantStudent && participantName) return participantName;
    if (!participantStudent) return '';

    return getMessengerTargetDisplayName({
        user: participantStudent,
        role: 'student',
        studentById,
        parentLast4Map,
    });
};

const getStandardRoomDisplayTitle = (room, contextData = {}) => {
    const roomType = getRoomType(room);
    if (!['student_teacher', 'parent_teacher', 'student_institute', 'parent_institute'].includes(roomType)) return '';

    const { studentById, studentByAuthUid, parentById, parentByAuthUid, parentLast4Map } = buildUserLookups({
        students: contextData.students || [],
        parents: contextData.parents || [],
    });
    const studentName = getStudentDisplayNameForRoom(room, { studentById, studentByAuthUid, parentLast4Map });
    if (roomType === 'parent_teacher' || roomType === 'parent_institute') {
        const parentIds = getRoomParentIds(room);
        const parent = parentIds
            .map((parentId) => parentById.get(String(parentId)) || parentByAuthUid.get(String(parentId)))
            .find(Boolean) || null;
        return studentName ? appendParentSuffix(studentName) : resolveParentRoomDisplayName(room, parent, studentById);
    }
    return studentName || '이름 미등록 학생';
};

const resolveCounterpartyUid = (room, currentUserId) => {
    const participantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];
    if (!participantIds.length) return null;
    return participantIds.find((uid) => uid !== String(currentUserId || '')) || participantIds[0] || null;
};

export const getMessengerTargetDisplayName = ({
    user,
    role,
    studentById = new Map(),
    parentLast4Map = {},
}) => {
    if (!user) return '';

    if (role === 'student') {
        return normalizeText(user?.name)
            || normalizeText(user?.displayName)
            || formatStudentNameWithOptionalParentLast4(user, parentLast4Map)
            || '이름 미등록 학생';
    }

    const linkedStudentIds = Array.isArray(user?.studentIds) ? user.studentIds.map(String) : [];
    const linkedStudent = linkedStudentIds
        .map((studentId) => studentById.get(studentId))
        .find(Boolean);

    if (role === 'parent' && linkedStudent) {
        const baseName = normalizeText(linkedStudent?.name)
            || normalizeText(linkedStudent?.studentName)
            || normalizeText(linkedStudent?.id);
        if (baseName) return appendParentSuffix(baseName);
    }

    const directName =
        normalizeText(user?.name)
        || normalizeText(user?.displayName)
        || normalizeText(user?.parentName);

    if (role === 'parent' && directName) return appendParentSuffix(directName);
    if (directName) return directName;

    if (role === 'parent') {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[internal-messenger] parent display name fallback', {
                parentId: user?.id || null,
                authUid: user?.authUid || null,
            });
        }
        return '이름 미등록 학부모';
    }

    return '이름 미등록 사용자';
};

export const getChatRoomCounterparty = (
    room,
    currentUserId,
    students = [],
    parents = [],
) => {
    const counterpartyUid = resolveCounterpartyUid(room, currentUserId);
    if (!counterpartyUid) return null;

    const {
        studentById,
        studentByAuthUid,
        parentById,
        parentByAuthUid,
        parentLast4Map,
    } = buildUserLookups({ students, parents });

    const participantRoles = room?.participantRoles || {};
    const participantUserDocIds = room?.participantUserDocIds || {};
    const roleHint = normalizeText(participantRoles[counterpartyUid]).toLowerCase();
    const userDocIdHint = normalizeText(participantUserDocIds[counterpartyUid]);

    const parent =
        parentByAuthUid.get(counterpartyUid)
        || (userDocIdHint ? parentById.get(userDocIdHint) : null)
        || getRoomParentIds(room).map((parentId) => parentById.get(String(parentId)) || parentByAuthUid.get(String(parentId))).find(Boolean)
        || null;

    if (hasParentRoomHint(room, counterpartyUid) || parent) {
        return {
            uid: counterpartyUid,
            role: 'parent',
            user: parent,
            displayName: resolveParentRoomDisplayName(room, parent, studentById),
        };
    }

    const student =
        studentByAuthUid.get(counterpartyUid)
        || (userDocIdHint ? studentById.get(userDocIdHint) : null)
        || (room?.studentId ? studentById.get(String(room.studentId)) : null);

    if (student) {
        return {
            uid: counterpartyUid,
            role: 'student',
            user: student,
            displayName: getMessengerTargetDisplayName({
                user: student,
                role: 'student',
                studentById,
                parentLast4Map,
            }),
        };
    }

    const hintedName = normalizeText(room?.participantNames?.[counterpartyUid]);
    const resolvedRole = roleHint || 'staff';
    const roleLabel = STAFF_ROLE_LABEL_MAP[resolvedRole] || '담당자';
    if (process.env.NODE_ENV === 'development') {
        console.warn('[internal-messenger] counterparty profile unresolved', {
            roomId: room?.id || null,
            counterpartyUid,
            roleHint: roleHint || null,
            userDocIdHint: userDocIdHint || null,
        });
    }

    return {
        uid: counterpartyUid,
        role: resolvedRole,
        user: null,
        displayName: hintedName || roleLabel,
    };
};

export const getChatRoomDisplayTitle = (room, currentUserId, contextData = {}) => {
    const standardTitle = getStandardRoomDisplayTitle(room, contextData);
    if (standardTitle) return standardTitle;

    const counterparty = getChatRoomCounterparty(
        room,
        currentUserId,
        contextData.students || [],
        contextData.parents || [],
    );

    if (counterparty?.displayName) return counterparty.displayName;

    if (process.env.NODE_ENV === 'development') {
        console.warn('[internal-messenger] chat room title fallback used', {
            roomId: room?.id || null,
            currentUserId: currentUserId || null,
        });
    }
    return '대화 상대 미확인';
};

export const sortMessengerTargets = (targets = []) => {
    const rank = (role) => (role === 'student' ? 0 : 1);

    return [...targets].sort((left, right) => {
        const roleDiff = rank(left?.role) - rank(right?.role);
        if (roleDiff !== 0) return roleDiff;

        return compareDisplayNameAsc(left, right);
    });
};

export const isWithdrawnStudent = (student = {}) => {
    if (isEndedStatus(student?.status)) return true;

    const classStatusMap = student?.classStatusMap || {};
    const mapStatuses = Object.values(classStatusMap)
        .map((entry) => entry?.status || entry)
        .filter(Boolean);

    const classStatuses = student?.classStatuses || {};
    const classStatusesValues = Object.values(classStatuses).filter(Boolean);

    const mergedStatuses = [...mapStatuses, ...classStatusesValues];
    if (!mergedStatuses.length) return false;

    return mergedStatuses.every((status) => isEndedStatus(status));
};

export const buildMessengerTargets = ({ students = [], parents = [], classes = [] }) => {
    const safeStudents = Array.isArray(students) ? students : [];
    const safeParents = Array.isArray(parents) ? parents : [];
    const safeClasses = Array.isArray(classes) ? classes : [];

    const classMap = new Map(safeClasses.map((classDoc) => [String(classDoc?.id), classDoc]));
    const studentById = new Map(safeStudents.map((student) => [String(student?.id), student]));
    const parentLast4Map = buildStudentParentPhoneLast4Map(safeStudents, safeParents);

    const studentOptions = safeStudents
        .map((student) => {
            const authUid = getAuthUid(student);
            if (!authUid) return null;
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
                authUid: String(authUid),
                role: 'student',
                displayName,
                searchText: `${lower(displayName)} ${lower(student?.name)} ${lower(classLabel)}`,
                classId: representativeClass?.id ? String(representativeClass.id) : null,
                classLabel,
                classClosed: representativeClass ? isClosedClass(representativeClass) : false,
                userDocId: student?.id ? String(student.id) : null,
                studentId: student?.id ? String(student.id) : null,
                parentId: null,
                isWithdrawn: isWithdrawnStudent(student),
            };
        })
        .filter(Boolean);

    const parentOptions = safeParents
        .map((parent) => {
            const authUid = getAuthUid(parent);
            if (!authUid) return null;
            const displayName = getMessengerTargetDisplayName({
                user: parent,
                role: 'parent',
                studentById,
                parentLast4Map,
            });

            const linkedStudentIds = Array.isArray(parent?.studentIds) ? parent.studentIds.map(String) : [parent?.studentId, parent?.linkedStudentId].filter(Boolean).map(String);
            const linkedStudent = linkedStudentIds.map((studentId) => studentById.get(studentId)).find(Boolean);
            return {
                authUid: String(authUid),
                role: 'parent',
                displayName,
                searchText: `${lower(displayName)} ${lower(linkedStudent?.name)} ${lower(linkedStudent?.displayName)}`,
                classId: null,
                classLabel: null,
                classClosed: false,
                userDocId: parent?.id ? String(parent.id) : null,
                studentId: linkedStudent?.id ? String(linkedStudent.id) : (linkedStudentIds[0] || null),
                parentId: parent?.id ? String(parent.id) : null,
            };
        })
        .filter(Boolean);

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
        section.items = section.items.sort(compareDisplayNameAsc);
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

export const splitStudentTargetsByStatus = (targets = []) => {
    const safeTargets = Array.isArray(targets) ? targets : [];
    const active = [];
    const withdrawn = [];

    safeTargets.forEach((target) => {
        if (target?.role !== 'student') return;
        if (target?.isWithdrawn) {
            withdrawn.push(target);
            return;
        }
        active.push(target);
    });

    return {
        active: active.sort(compareDisplayNameAsc),
        withdrawn: withdrawn.sort(compareDisplayNameAsc),
    };
};