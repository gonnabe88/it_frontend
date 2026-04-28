<!--
================================================================================
[pages/guide/index.vue] 정보화사업 가이드 페이지
================================================================================
정보화사업 단계별 가이드 문서를 조회/편집하는 페이지입니다.

[화면 구성]
  상단: 정보화사업 단계 타임라인 (PROJECT_STAGES 기반, 단계 클릭 시 해당 가이드 표시)
  메인: xl 4-col 그리드
    좌(3/4): 선택된 단계의 가이드 내용 (TiptapEditor 조회/편집 모드)
    우(1/4): 바로가기 목차 (사이드바, sticky)

[동작 방식]
  - 상단 타임라인에서 단계 클릭 → 해당 단계명(docNm)과 일치하는 가이드 문서 표시
  - 가이드 문서가 없는 단계: 빈 안내 + '가이드 작성' 버튼
  - 편집 버튼 클릭 → TiptapEditor(Excalidraw 포함) 편집 모드 전환
  - 저장: 기존 문서면 PUT, 신규면 POST 호출
  - 바로가기 목차: TiptapEditor @update:toc 이벤트로 자동 생성, 스크롤 연동

[API]
  GET    /api/guide-documents         - 전체 목록 조회
  POST   /api/guide-documents         - 신규 생성 (docNm = 단계명)
  PUT    /api/guide-documents/{id}    - 수정
  DELETE /api/guide-documents/{id}    - 삭제
  POST   /api/files                   - 이미지 업로드 (orcDtt=가이드문서)
================================================================================
-->
<script setup lang="ts">
import { PROJECT_STAGES } from '~/utils/common';
import { useGuideDocuments } from '~/composables/useGuideDocuments';
import type { GuideDocument } from '~/composables/useGuideDocuments';
import { useFiles } from '~/composables/useFiles';
import type { FileRecord } from '~/composables/useFiles';

definePageMeta({ title: '사업 가이드' });

const { fetchGuideDocuments, createGuideDocument, updateGuideDocument, deleteGuideDocument } = useGuideDocuments();
const { uploadFile, deleteFile, updateFileMeta, getPreviewUrl } = useFiles();
// $apiFetch: 비동기 이벤트 핸들러 내에서 안전한 명령형 fetch (useApiFetch 대신 사용)
const { $apiFetch } = useNuxtApp();
const runtimeConfig = useRuntimeConfig();
const toast = useToast();
const confirm = useConfirm();

/* ── 가이드 문서 전체 목록 ── */
const { data: guideDocuments, refresh: refreshDocuments } = await fetchGuideDocuments();

/* ── 선택된 단계 상태 ── */
/** 현재 선택된 단계명 (기본값: 첫 번째 단계) */
const selectedStage = ref<string>(PROJECT_STAGES[0] ?? '');

/**
 * 현재 선택된 단계에 해당하는 가이드 문서
 * docNm이 선택된 단계명과 일치하는 문서를 찾습니다.
 */
const currentGuide = computed<GuideDocument | null>(() => {
    if (!guideDocuments.value) return null;
    return guideDocuments.value.find(doc => doc.docNm === selectedStage.value) ?? null;
});

/* ── 편집 모드 상태 ── */
/** 편집 모드 활성화 여부 */
const isEditing = ref(false);

/** 에디터에서 편집 중인 HTML 내용 */
const editContent = ref('');

/**
 * 단계 클릭 핸들러
 * 편집 중이면 다른 단계 이동 전 확인합니다.
 */
const selectStage = (stage: string) => {
    if (isEditing.value && stage !== selectedStage.value) {
        confirm.require({
            message: '편집 중인 내용이 있습니다. 저장하지 않고 이동하시겠습니까?',
            header: '이동 확인',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '이동',
            rejectLabel: '취소',
            accept: () => {
                cancelEdit();
                selectedStage.value = stage;
            }
        });
        return;
    }
    selectedStage.value = stage;
    // 단계 변경 시 목차 초기화
    rawToc.value = [];
    activeSection.value = '';
};

/* ── 편집 시작 / 취소 ── */
/**
 * 편집 모드 진입
 * 현재 가이드 내용을 에디터에 로드합니다.
 */
const startEdit = () => {
    editContent.value = currentGuide.value?.docCone ?? '';
    pendingImageIds.value = [];
    pendingFileIds.value = [];
    isEditing.value = true;
    // 편집 시작 시 첨부파일 목록 갱신 (Suggestion 자동완성용)
    refreshAttachments();
};

