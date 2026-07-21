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

const appendStudentSuffix = (name) => {
    const normalized = normalizeText(name);
    if (!normalized) return '';
    return normalized.endsWith('학생') ? normalized : `${normalized} 학생`;
};

const isStaffRole = (role) => ['admin', 'staff', 'teacher', 'teaching', 'operator', '운영자', '강사'].includes(lower(role));
const isFallbackName = (name) => ['운영자', '이름 미등록', '이름 미등록 학생', '이름 미등록 학부모', '이름 미등록 학생 학부모'].includes(normalizeText(name));


const getArrayField = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
const getAuthUid = (user) => normalizeText(user?.authUid || user?.uid || user?.studentAuthUid || user?.studentUid || user?.parentUid);
const getUserName = (user) => normalizeText(user?.name) || normalizeText(user?.displayName) || normalizeText(user?.studentName) || normalizeText(user?.parentName);
const isExcludedStudent = (student = {}) => (
    student?.active === false
    || lower(student?.status) === 'withdrawn'
    || lower(student?.status) === 'deletion_requested'
);
const getParentRefsFromStudent = (student = {}) => {
    const refs = [];
    [student?.parentId, student?.parentUid, student?.parentDocId].filter(Boolean).forEach((id) => refs.push({ id: String(id), authUid: String(id) }));
    getArrayField(student?.parentIds).forEach((id) => refs.push({ id, authUid: id }));
    getArrayField(student?.parentUids).forEach((id) => refs.push({ id, authUid: id }));
    if (Array.isArray(student?.parents)) {
        student.parents.forEach((parent) => {
            if (typeof parent === 'string') refs.push({ id: parent, authUid: parent });
            else if (parent && typeof parent === 'object') {
                const authUid = getAuthUid(parent) || normalizeText(parent?.id) || normalizeText(parent?.parentId);
                const id = normalizeText(parent?.id) || normalizeText(parent?.parentId) || authUid;
                if (authUid || id) refs.push({ id, authUid: authUid || id });
            }
        });
    }
    const unique = new Map();
    refs.filter((ref) => ref.authUid || ref.id).forEach((ref) => {
        const key = `${ref.authUid || ''}|${ref.id || ''}`;
        if (!unique.has(key)) unique.set(key, ref);
    });
    return Array.from(unique.values());
};

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

const resolveParentRoomDisplayName = (room, parent, studentById) => {
    const parentName = getUserName(parent);
    if (parentName && !isFallbackName(parentName)) return appendParentSuffix(parentName);

    const explicitParentName = normalizeText(room?.parentName);
    if (explicitParentName && !isFallbackName(explicitParentName)) return appendParentSuffix(explicitParentName);

    const linkedStudentIds = Array.isArray(parent?.studentIds) ? parent.studentIds.map(String) : [parent?.studentId, parent?.linkedStudentId].filter(Boolean).map(String);
    const linkedStudentName = getStudentNameFromIds(linkedStudentIds, studentById);
    const studentName = linkedStudentName
        || normalizeText(room?.studentName)
        || getStudentNameFromIds(getRoomStudentIds(room), studentById);
    if (studentName && !isFallbackName(studentName)) return appendParentSuffix(studentName);

    return '이름 미등록 학부모';
};

