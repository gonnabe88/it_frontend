<!--
================================================================================
[pages/info/documents/[id].vue] 사전협의 상세/편집 페이지
================================================================================
GET /api/documents/{id}로 문서를 조회하고,
수정은 PUT, 삭제는 DELETE를 통해 처리합니다.

[라우팅]
  - 접근: /info/documents/{docMngNo}
================================================================================
-->
<script setup lang="ts">
import { useDocuments } from '~/composables/useDocuments';
import type { RequirementDocument, RequirementDocumentForm, VersionSummary } from '~/composables/useDocuments';
import { useFiles } from '~/composables/useFiles';
import type { FileRecord } from '~/composables/useFiles';
import { useExcalidrawAttachment } from '~/composables/useExcalidrawAttachment';
import VersionHistoryDialog from '~/components/common/VersionHistoryDialog.vue';
import type { VersionHistoryItem } from '~/components/common/VersionHistoryDialog.vue';

const { getPendingFlMngNos, clearPendingFlMngNos } = useExcalidrawAttachment();

// Excalidraw pending 목록은 모듈 레벨 ref라 이전 세션 stale ID가 남을 수 있음 →
// 페이지 진입 시 즉시 초기화하여 현재 편집 세션에서 생성된 ID만 추적
clearPendingFlMngNos();

const route = useRoute();
/** 문서 관리번호 (라우트 파라미터) */
const docMngNo = route.params.id as string;

/** 쿼리파라미터의 ?version=0.02 값 (없으면 undefined → 최신 버전) */
const versionQuery = computed(() => {
    const raw = Array.isArray(route.query.version)
        ? route.query.version[0]
        : route.query.version;
    if (!raw) return undefined;
    const parsed = parseFloat(raw);
    return isNaN(parsed) ? undefined : parsed;
});

const title = '요구사항 정의서 상세';
definePageMeta({ title });

const { fetchDocument, fetchVersionHistory, createNewVersion, updateDocument, deleteDocument } = useDocuments();
const { fetchFiles, uploadFile, uploadFilesBulk, deleteFile, getPreviewUrl, getDownloadUrl, updateFileMeta } = useFiles();
const { exportToHwpx, isExporting } = useHwpxExport();
const toast = useToast();
const confirm = useConfirm();

/* ── 데이터 로드 ── */
const { data: docData, pending: loadPending, error, refresh } = await fetchDocument(docMngNo, versionQuery);

/* ── 버전 히스토리 로드 ── */
/** 현재 문서의 버전 히스토리 목록 */
const versions = ref<VersionSummary[]>([]);

/** 버전 목록 중 최신(가장 높은) 버전 번호 — 버전 목록이 비면 undefined */
const latestVersion = computed<number | undefined>(() => {
    if (versions.value.length === 0) return undefined;
    return Math.max(...versions.value.map(v => v.docVrs));
});

/**
 * 과거 버전 조회 여부
 * 쿼리 파라미터로 버전을 지정했더라도 그 값이 최신 버전과 같다면 과거 버전 아님.
 * (최신 버전 뱃지 클릭 등으로 `?version=최신` URL이 만들어진 경우에도
 *  '이전 버전' 안내 배너/편집 잠금이 잘못 적용되는 것을 방지)
 */
const isHistoricalVersion = computed(() => {
    if (versionQuery.value === undefined) return false;
    if (latestVersion.value === undefined) return false;
    return versionQuery.value < latestVersion.value;
});

// 페이지 초기화 시 버전 히스토리 조회 (실패 시 빈 배열 유지)
try {
    versions.value = await fetchVersionHistory(docMngNo);
} catch {
    versions.value = [];
}

/* ── 버전 히스토리 다이얼로그 ── */
/** 버전 뱃지 클릭 시 열리는 다이얼로그 표시 여부 */
const versionDialogVisible = ref(false);

/** 공통 VersionHistoryDialog에 전달할 VersionHistoryItem[] 변환 */
const versionItems = computed<VersionHistoryItem[]>(() =>
    versions.value.map(v => ({
        key: `${v.docMngNo}-${v.docVrs}`,
        version: v.docVrs,
        changedAt: v.lstChgDtm
    }))
);

/** 현재 조회 중인 버전 (강조용) — 쿼리 파라미터 우선, 없으면 문서의 최신 버전 */
const currentDocVrs = computed<number | undefined>(() => {
    if (versionQuery.value !== undefined) return versionQuery.value;
    const d = docData.value as RequirementDocument | null;
    return d ? d.docVrs : undefined;
});

/**
 * 버전 항목 선택 → 해당 버전 상세 페이지로 이동
 * 최신 버전을 선택하면 `?version=` 쿼리를 제거하여 URL을 정리합니다.
 * (쿼리가 남아 있으면 새로고침/북마크 시에도 최신 뷰로 동작하도록 유지)
 */
