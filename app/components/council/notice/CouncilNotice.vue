<!--
================================================================================
[components/council/notice/CouncilNotice.vue]
일정공지 컴포넌트 (Step 2 — 탭3)
================================================================================
협의회 SCHEDULED 이후 안건/회의개요/진행순서/관련자료를 표출합니다.
CouncilDetail에서 회의 일시·장소 정보를 받아 표출합니다.

[Props]
  asctId        : 협의회ID
  councilDetail : 협의회 상세 정보 (일시·장소 포함)
  feasibility   : 타당성검토표 데이터 (사업명·사업내용 표출용)

[관련자료]
  - orcDtt='협의회관련자료', orcPkVl=asctId 로 파일 관리
  - IT관리자: 파일 업로드·삭제 가능
  - 다운로드: 쿠키 인증이 필요하므로 fetch + Blob URL 방식 사용

[Design Ref: §4.3 prepare/[id].vue — 탭3 일정공지]
================================================================================
-->
<script setup lang="ts">
import type { CouncilDetail, FeasibilityData } from '~/types/council';
import type { FileRecord } from '~/composables/useFiles';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    councilDetail: CouncilDetail | null;
    feasibility: FeasibilityData | null;
}

const props = defineProps<Props>();

// ── 회의 개요 ───────────────────────────────────────────────────────────

/** 날짜 형식 변환: yyyy-MM-dd → yyyy년 MM월 dd일 */
const formatDate = (dt: string | null): string => {
    if (!dt) return '—';
    const [y, m, d] = dt.split('-');
    return `${y}년 ${m}월 ${d}일`;
};

/** 회의 일시 조합 */
const meetingDateTime = computed(() => {
    const dt = formatDate(props.councilDetail?.cnrcDt ?? null);
    const tm = props.councilDetail?.cnrcTm ?? '';
    return tm ? `${dt} ${tm}` : dt;
});

/** 회의 장소 */
const meetingPlace = computed(() => props.councilDetail?.cnrcPlc ?? '—');

/** 안건: 사업내용 요약 (타당성검토표 prjDes 활용) */
const agenda = computed(() => props.feasibility?.prjDes ?? '—');

/** 사업명 */
const projectName = computed(() => props.feasibility?.prjNm ?? '—');

// ── 진행순서 (고정 항목) ─────────────────────────────────────────────────
const proceedings = [
    { seq: 1, item: '개회 선언' },
    { seq: 2, item: '안건 소개 (추진부서 담당자)' },
    { seq: 3, item: '타당성 자체점검 결과 보고' },
    { seq: 4, item: '질의응답 및 토의' },
    { seq: 5, item: '종합의견 취합' },
    { seq: 6, item: '폐회' },
];

// ── 관련자료 파일 관리 ───────────────────────────────────────────────────

/** 파일 원본구분 코드 */
const ORG_DTT = '협의회관련자료';

const { fetchFiles, uploadFile, deleteFile, getDownloadUrl } = useFiles();
const toast = useToast();

/** 기존 업로드 파일 목록 조회 */
const {
    data: filesData,
    pending: loadingFiles,
    refresh: refreshFiles,
} = fetchFiles(ORG_DTT, props.asctId);

const files = computed<FileRecord[]>(() => filesData.value ?? []);

// ── 업로드 ─────────────────────────────────────────────────────────────

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

/**
 * 파일 선택 후 일괄 업로드
 * 선택한 파일을 순차적으로 POST /api/files 에 전송합니다.
 */
const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const selected = Array.from(input.files);
    uploading.value = true;

    try {
        for (const file of selected) {
            await uploadFile(file, '첨부파일', props.asctId, ORG_DTT);
        }
        toast.add({
            severity: 'success',
            summary: '업로드 완료',
            detail: `${selected.length}개 파일이 첨부되었습니다.`,
            life: 3000,
        });
        await refreshFiles();
    } catch {
        toast.add({
            severity: 'error',
            summary: '업로드 실패',
            detail: '파일 업로드 중 오류가 발생했습니다.',
            life: 3000,
        });
    } finally {
        uploading.value = false;
        /* 동일 파일 재선택 허용을 위해 input 초기화 */
        input.value = '';
    }
};

// ── 다운로드 ────────────────────────────────────────────────────────────

const downloading = ref<string | null>(null);

/**
 * 파일 다운로드 (fetch + Blob URL)
 * httpOnly 쿠키 인증이 필요하므로 <a href> 대신 fetch credentials:'include' 사용
 */
