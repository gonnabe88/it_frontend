<!--
================================================================================
[pages/info/documents/form.vue] 요구사항 정의서 신규 작성 페이지
================================================================================
POST /api/documents 를 호출하여 새 요구사항 정의서를 생성합니다.

[라우팅]
  - 접근: /info/documents/form
  - 저장 후: /info/documents (목록으로 이동)
================================================================================
-->
<script setup lang="ts">
import { useDocuments } from '~/composables/useDocuments';
import type { RequirementDocumentForm } from '~/composables/useDocuments';
import { useFiles } from '~/composables/useFiles';

const title = '요구사항 정의서 작성';
definePageMeta({ title });

const { createDocument } = useDocuments();
const { uploadFile, uploadFilesBulk, updateFileMeta, deleteFile, getPreviewUrl } = useFiles();
const toast = useToast();
const router = useRouter();
const { removeTab } = useTabs();

/**
 * 요구사항 정의서 본문 기본 템플릿 (Tiptap HTML)
 * 신규 작성 시 이 형식이 강제되어 모든 문서가 동일한 구조를 유지합니다.
 * 각 H3 섹션은 우측 목차(TOC)에 자동으로 등록됩니다.
 */
const DEFAULT_CONTENT_TEMPLATE = [
    '<h2>[REQ-001] (신규/변경) 요구사항명</h2>',

    '<h3>주요 내용</h3>',
    '<p>주요 내용을 기술합니다.</p>',

    '<h3>화면 구성 : (신규) or (변경) 기존 화면명</h3>',
    '<p>화면 구성에 대한 내용을 기술합니다. 다이어그램을 통해 화면을 도식화하여 표현해주세요.</p>',

    '<h3>업무 절차</h3>',
    '<p>이번 기능과 관련된 전/후 업무 절차를 기술합니다. 다이어그램을 통해 업무 절차를 도식화하여 표현해주세요.</p>',

    '<h3>참조 업무 : 없음 or 기존 업무(기능)</h3>',
    '<p>이번 기능 구현 시 유사성이 높아 참조하면 좋을 기존 업무가 있다면 기술합니다.</p>',

    '<h3>구현 시 고려사항(예외 처리 등)</h3>',
    '<ol>',
    '<li><p>핵심적으로 고려해야 할 사항 또는 놓치기 쉬운 예외 상황에 대해 기술해주세요. #1</p></li>',
    '<li><p>핵심적으로 고려해야 할 사항 또는 놓치기 쉬운 예외 상황에 대해 기술해주세요. #2</p></li>',
    '</ol>',

    '<h3>단위 테스트 케이스</h3>',
    '<ol>',
    '<li><p>반드시 테스트해야할 케이스에 대해 기술해주세요. #1</p></li>',
    '<li><p>반드시 테스트해야할 케이스에 대해 기술해주세요. #2</p></li>',
    '</ol>'
].join('');

/* ── 폼 데이터 ── */
const form = reactive<RequirementDocumentForm>({
    reqNm: '',
    reqCone: DEFAULT_CONTENT_TEMPLATE, // 신규 작성 시 표준 템플릿으로 초기화
    reqDtt: '',
    bzDtt: '',
    fsgTlm: ''
});

/** DatePicker 바인딩용 Date 객체 (완료기한만 날짜 선택) */
const fsgTlmDate = ref<Date | null>(null);

/** Date → YYYY-MM-DD 변환 */
const formatDateStr = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0]!;
};

// 완료기한 DatePicker 변경 시 form 문자열 동기화
watch(fsgTlmDate, (d) => { form.fsgTlm = formatDateStr(d); });

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

/* ── 첨부파일 관련 상태 ── */
/** 파일 선택 input 참조 */
const attachmentInputRef = ref<HTMLInputElement | null>(null);

/**
 * 저장 전 로컬에 임시 보관하는 첨부파일 목록
 * 문서 저장 후 PK(docMngNo)를 얻은 뒤 일괄 업로드합니다.
 */
const pendingAttachments = ref<File[]>([]);

/**
 * 에디터 내 이미지 업로드 후 수집된 파일관리번호 목록
 * 문서 저장 후 orcPkVl을 실제 docMngNo로 업데이트합니다.
 */
const pendingImageIds = ref<string[]>([]);

/** 에디터 다이얼로그를 통해 업로드된 첨부파일 ID 목록 */
const pendingAttachmentIds = ref<string[]>([]);