/**
 * 편집 취소
 * 에디터 내용을 초기화하고 조회 모드로 돌아갑니다.
 */
const cancelEdit = () => {
    isEditing.value = false;
    editContent.value = '';
    pendingImageIds.value = [];
    pendingFileIds.value = [];
};

/* ── 이미지 업로드 관련 상태 ── */
/**
 * 신규 문서 작성 시 에디터 내 이미지 업로드 후 수집된 파일관리번호 목록
 * 문서 저장 후 orcPkVl을 실제 docMngNo로 업데이트합니다.
 */
const pendingImageIds = ref<string[]>([]);

/* ── 첨부파일 관련 상태 (FR-05) ── */
/**
 * 신규 문서 작성 시 에디터에서 업로드된 첨부파일 파일관리번호 목록
 * 문서 저장 후 orcPkVl을 실제 docMngNo로 업데이트합니다.
 */
const pendingFileIds = ref<string[]>([]);

/**
 * 현재 가이드 문서에 연결된 첨부파일 목록
 * Suggestion 자동완성(FR-05-3) 및 파일 첨부 다이얼로그에서 사용합니다.
 * docMngNo가 바뀔 때마다 갱신합니다.
 */
const attachmentListData = ref<Array<{ flMngNo: string; flNm: string; flSz: number }>>([]);

/**
 * 현재 문서의 첨부파일 목록 조회
 * useApiFetch(useFetch 래퍼) 대신 $apiFetch를 사용합니다.
 * useApiFetch는 setup 컨텍스트에서만 호출 가능하지만,
 * $apiFetch는 비동기 이벤트 핸들러에서도 안전하게 호출됩니다.
 */
const refreshAttachments = async () => {
    const docMngNo = currentGuide.value?.docMngNo;
    if (!docMngNo) {
        attachmentListData.value = [];
        return;
    }
    try {
        const files = await $apiFetch<FileRecord[]>(
            `${runtimeConfig.public.apiBase}/api/files`,
            { query: { orcDtt: '가이드문서', orcPkVl: docMngNo } }
        );
        attachmentListData.value = (files ?? [])
            .filter(f => f.flDtt === '첨부파일')
            .map(f => ({
                flMngNo: f.flMngNo,
                flNm: f.orcFlNm,
                flSz: 0, // FileRecord에 flSz 없음 → 0으로 초기화
            }));
    } catch {
        // 목록 조회 실패는 조용히 무시 (Suggestion 자동완성이 빈 목록으로 동작)
        attachmentListData.value = [];
    }
};

/**
 * Tiptap 에디터 이미지 업로드 핸들러
 * - 기존 문서: docMngNo를 orcPkVl로 직접 사용
 * - 신규 문서: 빈 문자열로 임시 업로드 후 저장 시 업데이트
 *
 * @param file - 업로드할 이미지 파일
 * @returns 에디터에 삽입할 이미지 URL
 */
