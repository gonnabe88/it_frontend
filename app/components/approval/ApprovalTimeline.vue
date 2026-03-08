<!--
================================================================================
[components/approval/ApprovalTimeline.vue] 결재 진행 상황 타임라인 컴포넌트
================================================================================
결재 건의 기안자 + 결재자 순서를 수평 타임라인으로 시각화하는 다이얼로그입니다.
부모 컴포넌트에서 v-model:visible과 :approvalData를 전달하여 사용합니다.

[Props]
  - visible: 다이얼로그 표시 여부 (v-model)
  - approvalData: 결재 항목 데이터 (rqsEno, rqsDt, approvers 등)

[내부 동작]
  - approvalData가 변경되면 기안자를 첫 번째 항목으로 구성하고
    결재자 목록을 합쳐 타임라인을 자동 구성합니다.
  - 상태별 색상 마커: 기안(indigo), 승인(green), 반려(red), 대기(gray), 결재중(blue)
================================================================================
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue';

/**
 * 결재 진행 상황 타임라인 항목 인터페이스
 *
 * [필드 설명]
 *  - dcdEno  : 결재자(기안자) 사원번호
 *  - dcdTp   : 결재 유형 ('기안' | '결재' 등)
 *  - dcdSts  : 결재 상태 ('승인' | '반려' | '결재중' | null)
 *  - dcdDt   : 결재 처리일자 (미처리 시 null)
 *  - dcdOpnn : 결재 의견 (미입력 시 null)
 *  - dcdSqn  : 결재 순번 (기안자 제외)
 */
interface TimelineApprover {
    dcdEno: string;
    dcdDt: string | null;
    dcdTp: string;
    dcdSts: string | null;
    dcdOpnn: string | null;
    dcdSqn?: number;
}

const props = defineProps<{
    /** 다이얼로그 표시 여부 (v-model) */
    visible: boolean;
    /** 결재 항목 데이터 (rqsEno, rqsDt, approvers 등 포함) */
    approvalData: any | null;
}>();

const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
}>();

/** v-model:visible 양방향 바인딩 */
const isVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
});

/** 타임라인에 표시할 기안자 + 결재자 통합 목록 */
const timelineApprovers = ref<TimelineApprover[]>([]);
/** 현재 타임라인에 표시 중인 신청서명 */
const currentApfNm = ref('');
/** 현재 타임라인에 표시 중인 결재 관리번호 */
const currentApfMngNo = ref('');

/**
 * approvalData 변경 감시 → 타임라인 데이터 자동 구성
 * 기안자 정보를 첫 번째 항목으로 구성하고 결재자 목록을 합쳐 표시합니다.
 */
watch(() => props.approvalData, (data) => {
    if (!data) return;

    /* 기안자 정보를 타임라인 첫 번째 항목으로 구성 */
    const drafter: TimelineApprover = {
        dcdEno: data.rqsEno,
        dcdDt: data.rqsDt,
        dcdTp: '기안',
        dcdSts: '승인', // 기안은 승인 상태로 간주
        dcdOpnn: data.rqsOpnn
    };

    /* 기안자 + 결재자 목록 합치기 */
    timelineApprovers.value = [drafter, ...(data.approvers || [])] as TimelineApprover[];
    currentApfNm.value = data.apfNm;
    currentApfMngNo.value = data.apfMngNo;
});
</script>