/** 에디터 다이얼로그용 첨부파일 목록 상태 (실시간 업로드된 파일 표시용) */
const editorAttachments = ref<Array<{ flMngNo: string; flNm: string; flSz: number }>>([]);

/** 파일 크기를 사람이 읽기 쉬운 형식으로 변환 */
const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/**
 * 첨부파일 추가 핸들러
 * 파일 선택 input에서 선택된 파일을 pendingAttachments에 추가합니다.
 */
const addAttachments = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(f => pendingAttachments.value.push(f));
    // 동일 파일을 다시 선택할 수 있도록 input 초기화
    input.value = '';
};

/**
 * 첨부파일 제거 핸들러
 * @param index - pendingAttachments 배열 인덱스
 */
const removeAttachment = (index: number) => {
    pendingAttachments.value.splice(index, 1);
};

/**
 * Tiptap 에디터 이미지 업로드 핸들러 (신규 문서용)
 * 신규 문서는 아직 PK(docMngNo)가 없으므로 orcPkVl을 빈 문자열로 임시 업로드하고,
 * 문서 저장 후 updateFileMeta()로 실제 docMngNo를 업데이트합니다.
 * @param file - 업로드할 이미지 파일
 * @returns 에디터에 삽입할 이미지 미리보기 URL
 */