const handleEditorImageUpload = async (file: File): Promise<string> => {
    try {
        const orcPkVl = currentGuide.value?.docMngNo ?? '';
        const result = await uploadFile(file, '이미지', orcPkVl, '가이드문서');
        if (!currentGuide.value) {
            // 신규 문서: 저장 후 orcPkVl 업데이트를 위해 파일관리번호 추적
            pendingImageIds.value.push(result.flMngNo);
        }
        return getPreviewUrl(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({
            severity: 'error',
            summary: '이미지 업로드 실패',
            detail: e?.data?.message || '이미지 업로드 중 오류가 발생했습니다.',
            life: 4000
        });
        throw e;
    }
};

/**
 * Tiptap 에디터 첨부파일 업로드 핸들러 (FR-05-1)
 * TiptapToolbar의 "파일 첨부" 버튼 클릭 시 호출됩니다.
 * 신규 문서인 경우 pendingFileIds에 추적하여 저장 후 orcPkVl을 업데이트합니다.
 *
 * Design Ref: §8 — guide/index.vue 신규 Props 전달
 * @param file - 업로드할 파일
 * @returns { flMngNo, flNm, flSz } — attachment 노드 속성
 */
const handleEditorFileUpload = async (file: File): Promise<{ flMngNo: string; flNm: string; flSz: number }> => {
    try {
        const orcPkVl = currentGuide.value?.docMngNo ?? '';
        const result = await uploadFile(file, '첨부파일', orcPkVl, '가이드문서');
        if (!currentGuide.value) {
            // 신규 문서: 저장 후 orcPkVl 업데이트를 위해 추적
            pendingFileIds.value.push(result.flMngNo);
            
            // 신규 문서의 경우 목록을 즉시 갱신할 도구가 없으므로 로컬 상태에 추가
            attachmentListData.value.push({
                flMngNo: result.flMngNo,
                flNm: result.orcFlNm,
                flSz: 0,
            });
        } else {
            // 기존 문서: 즉시 목록 갱신 (Suggestion 자동완성에 반영)
            await refreshAttachments();
        }
        return {
            flMngNo: result.flMngNo,
            flNm: result.orcFlNm,
            flSz: 0,
        };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({
            severity: 'error',
            summary: '첨부파일 업로드 실패',
            detail: e?.data?.message || '파일 업로드 중 오류가 발생했습니다.',
            life: 4000
        });
        throw e;
    }
};

/** Tiptap 에디터 첨부파일 삭제 핸들러 */
const handleEditorFileDelete = async (flMngNo: string) => {
    try {
        await deleteFile(flMngNo);
        toast.add({ severity: 'success', summary: '삭제 완료', detail: '파일이 서버에서 삭제되었습니다.', life: 3000 });
        
        if (!currentGuide.value) {
            // 신규 문서: 추적 목록 및 로컬 목록에서 제거
            pendingFileIds.value = pendingFileIds.value.filter(id => id !== flMngNo);
            attachmentListData.value = attachmentListData.value.filter(item => item.flMngNo !== flMngNo);
        } else {
            // 기존 문서: 목록 재조회
            await refreshAttachments();
        }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '삭제 실패', detail: e?.data?.message || '파일 삭제 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/* ── 저장 처리 ── */
const isSaving = ref(false);

/**
 * 가이드 문서 저장
 * - 기존 문서: PUT으로 내용 업데이트
 * - 신규 문서: POST로 생성 후 이미지 파일 메타 업데이트
 */
const onSave = async () => {
    isSaving.value = true;
    try {
        if (currentGuide.value) {
            // 기존 문서 수정 (PUT)
            await updateGuideDocument(currentGuide.value.docMngNo, {
                docNm: selectedStage.value,
                docCone: editContent.value
            });
            toast.add({ severity: 'success', summary: '저장 완료', detail: '가이드가 수정되었습니다.', life: 3000 });
        } else {
            // 신규 문서 생성 (POST)
            const newDocMngNo = await createGuideDocument({
                docNm: selectedStage.value,
                docCone: editContent.value
            });

            // 에디터 내 이미지·첨부파일의 orcPkVl을 실제 docMngNo로 병렬 업데이트
            const allPendingIds = [...pendingImageIds.value, ...pendingFileIds.value];
            await Promise.all(allPendingIds.map(flMngNo => updateFileMeta(flMngNo, { orcPkVl: newDocMngNo })));

            toast.add({ severity: 'success', summary: '저장 완료', detail: '가이드가 등록되었습니다.', life: 3000 });
        }

        await refreshDocuments();
        cancelEdit();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        toast.add({
            severity: 'error',
            summary: '저장 실패',
            detail: e?.data?.message || '저장 중 오류가 발생했습니다.',
            life: 4000
        });
    } finally {
        isSaving.value = false;
    }
};

/* ── 삭제 처리 ── */
const onDelete = () => {
    if (!currentGuide.value) return;
    confirm.require({
        message: `'${selectedStage.value}' 가이드를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            try {
                await deleteGuideDocument(currentGuide.value!.docMngNo);
                await refreshDocuments();
                rawToc.value = [];
                activeSection.value = '';
                cancelEdit();
                toast.add({ severity: 'success', summary: '삭제 완료', detail: '가이드가 삭제되었습니다.', life: 3000 });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
                toast.add({
                    severity: 'error',
                    summary: '삭제 실패',
                    detail: e?.data?.message || '삭제 중 오류가 발생했습니다.',
                    life: 4000
                });
            }
        }
    });
};

/**
 * 최종 변경 일시를 사람이 읽기 쉬운 형식으로 변환
 * @param dtm - ISO 8601 일시 문자열
 * @returns 'YYYY-MM-DD HH:mm' 형식
 */
const formatDateTime = (dtm?: string): string => {
    if (!dtm) return '';
    try {
        return new Date(dtm).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return dtm;
    }
};

// 선택된 단계(문서) 변경 시 첨부파일 목록 갱신
watch(currentGuide, () => {
    if (!isEditing.value) refreshAttachments();
});

/* ── TOC 상태 관리 ── */
const rawToc = ref<Array<{ id: string; level: number; text: string }>>([]);
const activeSection = ref('');

/**
 * TiptapEditor(조회/편집 모두)에서 올라온 TOC 이벤트 핸들러
 * 단계가 변경될 때마다 TiptapEditor가 새 TOC를 emit합니다.
 */
const handleUpdateToc = (toc: Array<{ id: string; level: number; text: string }>) => {
    rawToc.value = toc;
};

/**
 * 목차 항목 클릭 시 해당 헤딩으로 부드럽게 스크롤
 * TiptapEditor 내부 Heading 확장의 scroll-margin-top이 여백 역할을 합니다.
 */
const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        activeSection.value = id;
    }
};

/* ── IntersectionObserver: 스크롤 시 목차 활성화 동기화 ── */
let observer: IntersectionObserver | null = null;
const observerElements = new Set<Element>();

// DOM 렌더링 후 h1~h6 요소를 추적하도록 목차 변경 시마다 갱신
watch(rawToc, async () => {
    await nextTick();
    if (observer) {
        observerElements.forEach(el => observer?.unobserve(el));
        observerElements.clear();
    }

    rawToc.value.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            observer?.observe(el);
            observerElements.add(el);
        }
    });
}, { deep: true });

/* ── 전체 화면 모드 (Fullscreen) ── */
const isFullscreen = ref(false);
const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
};

// Esc 키로 전체 화면 종료
const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFullscreen.value) {
        isFullscreen.value = false;
    }
};

// keepalive로 캐시된 페이지가 다시 활성화될 때 편집 모드 초기화
onActivated(() => {
    if (isEditing.value) {
        cancelEdit();
    }
});

onMounted(() => {
    observer = new IntersectionObserver(
        (entries) => {
            // 화면에 보이는 헤딩 중 첫 번째를 활성 섹션으로 지정
            const visibleEntries = entries.filter(e => e.isIntersecting);
            if (visibleEntries.length > 0) {
                const id = visibleEntries[0]?.target?.id;
                if (id) activeSection.value = id;
            }
        },
        { rootMargin: '-10% 0px -80% 0px' }
    );

    // 초기 렌더링된 헤딩 관찰 시작 (watch(rawToc)이 이후 변경을 처리)
    document.querySelectorAll('.guide-doc h1, .guide-doc h2, .guide-doc h3, .guide-doc h4').forEach(h => {
        observer?.observe(h);
        observerElements.add(h);
    });

    window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    if (observer) observer.disconnect();
    window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
    <div
:class="[
        'flex flex-col overflow-hidden transition-all duration-300',
        isFullscreen
            ? 'fixed inset-0 z-[100] bg-zinc-50 dark:bg-zinc-950 p-4'
            : 'h-full'
    ]" :style="{ gap: isFullscreen ? '0' : '1.5rem' }">

        <!-- 페이지 헤더: 제목 + 정보화사업 단계 타임라인 통합 카드 -->
        <!-- 전체 화면에서는 타임라인을 숨겨 에디터 공간을 극대화 (Clean Workspace) -->
        <div
v-if="!isFullscreen"
            class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md px-5 py-4 flex items-center gap-5 min-h-[80px]">

            <!-- 좌: 제목/부제목 -->
            <div class="shrink-0">
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">사업 가이드</h1>
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 whitespace-nowrap">
                    정보화사업 단계별 업무 가이드를 확인하세요.
                </p>
            </div>

            <!-- 구분선 -->
            <div class="self-stretch w-px bg-zinc-100 dark:bg-zinc-800 shrink-0"/>

            <!-- 우: 정보화사업 단계 타임라인 -->
            <div class="flex-1 min-w-0">
                <!-- 타임라인 컨테이너 -->
                <div class="relative w-full px-2">
                    <!-- 전체 기준선 (회색): 첫 원 중심 ~ 마지막 원 중심 -->
                    <div
class="absolute h-[2px] bg-zinc-200 dark:bg-zinc-700" :style="{
                        top: '19px',
                        left: `calc(100% / ${PROJECT_STAGES.length * 2})`,
                        right: `calc(100% / ${PROJECT_STAGES.length * 2})`
                    }"/>

                    <div class="flex items-start justify-between w-full">
                        <!-- 각 단계 스텝 -->
                        <div
v-for="(step, index) in PROJECT_STAGES" :key="index"
                            class="relative flex flex-col items-center flex-1 group cursor-pointer"
                            @click="selectStage(step)">

                            <!-- 원형 마커: 선택됨(인디고 채움) / 비선택(회색) -->
                            <div
class="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold border-2 transition-all duration-300 relative z-10 mb-2 shrink-0"
                                :class="[
                                    selectedStage === step
                                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 scale-110 ring-4 ring-indigo-50 dark:ring-indigo-900/20'
                                        : 'border-zinc-200 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500 bg-white dark:bg-zinc-900 hover:border-zinc-300 hover:scale-105'
                                ]">

                                <!-- 선택된 단계: v 체크 아이콘 -->
                                <i v-if="selectedStage === step" class="pi pi-check text-sm"/>
                                <!-- 비선택 단계: 순번 표시 (leading-none으로 폰트 하단 여백 제거) -->
                                <span v-else class="text-xs leading-none">{{ Number(index) + 1 }}</span>
                            </div>

                            <!-- 단계 라벨 텍스트 (items-center로 광학적 상단 쏠림 보정) -->
                            <div class="flex items-center justify-center w-full">
                                <span
                                    class="text-[12px] font-medium text-center break-keep leading-snug px-0.5 transition-colors duration-300 w-full"
                                    :class="[
                                        selectedStage === step
                                            ? 'text-indigo-700 dark:text-indigo-400 font-bold'
                                            : 'text-zinc-400 dark:text-zinc-600'
                                    ]">
                                    {{ step }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 메인: 콘텐츠(3/4) + 바로가기 목차(1/4) -->
        <div class="grid grid-cols-1 xl:grid-cols-4 gap-8 flex-1 min-h-0">

            <!-- 좌측(3/4): 가이드 내용 (조회/편집 모드 통합 카드, 전체 높이 점유) -->
            <div class="xl:col-span-3 flex flex-col min-h-0 overflow-hidden p-1">
                <div
                    class="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-md flex-1 flex flex-col min-h-0 overflow-hidden">

                    <!-- 콘텐츠 헤더 (고정 높이 72px) -->
                    <div
                        class="flex items-center justify-between px-6 h-[72px] border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
                        <div class="flex-1 min-w-0">
                            <h2
                                class="font-bold text-base text-zinc-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                                <i class="pi pi-book text-indigo-500"/>
                                {{ selectedStage }}
                                <span
v-if="isEditing"
                                    class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-800 ml-1">
                                    편집 중
                                </span>
                                <span
v-else-if="!currentGuide"
                                    class="inline-flex items-center text-[10px] font-medium px-2 py-0.5 bg-zinc-50 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 rounded-full border border-zinc-200 dark:border-zinc-700 ml-1">
                                    미작성
                                </span>
                            </h2>
                            <!-- 마지막 수정 일시 -->
                            <p v-if="currentGuide && !isEditing" class="text-[10px] text-zinc-400 mt-0.5 truncate">
                                마지막 수정: {{ formatDateTime(currentGuide.lstChgDtm) }}
                                <span v-if="currentGuide.lstChgUsid">· {{ currentGuide.lstChgUsid }}</span>
                            </p>
                        </div>

                        <!-- 액션 버튼들을 콘텐츠 헤더 우측에 배치 -->
                        <div class="shrink-0 ml-4">
                            <!-- 편집 모드 섹션 -->
                            <div v-if="isEditing" class="flex gap-2">
                                <Button label="취소" severity="secondary" size="small" @click="cancelEdit" />
                                <Button label="저장" icon="pi pi-save" size="small" :loading="isSaving" @click="onSave" />
                            </div>
                            <!-- 조회 모드 섹션 -->
                            <div v-else class="flex gap-2">
                                <Button
:label="isFullscreen ? '일반 화면' : '전체 화면'"
                                    :icon="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-expand'" severity="secondary"
                                    outlined size="small" @click="toggleFullscreen" />
                                <Button
:label="currentGuide ? '편집' : '가이드 작성'"
                                    :icon="currentGuide ? 'pi pi-pencil' : 'pi pi-plus'" size="small"
                                    @click="startEdit" />
                            </div>
                        </div>
                    </div>

                    <!-- 에디터 영역 (전체 높이 강제 점유) -->
                    <div
                        class="p-4 guide-doc flex-1 flex flex-col min-h-0 overflow-hidden bg-zinc-50/10 dark:bg-zinc-800/5">
                        <ClientOnly>
                            <!-- 편집 모드 -->
                            <TiptapEditor
v-if="isEditing" v-model="editContent" class="h-full min-h-0"
                                :image-upload-fn="handleEditorImageUpload"
                                :file-upload-fn="handleEditorFileUpload"
                                :file-delete-fn="handleEditorFileDelete"
                                :attachment-list="attachmentListData"
                                @update:toc="handleUpdateToc" />
                            <!-- 조회 모드 -->
                            <TiptapEditor
v-else-if="currentGuide" :model-value="currentGuide.docCone || ''"
                                class="h-full min-h-0" :readonly="true"
                                :attachment-list="attachmentListData"
                                @update:toc="handleUpdateToc" />
                            <!-- 가이드 없음 -->
                            <div v-else class="flex-1 flex flex-col items-center justify-center py-20 text-center">
                                <div
                                    class="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                    <i class="pi pi-file-edit text-2xl text-zinc-400"/>
                                </div>
                                <h3 class="text-base font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                                    아직 가이드가 없습니다
                                </h3>
                                <p class="text-sm text-zinc-400 mb-5">
                                    '{{ selectedStage }}' 단계에 대한 가이드를 작성해주세요.
                                </p>
                                <Button label="가이드 작성" icon="pi pi-plus" @click="startEdit" />
                            </div>

                            <template #fallback>
                                <div
                                    class="tiptap-editor-container relative border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 flex-1 flex flex-col min-h-0">
                                    <i class="pi pi-spin pi-spinner text-2xl mb-2 block"/>
                                    에디터 로딩 중...
                                </div>
                            </template>
                        </ClientOnly>

                    </div>
                </div>
            </div>

            <!-- 우측(1/4): 바로가기 목차 (xl 이상에서만 표시, 독립 스크롤) -->
            <div
                class="xl:col-span-1 hidden xl:flex flex-col h-full min-h-0 bg-white/40 dark:bg-zinc-900/40 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 overflow-hidden shadow-sm">

                <!-- 목차 헤더 (좌측 헤더와 높이 동기화: 72px) -->
                <div
                    class="h-[72px] border-b border-zinc-100 dark:border-zinc-800/50 flex items-center px-5 shrink-0 bg-white/20">
                    <h3
                        class="font-bold text-[13px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <i class="pi pi-align-left text-sm text-zinc-300 dark:text-zinc-600"/> 바로가기 목차
                    </h3>
                </div>

                <!-- 목차 리스트 (독립 스크롤 영역) -->
                <div class="flex-1 overflow-y-auto custom-scrollbar lg:pl-2 pt-4 pb-10">
                    <!-- 목차가 비어있을 때 안내 문구 -->
                    <div v-if="rawToc.length === 0" class="text-xs text-zinc-400 dark:text-zinc-600 italic px-5 ml-2">
                        본문에 제목을 작성하면 이곳에 목차가 자동 정렬됩니다.
                    </div>

                    <!-- 추출된 목차 목록 (평면 다단계 들여쓰기) -->
                    <ul v-else class="flex flex-col relative border-l border-zinc-200 dark:border-zinc-800 ml-5 py-1">
                        <li v-for="item in rawToc" :key="item.id" class="flex flex-col relative py-0.5">

                            <!-- 활성화 인디케이터 (왼쪽 보더선) -->
                            <div
v-if="activeSection === item.id"
                                class="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] bg-indigo-500 rounded-full transition-all"/>

                            <div
class="relative flex items-center py-1 pr-4 cursor-pointer transition-colors duration-200 group"
                                :class="[
                                    activeSection === item.id
                                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                                    item.level === 1 ? 'font-semibold text-[13px] mt-1 pl-4' : '',
                                    item.level === 2 ? 'text-[13px] pl-4' : '',
                                    item.level === 3 ? 'text-[12px] pl-7 opacity-90' : '',
                                    item.level === 4 ? 'text-[12px] pl-10 opacity-80' : '',
                                    item.level === 5 ? 'text-[11px] pl-12 opacity-70' : '',
                                    item.level === 6 ? 'text-[11px] pl-14 opacity-60' : ''
                                ]" @click="scrollTo(item.id)">
                                <span class="truncate" :title="item.text">{{ item.text }}</span>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>

        </div>
    </div>

</template>