const buildUserLookups = ({ students = [], parents = [] }) => {
    const safeStudents = Array.isArray(students) ? students : [];
    const safeParents = Array.isArray(parents) ? parents : [];
    const studentById = new Map();
    const studentByAuthUid = new Map();
    safeStudents.forEach((student) => {
        [student?.id, student?.studentId, student?.docId, student?.userDocId, student?.parentLinkedStudentId].filter(Boolean).forEach((id) => studentById.set(String(id), student));
        [student?.authUid, student?.uid, student?.studentAuthUid, student?.studentUid].filter(Boolean).forEach((uid) => studentByAuthUid.set(String(uid), student));
    });
    const parentById = new Map();
    const parentByAuthUid = new Map();
    safeParents.forEach((parent) => {
        [parent?.id, parent?.parentId, parent?.docId, parent?.userDocId].filter(Boolean).forEach((id) => parentById.set(String(id), parent));
        [parent?.authUid, parent?.uid, parent?.parentUid, parent?.userUid].filter(Boolean).forEach((uid) => parentByAuthUid.set(String(uid), parent));
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
const isStudentChatRoomType = (roomType) => ['student_teacher', 'student_institute'].includes(roomType);

const getStudentByAnyId = (studentId, { studentById, studentByAuthUid }) => {
    const normalizedId = normalizeText(studentId);
    if (!normalizedId) return null;
    return studentById.get(normalizedId) || studentByAuthUid.get(normalizedId) || null;
};

const safeJsonClone = (value) => {
    try {
        return JSON.parse(JSON.stringify(value ?? null));
    } catch (error) {
        return value ?? null;
    }
};

const buildStudentRoomDebugPayload = ({ room, resolution, displayName }) => {
    const student = resolution?.student || null;
    const studentAuthUid = normalizeText(getAuthUid(student)) || normalizeText(resolution?.uid) || null;
    const studentDocumentId = normalizeText(resolution?.studentId) || normalizeText(student?.id) || normalizeText(room?.studentDocId) || null;
    const studentName = student
        ? (normalizeText(student?.name) || normalizeText(student?.displayName) || normalizeText(student?.studentName) || null)
        : (normalizeText(resolution?.participantName) || normalizeText(room?.studentName) || null);

    return {
        '==================== ROOM RAW DATA ====================': true,
        roomId: room?.id || null,
        room: safeJsonClone(room),
        'room.studentId': normalizeText(room?.studentId) || null,
        'room.studentDocId': normalizeText(room?.studentDocId) || null,
        'room.studentIds': getArrayField(room?.studentIds),
        'room.studentName': normalizeText(room?.studentName) || null,
        'room.parentId': normalizeText(room?.parentId) || null,
        'room.parentName': normalizeText(room?.parentName) || null,
        participantIds: Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [],
        participantRoles: room?.participantRoles && typeof room.participantRoles === 'object' ? room.participantRoles : {},
        participantUserDocIds: room?.participantUserDocIds && typeof room.participantUserDocIds === 'object' ? room.participantUserDocIds : {},
        participantNames: room?.participantNames && typeof room.participantNames === 'object' ? room.participantNames : {},
        metadata: safeJsonClone(room?.metadata || {}),
        '==================== LOOKUP RESULT ====================': true,
        studentLookupSuccess: Boolean(student),
        studentLookupSource: resolution?.source || 'unresolved',
        studentDocumentId,
        studentAuthUid,
        studentName,
        finalDisplayName: displayName || null,
    };
};

const logStudentRoomResolution = (room, payload) => {
    if (!isStudentChatRoomType(getRoomType(room))) return;
    console.log('ROOM RAW DATA / LOOKUP RESULT', payload);
};

const findStudentForStudentRoom = (room, { studentById, studentByAuthUid }) => {
    const roles = room?.participantRoles && typeof room.participantRoles === 'object' ? room.participantRoles : {};
    const userDocIds = room?.participantUserDocIds && typeof room.participantUserDocIds === 'object' ? room.participantUserDocIds : {};
    const participantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];

    const studentId = normalizeText(room?.studentId);
    const studentFromId = getStudentByAnyId(studentId, { studentById, studentByAuthUid });
    if (studentFromId) return { student: studentFromId, studentId, uid: getAuthUid(studentFromId) || studentId, source: 'room.studentId' };

    const studentDocId = normalizeText(room?.studentDocId);
    const studentFromDocId = getStudentByAnyId(studentDocId, { studentById, studentByAuthUid });
    if (studentFromDocId) return { student: studentFromDocId, studentId: studentDocId, uid: getAuthUid(studentFromDocId) || studentDocId, source: 'room.studentDocId' };

    const studentIds = getArrayField(room?.studentIds);
    for (const id of studentIds) {
        const student = getStudentByAnyId(id, { studentById, studentByAuthUid });
        if (student) return { student, studentId: id, uid: getAuthUid(student) || id, source: 'room.studentIds' };
    }

    const roleStudentUid = Object.keys(roles).find((uid) => lower(roles[uid]) === 'student');
    if (roleStudentUid) {
        const docId = normalizeText(userDocIds[roleStudentUid]);
        const student = studentByAuthUid.get(roleStudentUid) || getStudentByAnyId(docId, { studentById, studentByAuthUid });
        if (student) return { student, studentId: docId || normalizeText(student?.id) || roleStudentUid, uid: roleStudentUid, source: 'participantRoles.student' };
        const participantName = normalizeText(room?.participantNames?.[roleStudentUid]);
        if (participantName) return { student: null, studentId: docId || roleStudentUid, uid: roleStudentUid, participantName, source: 'participantRoles.studentName' };
    }

    for (const [uid, docIdValue] of Object.entries(userDocIds)) {
        const docId = normalizeText(docIdValue);
        const student = studentById.get(docId);
        if (student) return { student, studentId: docId, uid, source: 'participantUserDocIds' };
    }

    for (const uid of participantIds) {
        const student = studentByAuthUid.get(uid);
        if (student) return { student, studentId: normalizeText(student?.id) || uid, uid, source: 'studentByAuthUid' };
    }

    for (const uid of participantIds) {
        const student = studentById.get(uid);
        if (student) return { student, studentId: uid, uid: getAuthUid(student) || uid, source: 'studentById' };
    }

    for (const uid of participantIds) {
        const docId = normalizeText(userDocIds[uid]);
        const student = studentByAuthUid.get(uid) || studentById.get(uid) || studentById.get(docId) || studentByAuthUid.get(docId);
        if (student) return { student, studentId: docId || uid, uid, source: 'participantIdsFallback' };
    }

    return { student: null, studentId: '', uid: null, source: 'unresolved' };
};

const getStudentDisplayNameFromResolution = (resolution, { studentById, parentLast4Map }) => {
    if (resolution?.student) {
        return getMessengerTargetDisplayName({
            user: resolution.student,
            role: 'student',
            studentById,
            parentLast4Map,
        });
    }
    return normalizeText(resolution?.participantName) || '';
};

const getStudentDisplayNameForRoom = (room, { studentById, studentByAuthUid, parentLast4Map }) => {
    const resolution = findStudentForStudentRoom(room, { studentById, studentByAuthUid });
    const displayName = getStudentDisplayNameFromResolution(resolution, { studentById, parentLast4Map })
        || (normalizeText(room?.studentName) ? appendStudentSuffix(room.studentName) : '');
    logStudentRoomResolution(room, buildStudentRoomDebugPayload({
        room,
        resolution,
        displayName,
    }));
    return displayName;
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
        const roles = room?.participantRoles && typeof room.participantRoles === 'object' ? room.participantRoles : {};
        const userDocIds = room?.participantUserDocIds && typeof room.participantUserDocIds === 'object' ? room.participantUserDocIds : {};
        const roleParentUid = Object.keys(roles).find((uid) => isParentRole(roles[uid]));
        const parent = parentIds
            .map((parentId) => parentById.get(String(parentId)) || parentByAuthUid.get(String(parentId)))
            .find(Boolean)
            || (roleParentUid ? (parentByAuthUid.get(roleParentUid) || parentById.get(roleParentUid) || parentById.get(String(userDocIds[roleParentUid] || ''))) : null)
            || null;
        return resolveParentRoomDisplayName({ ...room, studentName }, parent, studentById);
    }
    return studentName || '이름 미등록 학생';
};

const resolveCounterpartyUid = (room, currentUserId) => {
    const participantIds = Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [];
    if (!participantIds.length) return null;
    const roles = room?.participantRoles && typeof room.participantRoles === 'object' ? room.participantRoles : {};
    const current = String(currentUserId || '');
    const nonStaff = participantIds.find((uid) => uid !== current && !isStaffRole(roles[uid]));
    if (nonStaff) return nonStaff;
    return participantIds.find((uid) => uid !== current) || participantIds[0] || null;
};

export const getMessengerTargetDisplayName = ({
    user,
    role,
    studentById = new Map(),
    parentLast4Map = {},
}) => {
    if (!user) return '';

    if (role === 'student') {
        const studentName = normalizeText(user?.name)
            || normalizeText(user?.displayName)
            || formatStudentNameWithOptionalParentLast4(user, parentLast4Map);
        return studentName ? appendStudentSuffix(studentName) : '이름 미등록 학생';
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
    const {
        studentById,
        studentByAuthUid,
        parentById,
        parentByAuthUid,
        parentLast4Map,
    } = buildUserLookups({ students, parents });

    const roomType = getRoomType(room);
    if (isStudentChatRoomType(roomType)) {
        const resolution = findStudentForStudentRoom(room, { studentById, studentByAuthUid });
        const displayName = getStudentDisplayNameFromResolution(resolution, { studentById, parentLast4Map })
            || (normalizeText(room?.studentName) ? appendStudentSuffix(room.studentName) : '이름 미등록 학생');
        logStudentRoomResolution(buildStudentRoomDebugPayload({
            room,
            studentId: resolution.studentId,
            displayName,
            source: resolution.source,
        }));
        return {
            uid: resolution.uid || resolution.studentId || null,
            role: 'student',
            user: resolution.student || null,
            displayName,
        };
    }

    const counterpartyUid = resolveCounterpartyUid(room, currentUserId);
    if (!counterpartyUid) return null;

    const participantRoles = room?.participantRoles || {};
    const participantUserDocIds = room?.participantUserDocIds || {};
    const roleHint = normalizeText(participantRoles[counterpartyUid]).toLowerCase();
    const participantNames = room?.participantNames && typeof room.participantNames === 'object' ? room.participantNames : {};
    const userDocIdHint = normalizeText(participantUserDocIds[counterpartyUid]);

    const parent =
        parentByAuthUid.get(counterpartyUid)
        || parentById.get(counterpartyUid)
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
        || studentById.get(counterpartyUid)
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

    const hintedName = normalizeText(participantNames?.[counterpartyUid]);
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
    if (standardTitle) {
        if (process.env.NODE_ENV === 'development') console.log('[internal-messenger] display name resolved', { roomId: room?.id || null, roomType: getRoomType(room), currentUserId, participantIds: Array.isArray(room?.participantIds) ? room.participantIds.map(String) : [], finalDisplayName: standardTitle });
        return standardTitle;
    }

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
    const studentById = new Map();
    safeStudents.forEach((student) => {
        [student?.id, student?.studentId, student?.docId, student?.userDocId].filter(Boolean).forEach((id) => studentById.set(String(id), student));
    });
    const parentLast4Map = buildStudentParentPhoneLast4Map(safeStudents, safeParents);
    const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
    const studentByParentPhone = new Map();
    safeStudents.forEach((student) => {
        [student?.parentPhone, student?.motherPhone, student?.fatherPhone, student?.guardianPhone].forEach((phone) => {
            const normalizedPhone = normalizePhone(phone);
            if (normalizedPhone && !studentByParentPhone.has(normalizedPhone)) studentByParentPhone.set(normalizedPhone, student);
        });
    });

    const studentOptions = safeStudents
        .filter((student) => !isExcludedStudent(student))
        .map((student) => {
            const authUid = getAuthUid(student) || normalizeText(student?.id);
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


    const studentParentOptions = safeStudents
        .filter((student) => !isExcludedStudent(student))
        .flatMap((student) => {
            const studentName = getUserName(student) || '이름 미등록 학생';
            return getParentRefsFromStudent(student).map((ref) => ({
                authUid: String(ref.authUid || ref.id),
                role: 'parent',
                displayName: appendParentSuffix(studentName),
                searchText: `${lower(studentName)} ${lower(appendParentSuffix(studentName))}`,
                classId: null,
                classLabel: null,
                classClosed: false,
                userDocId: ref.id || null,
                studentId: student?.id ? String(student.id) : null,
                parentId: ref.id || null,
            }));
        });

    const parentOptions = safeParents
        .map((parent) => {
            const authUid = getAuthUid(parent);
            if (!authUid) return null;
            const linkedStudentIds = Array.isArray(parent?.studentIds) ? parent.studentIds.map(String) : [parent?.studentId, parent?.linkedStudentId].filter(Boolean).map(String);
            const linkedStudentById = linkedStudentIds.map((studentId) => studentById.get(studentId)).find(Boolean);
            const linkedStudentByPhone = [parent?.phone, parent?.phoneNumber, parent?.parentPhone, parent?.mobile]
                .map(normalizePhone)
                .filter(Boolean)
                .map((phone) => studentByParentPhone.get(phone))
                .find(Boolean);
            const linkedStudent = linkedStudentById || linkedStudentByPhone || null;
            const linkedStudentName = getUserName(linkedStudent);
            const displayName = linkedStudentName ? appendParentSuffix(linkedStudentName) : getMessengerTargetDisplayName({
                user: parent,
                role: 'parent',
                studentById,
                parentLast4Map,
            });
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

    const merged = [...studentOptions, ...studentParentOptions, ...parentOptions];
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