const handleDownload = async (file: FileRecord) => {
    if (downloading.value) return;
    downloading.value = file.flMngNo;
    try {
        const response = await fetch(getDownloadUrl(file), { credentials: 'include' });
        if (!response.ok) throw new Error('download failed');

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.orcFlNm;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch {
        toast.add({
            severity: 'error',
            summary: '다운로드 실패',
            detail: '파일 다운로드 중 오류가 발생했습니다.',
            life: 3000,
        });
    } finally {
        downloading.value = null;
    }
};

// ── 삭제 ────────────────────────────────────────────────────────────────

const deleting = ref<string | null>(null);

/**
 * 파일 단건 삭제
 */
const handleDelete = async (file: FileRecord) => {
    deleting.value = file.flMngNo;
    try {
        await deleteFile(file.flMngNo);
        await refreshFiles();
        toast.add({
            severity: 'success',
            summary: '삭제 완료',
            detail: `${file.orcFlNm} 파일이 삭제되었습니다.`,
            life: 2000,
        });
    } catch {
        toast.add({
            severity: 'error',
            summary: '삭제 실패',
            detail: '파일 삭제 중 오류가 발생했습니다.',
            life: 3000,
        });
    } finally {
        deleting.value = null;
    }
};
</script>

<template>
    <div class="space-y-6">

        <!-- ── 회의 개요 ── -->
        <div class="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-5 border border-indigo-100 dark:border-indigo-800">
            <h3 class="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-4">
                회의 개요
            </h3>
            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div class="flex gap-3">
                    <dt class="text-zinc-400 w-16 shrink-0">사업명</dt>
                    <dd class="font-medium text-zinc-800 dark:text-zinc-200">{{ projectName }}</dd>
                </div>
                <div class="flex gap-3">
                    <dt class="text-zinc-400 w-16 shrink-0">일시</dt>
                    <dd class="font-medium text-zinc-800 dark:text-zinc-200">{{ meetingDateTime }}</dd>
                </div>
                <div class="flex gap-3">
                    <dt class="text-zinc-400 w-16 shrink-0">장소</dt>
                    <dd class="font-medium text-zinc-800 dark:text-zinc-200">{{ meetingPlace }}</dd>
                </div>
                <div class="flex gap-3 sm:col-span-2">
                    <dt class="text-zinc-400 w-16 shrink-0">안건</dt>
                    <dd class="text-zinc-700 dark:text-zinc-300 whitespace-pre-line">{{ agenda }}</dd>
                </div>
            </dl>
        </div>

        <!-- ── 진행순서 ── -->
        <div>
            <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">진행순서</h3>
            <ol class="space-y-2">
                <li
                    v-for="p in proceedings"
                    :key="p.seq"
                    class="flex items-center gap-3 text-sm"
                >
                    <span
                        class="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400
                               text-xs font-bold flex items-center justify-center shrink-0"
                    >
                        {{ p.seq }}
                    </span>
                    <span class="text-zinc-700 dark:text-zinc-300">{{ p.item }}</span>
                </li>
            </ol>
        </div>

        <!-- ── 관련자료 ── -->
        <div class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">

            <!-- 헤더 -->
            <div class="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">관련자료</h3>
                <!-- 파일 추가 버튼 -->
                <Button
                    label="파일 추가"
                    icon="pi pi-upload"
                    size="small"
                    severity="secondary"
                    outlined
                    :loading="uploading"
                    @click="fileInput?.click()"
                />
                <!-- 숨김 파일 input (multiple 선택 지원) -->
                <input
                    ref="fileInput"
                    type="file"
                    multiple
                    class="hidden"
                    @change="handleFileChange"
                >
            </div>

            <!-- 파일 목록 -->
            <div class="p-4">

                <!-- 로딩 -->
                <div v-if="loadingFiles" class="space-y-2">
                    <Skeleton v-for="i in 2" :key="i" height="2.5rem" class="w-full" />
                </div>

                <!-- 빈 상태 -->
                <div
                    v-else-if="files.length === 0"
                    class="py-6 text-center text-sm text-zinc-400 dark:text-zinc-500"
                >
                    <i class="pi pi-inbox block text-2xl mb-2 opacity-40" />
                    첨부된 파일이 없습니다.
                </div>

                <!-- 파일 목록 -->
                <ul v-else class="space-y-1.5">
                    <li
                        v-for="file in files"
                        :key="file.flMngNo"
                        class="flex items-center gap-2 px-3 py-2.5 rounded-lg
                               bg-zinc-50 dark:bg-zinc-800/60
                               border border-zinc-100 dark:border-zinc-700
                               text-sm group"
                    >
                        <!-- 파일 아이콘 -->
                        <i class="pi pi-file text-zinc-400 shrink-0" />

                        <!-- 파일명 (클릭 시 다운로드) -->
                        <button
                            type="button"
                            class="flex-1 text-left truncate text-indigo-600 dark:text-indigo-400
                                   hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline
                                   transition-colors"
                            :class="downloading === file.flMngNo ? 'opacity-60 cursor-wait' : 'cursor-pointer'"
                            @click="handleDownload(file)"
                        >
                            {{ file.orcFlNm }}
                        </button>

                        <!-- 등록 일시 -->
                        <span class="text-xs text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:block">
                            {{ file.fstEnrDtm?.slice(0, 10) ?? '' }}
                        </span>

                        <!-- 삭제 버튼 -->
                        <Button
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            size="small"
                            :loading="deleting === file.flMngNo"
                            class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            @click="handleDelete(file)"
                        />
                    </li>
                </ul>

            </div>
        </div>

    </div>
</template>