const onSelectVersion = (item: VersionHistoryItem) => {
    if (latestVersion.value !== undefined && item.version === latestVersion.value) {
        navigateTo(`/info/documents/${docMngNo}`);
    } else {
        navigateTo(`/info/documents/${docMngNo}?version=${item.version}`);
    }
};

/* ── 파일 목록 로드 ── */
// 해당 문서에 연결된 파일 목록을 조회합니다. (await 없이 반응형으로 동작)
const { data: filesData, refresh: refreshFiles } = fetchFiles('요구사항정의서', docMngNo);

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(async () => {
    refresh();
    refreshFiles();
    try {
        versions.value = await fetchVersionHistory(docMngNo);
    } catch {
        versions.value = [];
    }
});

/** 첨부파일 목록 (flDtt === '첨부파일') */
const attachedFiles = computed<FileRecord[]>(() =>
    (filesData.value || []).filter(f => f.flDtt === '첨부파일')
);

/* ── 편집 모드 상태 ── */
const isEditing = ref(false);

/* ── 첨부파일 편집 상태 ── */
/** 편집 중 새로 추가할 첨부파일 (저장 시 업로드) */
const newAttachments = ref<File[]>([]);
/** 편집 중 삭제 요청한 파일관리번호 목록 (저장 시 삭제 처리) */
const deletedFileIds = ref<string[]>([]);
/** 첨부파일 추가 input 참조 */
const editAttachmentInputRef = ref<HTMLInputElement | null>(null);

/** 파일 크기를 사람이 읽기 쉬운 형식으로 변환 */
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/**
 * 첨부파일 추가 핸들러 (편집 모드)
 * 선택한 파일을 newAttachments에 추가합니다. 저장 시 업로드됩니다.
 */
const addNewAttachments = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(f => newAttachments.value.push(f));
    input.value = '';
};

/** 추가 예정 파일 제거 */
const removeNewAttachment = (index: number) => {
    newAttachments.value.splice(index, 1);
};

/**
 * 기존 첨부파일 삭제 마킹
 * 저장 버튼 클릭 시 실제로 삭제됩니다. (즉시 삭제하지 않음)
 */
const markFileForDeletion = (flMngNo: string) => {
    if (!deletedFileIds.value.includes(flMngNo)) {
        deletedFileIds.value.push(flMngNo);
    }
};

/** 삭제 마킹 취소 */
const unmarkFileForDeletion = (flMngNo: string) => {
    deletedFileIds.value = deletedFileIds.value.filter(id => id !== flMngNo);
};

/**
 * Tiptap 에디터 이미지 업로드 핸들러 (기존 문서용)
 * docMngNo가 이미 있으므로 orcPkVl을 바로 설정하여 업로드합니다.
 * @param file - 업로드할 이미지 파일
 * @returns 에디터에 삽입할 이미지 미리보기 URL
 */
