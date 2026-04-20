<!--
================================================================================
[components/council/notice/CouncilNotice.vue]
일정공지 컴포넌트 (Step 2 — 탭3)
================================================================================
협의회 SCHEDULED 이후 안건/회의개요/진행순서/관련자료를 표출합니다.
CouncilDetail에서 회의 일시·장소 정보를 받아 표출합니다.

[Props]
  asctId     : 협의회ID
  councilDetail : 협의회 상세 정보 (일시·장소 포함)
  feasibility   : 타당성검토표 데이터 (사업명·사업내용 표출용)

[Design Ref: §4.3 prepare/[id].vue — 탭3 일정공지]
================================================================================
-->
<script setup lang="ts">
import type { CouncilDetail, FeasibilityData } from '~/types/council';

interface Props {
    asctId: string;
    councilDetail: CouncilDetail | null;
    feasibility: FeasibilityData | null;
}

const props = defineProps<Props>();

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

// ── 진행순서 (고정 항목) ─────────────────────────────────────────────
const proceedings = [
    { seq: 1, item: '개회 선언' },
    { seq: 2, item: '안건 소개 (추진부서 담당자)' },
    { seq: 3, item: '타당성 자체점검 결과 보고' },
    { seq: 4, item: '질의응답 및 토의' },
    { seq: 5, item: '종합의견 취합' },
    { seq: 6, item: '폐회' },
];
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
                                 text-xs font-bold flex items-center justify-center shrink-0">
                        {{ p.seq }}
                    </span>
                    <span class="text-zinc-700 dark:text-zinc-300">{{ p.item }}</span>
                </li>
            </ol>
        </div>

        <!-- ── 관련자료 안내 ── -->
        <div class="p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">관련자료</h3>
            <p class="text-sm text-zinc-500">
                사전 배포된 타당성검토표 및 첨부파일을 참조하세요.
                타당성검토표는 상단 탭에서 확인하거나 첨부파일을 통해 열람할 수 있습니다.
            </p>
        </div>

    </div>
</template>