<template>
    <!-- 결재 진행 상황 타임라인 다이얼로그 -->
    <Dialog v-model:visible="isVisible" modal class="w-[90vw]" :style="{ maxWidth: '1000px' }" :showHeader="false">
        <!-- 커스텀 헤더: 신청서명 + 관리번호 표시 -->
        <div
            class="flex items-start justify-between p-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-t-lg">
            <div class="flex gap-4">
                <div
                    class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <i class="pi pi-sitemap text-xl text-blue-600 dark:text-blue-400"></i>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">결재 진행 상황</h3>
                    <div class="flex flex-col gap-0.5 text-sm text-gray-500 dark:text-gray-400">
                        <span class="font-medium text-gray-700 dark:text-gray-300">{{ currentApfNm }}</span>
                        <span class="text-xs font-mono">No. {{ currentApfMngNo }}</span>
                    </div>
                </div>
            </div>
            <Button icon="pi pi-times" text rounded severity="secondary" @click="isVisible = false" />
        </div>

        <!-- 타임라인 본문: 수평 배치 + 상태별 색상 마커 -->
        <div class="p-6 bg-slate-50 dark:bg-zinc-900/50 overflow-x-auto rounded-b-lg">
            <div class="relative flex items-start justify-between min-w-[600px] px-4 pt-4 pb-8">
                <!-- 수평 연결선 (배경) -->
                <div class="absolute top-9 left-10 right-10 h-0.5 bg-gray-200 dark:bg-gray-700 -z-0"></div>

                <!-- 타임라인 각 항목 (기안자 + 결재자) -->
                <div v-for="(approver, index) in timelineApprovers" :key="index"
                    class="relative z-10 flex flex-col items-center flex-1 min-w-[150px]">
                    <!-- 상태별 색상 원형 마커 -->
                    <div class="w-10 h-10 rounded-full flex items-center justify-center border-4 border-white dark:border-zinc-900 shadow-sm transition-all duration-300 mb-4"
                        :class="{
                            'bg-indigo-100 text-indigo-600 ring-4 ring-indigo-50': approver.dcdTp === '기안',
                            'bg-green-100 text-green-600 ring-4 ring-green-50': approver.dcdTp !== '기안' && (approver.dcdSts === '승인' || (!approver.dcdSts && approver.dcdDt)),
                            'bg-red-100 text-red-600 ring-4 ring-red-50': approver.dcdSts === '반려',
                            'bg-gray-100 text-gray-400': !approver.dcdSts && !approver.dcdDt && approver.dcdTp !== '기안',
                            'bg-blue-100 text-blue-600': approver.dcdSts === '결재중'
                        }">
                        <i class="pi" :class="{
                            'pi-file-edit': approver.dcdTp === '기안',
                            'pi-check': approver.dcdTp !== '기안' && (approver.dcdSts === '승인' || (!approver.dcdSts && approver.dcdDt)),
                            'pi-times': approver.dcdSts === '반려',
                            'pi-user': !approver.dcdSts && !approver.dcdDt && approver.dcdTp !== '기안',
                            'pi-spin pi-spinner': approver.dcdSts === '결재중'
                        }"></i>
                    </div>

                    <!-- 결재자 정보 카드 -->
                    <div
                        class="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-zinc-700 w-full max-w-[220px] text-center group relative">
                        <!-- 카드 위쪽 삼각형 포인터 -->
                        <div
                            class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-zinc-800 border-t border-l border-gray-100 dark:border-zinc-700 transform rotate-45 transition-colors">
                        </div>

                        <div class="flex flex-col items-center gap-1 mb-2">
                            <Badge :value="approver.dcdTp || '결재'"
                                :severity="approver.dcdTp === '기안' ? 'info' : 'secondary'" size="small" class="mb-1" />
                            <span class="font-bold text-gray-900 dark:text-gray-100 text-lg">{{ approver.dcdEno
                            }}</span>
                            <span class="text-xs text-gray-500 font-mono">{{ approver.dcdDt || '-' }}</span>
                        </div>

                        <!-- 결재 상태 및 의견 표시 -->
                        <div v-if="approver.dcdSts || approver.dcdDt || approver.dcdOpnn"
                            class="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-700">
                            <div class="mb-2">
                                <span class="font-bold text-sm px-2 py-0.5 rounded" :class="{
                                    'bg-indigo-50 text-indigo-700': approver.dcdTp === '기안',
                                    'bg-green-50 text-green-700': approver.dcdTp !== '기안' && (approver.dcdSts === '승인' || (!approver.dcdSts && approver.dcdDt)),
                                    'bg-red-50 text-red-700': approver.dcdSts === '반려'
                                }">
                                    {{ approver.dcdTp === '기안' ? '기안 상신' : (approver.dcdSts || (approver.dcdDt ?
                                        '결재완료'
                                        : '')) }}
                                </span>
                            </div>
                            <p v-if="approver.dcdOpnn"
                                class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded text-left break-keep italic">
                                "{{ approver.dcdOpnn }}"
                            </p>
                        </div>
                        <div v-else class="mt-2 text-sm text-gray-400">
                            대기 중
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Dialog>
</template>