const handleEditorImageUpload = async (file: File): Promise<string> => {
    try {
        const result = await uploadFile(file, '이미지', '', '요구사항정의서');
        // 저장 후 orcPkVl 업데이트를 위해 파일관리번호 추적
        pendingImageIds.value.push(result.flMngNo);
        // FileRecord 객체를 전달 → 서버 응답의 previewUrl 필드 우선 사용
        return getPreviewUrl(result);
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '이미지 업로드 실패', detail: e?.data?.message || '이미지 업로드 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/** Tiptap 에디터 첨부파일 업로드 핸들러 (신규 작성용) */
const handleEditorFileUpload = async (file: File) => {
    try {
        const result = await uploadFile(file, '첨부파일', '', '요구사항정의서');
        pendingAttachmentIds.value.push(result.flMngNo);
        
        const newItem = {
            flMngNo: result.flMngNo,
            flNm:    result.orcFlNm,
            flSz:    0,
        };
        editorAttachments.value.push(newItem);
        return newItem;
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '파일 업로드 실패', detail: e?.data?.message || '파일 업로드 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/** Tiptap 에디터 첨부파일 삭제 핸들러 (신규 작성용) */
const handleEditorFileDelete = async (flMngNo: string) => {
    try {
        await deleteFile(flMngNo);
        pendingAttachmentIds.value = pendingAttachmentIds.value.filter(id => id !== flMngNo);
        editorAttachments.value = editorAttachments.value.filter(item => item.flMngNo !== flMngNo);
        toast.add({ severity: 'success', summary: '삭제 완료', detail: '파일이 서버에서 삭제되었습니다.', life: 3000 });
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '삭제 실패', detail: e?.data?.message || '파일 삭제 중 오류가 발생했습니다.', life: 4000 });
        throw e;
    }
};

/* ── 저장 처리 ── */
const isSaving = ref(false);

const onSave = async () => {
    if (!validate()) return;

    isSaving.value = true;
    try {
        // 1단계: 요구사항 정의서 저장 (PK 획득)
        const newDoc = await createDocument(form);
        const docMngNo = newDoc.docMngNo;

        // 2단계: 첨부파일 일괄 업로드 (PK를 orcPkVl로 설정)
        if (pendingAttachments.value.length > 0) {
            await uploadFilesBulk(pendingAttachments.value, '첨부파일', docMngNo, '요구사항정의서');
        }

        // 3단계: 에디터 내 이미지 및 첨부파일의 orcPkVl을 실제 docMngNo로 업데이트
        for (const flMngNo of pendingImageIds.value) {
            await updateFileMeta(flMngNo, { orcPkVl: docMngNo });
        }
        for (const flMngNo of pendingAttachmentIds.value) {
            await updateFileMeta(flMngNo, { orcPkVl: docMngNo });
        }

        toast.add({ severity: 'success', summary: '저장 완료', detail: '요구사항 정의서가 등록되었습니다.', life: 3000 });
        /* 저장 후 상세 화면으로 이동 + form 탭 닫기 */
        await router.push(`/info/documents/${docMngNo}`);
        removeTab('/info/documents/form');
    } catch (e: any) {
        toast.add({ severity: 'error', summary: '저장 실패', detail: e?.data?.message || '저장 중 오류가 발생했습니다.', life: 4000 });
    } finally {
        isSaving.value = false;
    }
};

const onCancel = () => {
    router.push('/info/documents');
    removeTab('/info/documents/form');
};

/* ── AI 반영 처리 ── */
/**
 * AI 응답 내용을 요구사항 정의서 본문(reqCone)에 반영합니다.
 */
const onApplyAiContent = (content: string) => {
    form.reqCone = content;
    toast.add({ severity: 'success', summary: '반영 완료', detail: 'AI 응답이 요구사항 정의서 본문에 반영되었습니다.', life: 3000 });
};

/**
 * AI 채팅에 전달할 전체 문서 컨텍스트
 * 기본 정보(요구사항명, 요청구분, 업무구분, 완료기한) + 요청내용 본문을 조합합니다.
 */
const documentContext = computed(() => [
    `요구사항명: ${form.reqNm}`,
    `요청구분: ${form.reqDtt}`,
    `업무구분: ${form.bzDtt}`,
    `완료기한: ${form.fsgTlm}`,
    '',
    '[요청내용]',
    form.reqCone
].join('\n'));

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
        // 스크롤 시 부드럽게 이동하고 약간 위쪽으로 여유 공간(offset)을 주어 헤더나 여백에 가리지 않게 함
        const offset = 100;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
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
                // 위치 기준 내림차순 등으로 정교화할 수 있지만 간단히 첫번째 요소 채택
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

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
                <Button icon="pi pi-arrow-left" severity="secondary" text rounded @click="onCancel" />
                <div>
                    <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">새로운 요구사항 정의서를 작성합니다.</p>
                </div>
            </div>
            <div class="flex gap-2">
                <Button label="취소" severity="secondary" @click="onCancel" />
                <Button label="저장" icon="pi pi-save" :loading="isSaving" @click="onSave" />
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

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

                        <!-- 요구사항명 (전체 폭) -->
                        <div class="md:col-span-2 flex flex-col gap-1.5">
                            <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                요구사항명 <span class="text-red-500">*</span>
                            </label>
                            <InputText v-model="form.reqNm" placeholder="요구사항명을 입력하세요" class="w-full" maxlength="200" />
                        </div>

                        <!-- 요청구분 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                요청구분 <span class="text-red-500">*</span>
                            </label>
                            <Textarea v-model="form.reqDtt" placeholder="요청구분을 입력하세요" rows="3"
                                class="w-full resize-none" />
                        </div>

                        <!-- 업무구분 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">업무구분</label>
                            <Textarea v-model="form.bzDtt" placeholder="업무구분을 입력하세요" rows="3"
                                class="w-full resize-none" />
                        </div>

                        <!-- 완료기한 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">완료기한</label>
                            <DatePicker v-model="fsgTlmDate" placeholder="YYYY-MM-DD" showIcon fluid
                                dateFormat="yy-mm-dd" />
                        </div>

                        <!-- 첨부파일 영역 -->
                        <div class="md:col-span-2 flex flex-col gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-1">
                            <div class="flex items-center justify-between">
                                <label class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                    <i class="pi pi-paperclip text-zinc-400"></i> 첨부파일
                                </label>
                                <Button icon="pi pi-plus" label="파일 추가" size="small" severity="secondary" outlined
                                    @click="attachmentInputRef?.click()" />
                            </div>

                            <!-- 숨김 파일 input (다중 선택 허용) -->
                            <input ref="attachmentInputRef" type="file" multiple class="hidden"
                                @change="addAttachments" />

                            <!-- 선택된 파일 없을 때 안내 -->
                            <div v-if="pendingAttachments.length === 0"
                                class="text-xs text-zinc-400 dark:text-zinc-600 italic py-3 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                                파일 추가 버튼을 클릭하여 첨부파일을 등록하세요. (저장 시 업로드됩니다)
                            </div>

                            <!-- 선택된 첨부파일 목록 -->
                            <ul v-else class="space-y-1.5">
                                <li v-for="(file, idx) in pendingAttachments" :key="idx"
                                    class="flex items-center gap-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2">
                                    <i class="pi pi-file text-indigo-400 text-sm flex-shrink-0"></i>
                                    <span class="flex-1 truncate text-zinc-700 dark:text-zinc-300" :title="file.name">{{
                                        file.name }}</span>
                                    <span class="text-xs text-zinc-400 flex-shrink-0">{{ formatFileSize(file.size)
                                    }}</span>
                                    <button class="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0 ml-1"
                                        title="첨부파일 제거" @click="removeAttachment(idx)">
                                        <i class="pi pi-times text-xs"></i>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- 요청내용 에디터 카드 -->
                <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <div class="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                        <h2 class="text-base font-semibold text-zinc-800 dark:text-zinc-200">요청내용</h2>
                        <p class="text-xs text-zinc-400 mt-0.5">표준 양식이 적용되어 있습니다. 각 섹션의 안내 문구를 실제 내용으로 교체하여 작성하세요. 툴바의 <strong>다이어그램</strong> 버튼으로 Excalidraw 그림을 삽입할 수 있습니다.</p>
                    </div>
                    <div class="p-4">
                        <ClientOnly>
                            <TiptapEditor v-model="form.reqCone" placeholder="요구사항 상세 내용을 입력하세요..."
                                :imageUploadFn="handleEditorImageUpload"
                                :fileUploadFn="handleEditorFileUpload"
                                :fileDeleteFn="handleEditorFileDelete"
                                :attachmentList="editorAttachments"
                                @update:toc="handleUpdateToc" />
                            <template #fallback>
                                <div
                                    class="border border-zinc-200 dark:border-zinc-700 rounded-xl p-8 text-center text-zinc-400">
                                    <i class="pi pi-spin pi-spinner text-2xl mb-2 block"></i>
                                    에디터 로딩 중...
                                </div>
                            </template>
                        </ClientOnly>
                    </div>
                </div>

                <!-- 하단 액션 버튼 -->
                <div class="flex justify-end gap-3 pb-4">
                    <Button label="취소" severity="secondary" @click="onCancel" />
                    <Button label="저장" icon="pi pi-save" :loading="isSaving" @click="onSave" />
                </div>
            </div> <!-- // 좌측(3/4) 영역 종료 -->

            <!-- 우측 측면 사이드바: 반응형 환경에서 보통 모니터 화면(xl) 이상일 때 표시 -->
            <div class="xl:col-span-1 relative hidden xl:block" data-chat-anchor>
                <!-- 스티키 고정 박스 영역 -->
                <div class="sticky top-6 lg:pl-4">
                    <h3
                        class="font-bold text-[14px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4 px-3 flex items-center gap-2">
                        <i class="pi pi-align-left text-sm text-zinc-300 dark:text-zinc-600"></i> 바로가기 목차
                    </h3>

                    <!-- 목차가 비어있을 때 안내 문구 -->
                    <div v-if="rawToc.length === 0" class="text-xs text-zinc-400 dark:text-zinc-600 italic px-3 ml-3">
                        본문에 제목을 작성하면 이곳에 목차가 자동 정렬됩니다.
                    </div>

                    <!-- 추출된 목차 목록 (평면 다단계 들여쓰기) -->
                    <ul v-else class="flex flex-col relative border-l border-zinc-200 dark:border-zinc-800 ml-3 py-1">
                        <li v-for="item in rawToc" :key="item.id" class="flex flex-col relative py-0.5">
                            <!-- 활성화 인디케이터 (왼쪽 보더선) -->
                            <div v-if="activeSection === item.id"
                                class="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] bg-indigo-500 rounded-full transition-all">
                            </div>

                            <div class="relative flex items-center py-1 pr-4 cursor-pointer transition-colors duration-200 group"
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

        </div> <!-- // grid 분할 영역 종료 -->

    </div>

    <!-- AI 채팅 플로팅 패널 -->
    <GeminiChat
        systemInstruction="당신은 IT 프로젝트 요구사항 분석 전문가입니다. 응답은 HTML로 작성해주세요. 사용자가 요구사항 정의서 초안을 작성할 수 있도록 도와주세요. 사용자가 요구사항을 입력하면, 요구사항 정의서의 각 항목에 맞게 내용을 정리하고, 누락된 항목이 있다면 추가할 내용을 제안해주세요. 작성된 요구사항을 함께 보내주면 추가,수정한 부분을 html로 표시해주세요."
        :documentContent="documentContext"
        :flMngNos="pendingImageIds"
        @apply-content="onApplyAiContent" />
</template>