const handleEditorImageUpload = async (file: File): Promise<string> => {
    try {
        const result = await uploadFile(file, '이미지', docMngNo, '요구사항정의서');
        // FileRecord 객체를 전달 → 서버 응답의 previewUrl 필드 우선 사용
        return getPreviewUrl(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '이미지 업로드 실패', detail: e?.data?.message || '이미지 업로드 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/**
 * Tiptap 에디터 첨부파일 업로드 핸들러
 * @param file - 업로드할 파일
 */
const handleEditorFileUpload = async (file: File) => {
    try {
        const result = await uploadFile(file, '첨부파일', docMngNo, '요구사항정의서');
        await refreshFiles();
        return {
            flMngNo: result.flMngNo,
            flNm: result.orcFlNm,
            flSz: 0, // 서버 응답에 파일 크기가 없는 경우 처리 (필요 시 API 스펙 확인)
        };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '파일 업로드 실패', detail: e?.data?.message || '파일 업로드 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/**
 * Tiptap 에디터 첨부파일 삭제 핸들러
 * @param flMngNo - 삭제할 파일 관리번호
 */
const handleEditorFileDelete = async (flMngNo: string) => {
    try {
        await deleteFile(flMngNo);
        toast.add({ severity: 'success', summary: '삭제 완료', detail: '파일이 서버에서 삭제되었습니다.', life: 3000 });
        await refreshFiles();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '삭제 실패', detail: e?.data?.message || '파일 삭제 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/** Tiptap 에디터용 첨부파일 목록 (AttachmentItem[] 형식) */
const attachmentListForEditor = computed(() =>
    attachedFiles.value.map(f => ({
        flMngNo: f.flMngNo,
        flNm: f.orcFlNm,
        flSz: 0, // API 스펙상 크기가 없다면 0 처리
    }))
);

/** 편집 폼 데이터 */
const form = reactive<RequirementDocumentForm>({
    reqNm: '',
    reqCone: '',
    reqDtt: '',
    bzDtt: '',
    fsgTlm: ''
});

/** DatePicker 바인딩용 Date 객체 (완료기한만 날짜 선택) */
const fsgTlmDate = ref<Date | null>(null);

/** YYYY-MM-DD 문자열 → Date 변환 */
const parseDateStr = (str: string): Date | null => {
    if (!str) return null;
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** Date → YYYY-MM-DD 변환 */
const formatDateStr = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0]!;
};

// 완료기한 DatePicker 변경 시 form 동기화
watch(fsgTlmDate, (d) => { form.fsgTlm = formatDateStr(d); });

/** 편집 모드 진입: document 데이터를 form에 복사 */
const startEdit = () => {
    const doc = docData.value as RequirementDocument | null;
    if (!doc) return;
    form.reqNm = doc.reqNm;
    form.reqCone = doc.reqCone || '';
    form.reqDtt = doc.reqDtt || '';
    form.bzDtt = doc.bzDtt || '';
    form.fsgTlm = doc.fsgTlm || '';
    fsgTlmDate.value = parseDateStr(doc.fsgTlm || '');
    isEditing.value = true;
};

/** 편집 취소 - 편집 상태 및 파일 변경 사항 초기화 */
const cancelEdit = () => {
    isEditing.value = false;
    // 파일 편집 상태 초기화
    newAttachments.value = [];
    deletedFileIds.value = [];
};

/* ── 유효성 검사 ── */
const validate = (): boolean => {
    if (!form.reqNm.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '요구사항명을 입력해주세요.', life: 3000 });
        return false;
    }
    if (!form.reqDtt.trim()) {
        toast.add({ severity: 'warn', summary: '입력 오류', detail: '요청구분을 입력해주세요.', life: 3000 });
        return false;
    }
    return true;
};

/* ── 저장 처리 ── */
const isSaving = ref(false);

const onSave = async () => {
    if (!validate()) return;

    isSaving.value = true;
    try {
        // 1단계: 문서 내용 수정
        await updateDocument(docMngNo, {
            reqNm: form.reqNm,
            reqCone: form.reqCone,
            reqDtt: form.reqDtt,
            bzDtt: form.bzDtt,
            fsgTlm: form.fsgTlm
        });

        // 2단계: 삭제 요청된 첨부파일 삭제
        for (const flMngNo of deletedFileIds.value) {
            await deleteFile(flMngNo);
        }

        // 3단계: 새 첨부파일 일괄 업로드
        if (newAttachments.value.length > 0) {
            await uploadFilesBulk(newAttachments.value, '첨부파일', docMngNo, '요구사항정의서');
        }

        // 4단계: Excalidraw 장면 파일 및 임베드 이미지의 orcPkVl을 실제 docMngNo로 업데이트
        //   - 개별 파일 업데이트 실패는 전체 저장을 실패시키지 않음 (stale/이미 삭제된 파일 방어)
        //   - 실패한 건은 콘솔에 기록하고 계속 진행
        for (const flMngNo of getPendingFlMngNos()) {
            try {
                await updateFileMeta(flMngNo, { orcPkVl: docMngNo });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
                // eslint-disable-next-line no-console
                console.warn(`[onSave] Excalidraw 파일 메타 업데이트 스킵: ${flMngNo}`, e?.data?.message ?? e);
            }
        }
        clearPendingFlMngNos();

        toast.add({ severity: 'success', summary: '저장 완료', detail: '요구사항 정의서가 수정되었습니다.', life: 3000 });
        // 편집 관련 임시 상태 초기화 및 조회 모드 전환
        isEditing.value = false;
        newAttachments.value = [];
        deletedFileIds.value = [];
        await refresh();
        await refreshFiles();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '저장 실패', detail: e?.data?.message || '저장 중 오류가 발생했습니다.', life: 4000 });
    } finally {
        isSaving.value = false;
    }
};

/* ── 삭제 처리 ── */
const isDeleting = ref(false);

const onDelete = (event: Event) => {
    const doc = docData.value as RequirementDocument | null;
    confirm.require({
        target: event.currentTarget as HTMLElement,
        message: `"${doc?.reqNm}" 문서를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            isDeleting.value = true;
            try {
                await deleteDocument(docMngNo);
                toast.add({ severity: 'success', summary: '삭제 완료', detail: '문서가 삭제되었습니다.', life: 3000 });
                await navigateTo('/info/documents');
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '삭제 중 오류가 발생했습니다.', life: 4000 });
                isDeleting.value = false;
            }
        }
    });
};

/* ── 저장 다이얼로그 ── */
const saveDialogVisible = ref(false);

/** 저장 버튼 클릭 시 다이얼로그 표시 */
const openSaveDialog = () => {
    if (!validate()) return;
    saveDialogVisible.value = true;
};

/** 현재 버전 수정 */
const onSaveCurrentVersion = async () => {
    saveDialogVisible.value = false;
    await onSave();
};

/** 새 버전으로 저장 */
const onSaveAsNewVersion = async () => {
    saveDialogVisible.value = false;
    await onCreateNewVersion();
};

/* ── 새 버전 생성 처리 ── */
/**
 * 현재 문서를 기반으로 다음 버전을 생성하고 최신 버전 상세로 이동합니다.
 * (서버가 다음 버전을 자동 계산하여 신규 Brdocm 레코드를 생성)
 */
const onCreateNewVersion = async () => {
    try {
        // 1단계: 기존 버전을 원본 그대로 복제하여 새 버전 생성
        await createNewVersion(docMngNo);
        // 2단계: 방금 생성된 최신(새) 버전에 편집 내용 저장
        await updateDocument(docMngNo, {
            reqNm: form.reqNm,
            reqCone: form.reqCone,
            reqDtt: form.reqDtt,
            bzDtt: form.bzDtt,
            fsgTlm: form.fsgTlm
        });
        toast.add({ severity: 'success', summary: '새 버전 생성', detail: '새 버전이 생성되었습니다.', life: 3000 });
        // 편집 상태 초기화 및 조회 모드 전환 후 최신 버전 데이터 재조회
        isEditing.value = false;
        newAttachments.value = [];
        deletedFileIds.value = [];
        await refresh();
        await refreshFiles();
        try { versions.value = await fetchVersionHistory(docMngNo); } catch { versions.value = []; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '새 버전 생성 실패', detail: e?.data?.message || '새 버전 생성 중 오류가 발생했습니다.', life: 4000 });
    }
};

/* ── AI 반영 처리 ── */
/**
 * AI 응답 내용을 요구사항 정의서 본문(reqCone)에 반영합니다.
 * 읽기 모드일 경우 편집 모드로 전환한 후 내용을 대체합니다.
 */
const onApplyAiContent = (content: string) => {
    if (!isEditing.value) {
        // 읽기 모드이면 편집 모드로 자동 전환
        startEdit();
    }
    form.reqCone = content;
    toast.add({ severity: 'success', summary: '반영 완료', detail: 'AI 응답이 요구사항 정의서 본문에 반영되었습니다.', life: 3000 });
};

/* ── 날짜 포맷 ── */
const formatDate = (str: string) => str?.substring(0, 10) || '-';
const formatDateTime = (str: string) => str?.substring(0, 16).replace('T', ' ') || '-';

const doc = computed(() => docData.value as RequirementDocument | null);

/**
 * AI 채팅에 전달할 전체 문서 컨텍스트
 * 기본 정보(요구사항명, 요청구분, 업무구분, 완료기한) + 요청내용 본문을 조합합니다.
 * 편집 모드에서는 현재 수정 중인 form 값을, 읽기 모드에서는 저장된 doc 값을 사용합니다.
 */
const documentContext = computed(() => {
    if (isEditing.value) {
        return [
            `요구사항명: ${form.reqNm}`,
            `요청구분: ${form.reqDtt}`,
            `업무구분: ${form.bzDtt}`,
            `완료기한: ${form.fsgTlm}`,
            '',
            '[요청내용]',
            form.reqCone
        ].join('\n');
    }
    if (!doc.value) return '';
    return [
        `요구사항명: ${doc.value.reqNm}`,
        `요청구분: ${doc.value.reqDtt || ''}`,
        `업무구분: ${doc.value.bzDtt || ''}`,
        `완료기한: ${doc.value.fsgTlm || ''}`,
        '',
        '[요청내용]',
        doc.value.reqCone || ''
    ].join('\n');
});

/* ── TOC 상태 관리 ── */
const rawToc = ref<Array<{ id: string; level: number; text: string }>>([]);
const activeSection = ref('');

// TiptapEditor에서 올라온 TOC 이벤트
const handleUpdateToc = (toc: Array<{ id: string; level: number; text: string }>) => {
    rawToc.value = toc;
};

// 트리 구조 변환 로직 제거 (rawToc 직접 렌더링)

// 부드러운 스크롤 함수
const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        // scrollIntoView를 사용하여 가장 가까운 스크롤 컨테이너를 기준으로 부드럽게 스크롤합니다.
        // TiptapEditor 내부의 Heading 확장에 적용된 scroll-margin-top: 100px이 여백 역할을 합니다.
        el.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // 클릭하여 스크롤할 때 즉시 활성화 인디케이터 변경
        activeSection.value = id;
    }
};

/* ── IntersectionObserver: 스크롤 시 목차 활성화 동기화 ── */
let observer: IntersectionObserver | null = null;
const observerElements = ref<Set<Element>>(new Set());

// DOM 렌더링 후 h1~h6 요소를 추적하도록 목차가 변경될 때마다 갱신
watch(rawToc, async () => {
    await nextTick();
    if (observer) {
        observerElements.value.forEach(el => observer?.unobserve(el));
        observerElements.value.clear();
    }

    // TiptapEditor 내부 등에서 생성된 id 타겟
    rawToc.value.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            observer?.observe(el);
            observerElements.value.add(el);
        }
    });
}, { deep: true });

onMounted(() => {
    observer = new IntersectionObserver(
        (entries) => {
            // 여러 요소가 화면에 보일 수 있으므로 화면 위쪽 교차율이 가장 높은 요소를 활성화
            // 혹은 isIntersecting인 첫 번째 요소 우선 선택
            const visibleEntries = entries.filter(e => e.isIntersecting);
            if (visibleEntries.length > 0) {
                const id = visibleEntries[0]?.target?.id;
                if (id) activeSection.value = id;
            }
        },
        { rootMargin: '-10% 0px -80% 0px' } // 상단에서 목차가 바뀔 마진
    );
});

onUnmounted(() => {
    if (observer) {
        observer.disconnect();
    }
});
</script>

<template>
    <div class="space-y-6">

        <!-- 로딩 중 -->
        <div v-if="loadPending" class="flex items-center justify-center py-20">
            <i class="pi pi-spin pi-spinner text-4xl text-indigo-500"/>
        </div>

        <!-- 오류 -->
        <div
v-else-if="error"
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <i class="pi pi-exclamation-circle text-5xl text-red-400 mb-4 block"/>
            <p class="text-red-500 font-medium">문서를 불러오는 중 오류가 발생했습니다.</p>
            <p class="text-sm text-zinc-400 mt-1">{{ error.message }}</p>
            <Button label="목록으로" icon="pi pi-arrow-left" class="mt-4" @click="navigateTo('/info/documents')" />
        </div>

        <!-- 문서 없음 -->
        <div
v-else-if="!doc"
            class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <i class="pi pi-file text-5xl text-zinc-300 dark:text-zinc-600 mb-4 block"/>
            <p class="text-zinc-600 dark:text-zinc-400 font-medium">문서를 찾을 수 없습니다.</p>
            <p class="text-xs text-zinc-400 mt-1 font-mono">{{ docMngNo }}</p>
            <Button
label="목록으로" icon="pi pi-arrow-left" class="mt-4" severity="secondary"
                @click="navigateTo('/info/documents')" />
        </div>

        <!-- 본문 -->
        <template v-else-if="doc">

            <!-- 과거 버전 읽기 전용 안내 배너 -->
            <Message v-if="isHistoricalVersion" severity="warn" :closable="false" class="mb-4">
                이전 버전(v{{ versionQuery?.toFixed(2) }})을 보고 있습니다. 수정하려면 최신 버전을 조회하세요.
            </Message>

            <!-- 페이지 헤더 -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <Button
icon="pi pi-arrow-left" severity="secondary" text rounded
                        @click="navigateTo('/info/documents')" />
                    <div>
                        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center">
                            {{ isEditing ? '요구사항 정의서 편집' : doc.reqNm }}
                            <!-- 현재 조회 중인 문서의 버전 배지 (클릭 시 버전 목록 다이얼로그) -->
                            <Tag
                                :value="`v${doc.docVrs.toFixed(2)}`"
                                severity="info"
                                class="ml-2 cursor-pointer hover:opacity-80 transition-opacity"
                                title="버전 목록 보기"
                                @click="versionDialogVisible = true" />
                        </h1>
                        <p class="text-xs text-zinc-400 mt-0.5 font-mono">{{ docMngNo }}</p>
                    </div>
                </div>

                <div class="flex gap-2">
                    <!-- 읽기 모드 액션 -->
                    <template v-if="!isEditing">
                        <Button
label="사전협의" icon="pi pi-comments" severity="info" outlined
                            @click="navigateTo(`/info/documents/${docMngNo}/review`)" />
                        <Button
label="한글 내보내기" icon="pi pi-download" severity="secondary" outlined
                            :loading="isExporting" :disabled="!doc.reqCone"
                            @click="exportToHwpx(doc.reqCone, doc.reqNm, { authorEno: doc.fstEnrUsid })" />
                        <!-- 편집/삭제는 최신 버전에서만 허용 -->
                        <Button
v-if="!isHistoricalVersion" label="편집" icon="pi pi-pencil" @click="startEdit" />
                        <Button
v-if="!isHistoricalVersion"
                            label="삭제" icon="pi pi-trash" severity="danger" outlined :loading="isDeleting"
                            @click="onDelete" />
                    </template>
                    <!-- 편집 모드 액션 -->
                    <template v-else>
                        <Button label="취소" severity="secondary" @click="cancelEdit" />
                        <Button label="저장" icon="pi pi-save" :loading="isSaving" @click="openSaveDialog" />
                    </template>
                </div>
            </div>

            <!-- 레이아웃: 2단 분할 그리드 구조 도입 -->
            <div class="grid grid-cols-1 xl:grid-cols-4 gap-8">

                <!-- 좌측 주요 콘텐츠 영역 (3/4 비율) -->
                <div class="xl:col-span-3 space-y-6">

                    <!-- 기본 정보 카드 -->
                    <div
                        class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                        <h2
                            class="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                            기본 정보
                        </h2>

                        <!-- 읽기 모드 -->
                        <template v-if="!isEditing">
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">요청구분</dt>
                                    <dd class="font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{{
                                        doc.reqDtt || '-' }}</dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">업무구분</dt>
                                    <dd class="font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{{
                                        doc.bzDtt || '-' }}</dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">완료기한</dt>
                                    <dd
class="font-medium"
                                        :class="doc.fsgTlm && doc.fsgTlm < new Date().toISOString().slice(0, 10) ? 'text-red-500' : 'text-zinc-800 dark:text-zinc-200'">
                                        {{ formatDate(doc.fsgTlm) }}
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">상태</dt>
                                    <dd>
                                        <Tag
                                            :value="doc.delYn === 'Y' ? '삭제됨' : '활성'"
                                            :severity="doc.delYn === 'Y' ? 'danger' : 'success'" class="border-0"
                                            rounded />
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">등록일시</dt>
                                    <dd class="text-sm text-zinc-600 dark:text-zinc-400">{{
                                        formatDateTime(doc.fstEnrDtm) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">최종수정일시</dt>
                                    <dd class="text-sm text-zinc-600 dark:text-zinc-400">{{
                                        formatDateTime(doc.lstChgDtm) }}</dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">등록자</dt>
                                    <dd class="text-sm text-zinc-600 dark:text-zinc-400">{{ doc.fstEnrUsid || '-' }}
                                    </dd>
                                </div>
                                <div>
                                    <dt class="text-xs text-zinc-400 mb-1">최종수정자</dt>
                                    <dd class="text-sm text-zinc-600 dark:text-zinc-400">{{ doc.lstChgUsid || '-' }}
                                    </dd>
                                </div>
                            </div>

                            <!-- 첨부파일 목록 (읽기 모드) -->
                            <div class="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <dt class="text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
                                    <i class="pi pi-paperclip"/> 첨부파일
                                    <span
                                        class="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-full px-1.5 py-0.5 text-xs">
                                        {{ attachedFiles.length }}
                                    </span>
                                </dt>
                                <dd>
                                    <!-- 첨부파일 없음 -->
                                    <p
v-if="attachedFiles.length === 0"
                                        class="text-sm text-zinc-400 dark:text-zinc-600 italic">
                                        첨부파일이 없습니다.
                                    </p>
                                    <!-- 첨부파일 목록 -->
                                    <ul v-else class="space-y-1.5">
                                        <li
                                            v-for="file in attachedFiles" :key="file.flMngNo"
                                            class="flex items-center gap-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2">
                                            <i class="pi pi-file text-indigo-400 text-sm flex-shrink-0"/>
                                            <span
                                                class="flex-1 truncate text-zinc-700 dark:text-zinc-300"
                                                :title="file.orcFlNm">{{ file.orcFlNm }}</span>
                                            <!-- 파일 다운로드 링크 -->
                                            <a
                                                :href="getDownloadUrl(file.flMngNo)"
                                                class="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex-shrink-0 transition-colors"
                                                :title="`${file.orcFlNm} 다운로드`">
                                                <i class="pi pi-download text-xs"/>
                                                다운로드
                                            </a>
                                        </li>
                                    </ul>
                                </dd>
                            </div>
                        </template>

                        <!-- 편집 모드 -->
                        <template v-else>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <!-- 요구사항명 -->
                                <div class="md:col-span-2 flex flex-col gap-1.5">
                                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        요구사항명 <span class="text-red-500">*</span>
                                    </label>
                                    <InputText
v-model="form.reqNm" placeholder="요구사항명을 입력하세요" class="w-full"
                                        maxlength="200" />
                                </div>
                                <!-- 요청구분 -->
                                <div class="flex flex-col gap-1.5">
                                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                        요청구분 <span class="text-red-500">*</span>
                                    </label>
                                    <Textarea
v-model="form.reqDtt" placeholder="요청구분을 입력하세요" rows="3"
                                        class="w-full resize-none" />
                                </div>
                                <!-- 업무구분 -->
                                <div class="flex flex-col gap-1.5">
                                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">업무구분</label>
                                    <Textarea
v-model="form.bzDtt" placeholder="업무구분을 입력하세요" rows="3"
                                        class="w-full resize-none" />
                                </div>
                                <!-- 완료기한 -->
                                <div class="flex flex-col gap-1.5">
                                    <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">완료기한</label>
                                    <DatePicker
v-model="fsgTlmDate" placeholder="YYYY-MM-DD" show-icon fluid
                                        date-format="yy-mm-dd" />
                                </div>

                                <!-- 첨부파일 관리 영역 (편집 모드) -->
                                <div
                                    class="md:col-span-2 flex flex-col gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                                    <div class="flex items-center justify-between">
                                        <label
                                            class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                            <i class="pi pi-paperclip text-zinc-400"/> 첨부파일
                                        </label>
                                        <Button
icon="pi pi-plus" label="파일 추가" size="small" severity="secondary"
                                            outlined @click="editAttachmentInputRef?.click()" />
                                    </div>

                                    <!-- 숨김 파일 input -->
                                    <input
ref="editAttachmentInputRef" type="file" multiple class="hidden"
                                        @change="addNewAttachments" >

                                    <!-- 기존 첨부파일 목록 -->
                                    <template v-if="attachedFiles.length > 0">
                                        <p class="text-xs text-zinc-400 font-medium">기존 파일</p>
                                        <ul class="space-y-1.5">
                                            <li
v-for="file in attachedFiles" :key="file.flMngNo"
                                                class="flex items-center gap-2 text-sm rounded-lg px-3 py-2 transition-colors"
                                                :class="deletedFileIds.includes(file.flMngNo)
                                                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 opacity-60'
                                                    : 'bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700'">
                                                <i
class="pi pi-file text-indigo-400 text-sm flex-shrink-0"
                                                    :class="{ 'text-red-400': deletedFileIds.includes(file.flMngNo) }"/>
                                                <span
class="flex-1 truncate text-zinc-700 dark:text-zinc-300"
                                                    :class="{ 'line-through text-zinc-400': deletedFileIds.includes(file.flMngNo) }"
                                                    :title="file.orcFlNm">{{ file.orcFlNm }}</span>

                                                <!-- 삭제 마킹된 경우: 취소 버튼 -->
                                                <template v-if="deletedFileIds.includes(file.flMngNo)">
                                                    <span class="text-xs text-red-400 flex-shrink-0">삭제 예정</span>
                                                    <button
                                                        class="text-zinc-400 hover:text-indigo-500 transition-colors flex-shrink-0"
                                                        title="삭제 취소" @click="unmarkFileForDeletion(file.flMngNo)">
                                                        <i class="pi pi-undo text-xs"/>
                                                    </button>
                                                </template>

                                                <!-- 삭제 마킹 전: 다운로드 + 삭제 버튼 -->
                                                <template v-else>
                                                    <a
                                                        :href="getDownloadUrl(file.flMngNo)"
                                                        class="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 flex-shrink-0 transition-colors"
                                                        :title="`${file.orcFlNm} 다운로드`">
                                                        <i class="pi pi-download text-xs"/>
                                                    </a>
                                                    <button
                                                        class="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0"
                                                        title="파일 삭제" @click="markFileForDeletion(file.flMngNo)">
                                                        <i class="pi pi-times text-xs"/>
                                                    </button>
                                                </template>
                                            </li>
                                        </ul>
                                    </template>

                                    <!-- 새로 추가한 첨부파일 목록 -->
                                    <template v-if="newAttachments.length > 0">
                                        <p class="text-xs text-zinc-400 font-medium mt-1">새 파일 (저장 시 업로드)</p>
                                        <ul class="space-y-1.5">
                                            <li
v-for="(file, idx) in newAttachments" :key="idx"
                                                class="flex items-center gap-2 text-sm bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2">
                                                <i class="pi pi-file-plus text-indigo-400 text-sm flex-shrink-0"/>
                                                <span
class="flex-1 truncate text-zinc-700 dark:text-zinc-300"
                                                    :title="file.name">{{ file.name }}</span>
                                                <span class="text-xs text-zinc-400 flex-shrink-0">{{
                                                    formatFileSize(file.size) }}</span>
                                                <button
                                                    class="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                                                    title="추가 취소" @click="removeNewAttachment(idx)">
                                                    <i class="pi pi-times text-xs"/>
                                                </button>
                                            </li>
                                        </ul>
                                    </template>

                                    <!-- 기존 파일도 없고 새 파일도 없는 경우 안내 -->
                                    <div
v-if="attachedFiles.length === 0 && newAttachments.length === 0"
                                        class="text-xs text-zinc-400 dark:text-zinc-600 italic py-3 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                                        파일 추가 버튼을 클릭하여 첨부파일을 등록하세요.
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>

                    <!-- 요청내용 카드 -->
                    <div
                        class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <div
                            class="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                            <h2 class="text-base font-semibold text-zinc-800 dark:text-zinc-200">요청내용</h2>
                            <span v-if="!isEditing" class="text-xs text-zinc-400">읽기 전용</span>
                        </div>
                        <div class="p-4">
                            <ClientOnly>
                                <!-- 편집 모드: 첨부파일 및 이미지 API 업로드 활성화 -->
                                <TiptapEditor
v-if="isEditing" v-model="form.reqCone" placeholder="요구사항 상세 내용을 입력하세요..."
                                    :image-upload-fn="handleEditorImageUpload" :file-upload-fn="handleEditorFileUpload"
                                    :file-delete-fn="handleEditorFileDelete" :attachment-list="attachmentListForEditor"
                                    @update:toc="handleUpdateToc" />
                                <!-- 읽기 모드 -->
                                <TiptapEditor
v-else :model-value="doc.reqCone || ''" :readonly="true"
                                    :attachment-list="attachmentListForEditor" @update:toc="handleUpdateToc" />
                                <template #fallback>
                                    <div class="p-8 text-center text-zinc-400">
                                        <i class="pi pi-spin pi-spinner text-2xl mb-2 block"/>
                                        에디터 로딩 중...
                                    </div>
                                </template>
                            </ClientOnly>
                        </div>
                    </div>

                    <!-- 하단 편집 모드 액션 -->
                    <div v-if="isEditing" class="flex justify-end gap-3 pb-4">
                        <Button label="취소" severity="secondary" @click="cancelEdit" />
                        <Button label="저장" icon="pi pi-save" :loading="isSaving" @click="openSaveDialog" />
                    </div>

                </div> <!-- // 좌측(3/4) 영역 종료 -->

                <!-- 우측 측면 사이드바: 반응형 환경에서 보통 모니터 화면(xl) 이상일 때 표시 -->
                <div class="xl:col-span-1 relative hidden xl:block" data-chat-anchor>
                    <!-- 스티키 고정 박스 영역 -->
                    <div class="sticky top-6 lg:pl-4">
                        <h3
                            class="font-bold text-[14px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 px-3 flex items-center gap-2">
                            <i class="pi pi-align-left text-sm text-zinc-300 dark:text-zinc-600"/> 바로가기 목차
                        </h3>

                        <!-- 목차가 비어있을 때 안내 문구 -->
                        <div
v-if="rawToc.length === 0"
                            class="text-xs text-zinc-400 dark:text-zinc-600 italic px-3 ml-3">
                            본문에 제목이 없으면 이곳에 목차가 정렬되지 않습니다.
                        </div>

                        <!-- 추출된 목차 목록 (평면 다단계 들여쓰기) -->
                        <ul
v-else
                            class="flex flex-col relative border-l border-zinc-200 dark:border-zinc-800 ml-3 py-1">
                            <li v-for="item in rawToc" :key="item.id" class="flex flex-col relative py-0.5">
                                <!-- 활성화 인디케이터 (왼쪽 보더선) -->
                                <div
v-if="activeSection === item.id"
                                    class="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] bg-indigo-500 rounded-full transition-all"/>

                                <div
class="relative flex items-center py-1 pr-4 cursor-pointer transition-colors duration-200 group"
                                    :class="[
                                        activeSection === item.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                                        item.level === 1 ? 'font-semibold text-[14px] mt-1 pl-4' : '',
                                        item.level === 2 ? 'text-[14px] pl-4' : '',
                                        item.level === 3 ? 'text-[13px] pl-7 opacity-90' : '',
                                        item.level === 4 ? 'text-[13px] pl-10 opacity-80' : '',
                                        item.level === 5 ? 'text-[12px] pl-12 opacity-70' : '',
                                        item.level === 6 ? 'text-[12px] pl-14 opacity-60' : ''
                                    ]" @click="scrollTo(item.id)">
                                    <span class="truncate" :title="item.text">{{ item.text }}</span>
                                </div>
                            </li>
                        </ul>

                    </div>
                </div> <!-- // 우측(1/4) 영역 종료 -->

            </div> <!-- // grid 레이아웃 종료 -->

        </template>
    <!-- 저장 방식 선택 다이얼로그 -->
    <Dialog
        v-model:visible="saveDialogVisible"
        header="저장 방식 선택"
        :modal="true"
        :closable="true"
        :style="{ width: '360px' }">
        <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            이 문서를 어떻게 저장하시겠습니까?
        </p>
        <div class="flex flex-col gap-2">
            <Button
                label="현재 버전 수정"
                icon="pi pi-pencil"
                class="w-full"
                :loading="isSaving"
                @click="onSaveCurrentVersion" />
            <Button
                label="새 버전으로 저장"
                icon="pi pi-copy"
                severity="secondary"
                class="w-full"
                @click="onSaveAsNewVersion" />
        </div>
    </Dialog>

    <ConfirmPopup />

    <!-- 버전 히스토리 다이얼로그 (버전 뱃지 클릭 시 표시) -->
    <VersionHistoryDialog
        v-model:visible="versionDialogVisible"
        :versions="versionItems"
        :current-version="currentDocVrs"
        @select="onSelectVersion" />

    <!-- AI 채팅 플로팅 패널 -->
    <GeminiChat
        system-instruction="당신은 IT 프로젝트 요구사항 분석 전문가입니다. 응답은 HTML로 작성해주세요. 사용자가 요구사항 정의서 초안을 작성할 수 있도록 도와주세요. 사용자가 요구사항을 입력하면, 요구사항 정의서의 각 항목에 맞게 내용을 정리하고, 누락된 항목이 있다면 추가할 내용을 제안해주세요. 작성된 요구사항을 함께 보내주면 추가,수정한 부분을 html로 표시해주세요."
        :document-content="documentContext" :fl-mng-nos="attachedFiles.map(f => f.flMngNo)"
        @apply-content="onApplyAiContent" />
    </div>
</template>
