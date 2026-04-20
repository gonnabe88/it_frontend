<!--
================================================================================
[components/council/result/ResultForm.vue]
결과서 작성 컴포넌트 (Step 3 — IT관리자)
================================================================================
IT관리자가 협의회 결과서를 작성합니다.

1페이지: 일정공지 내용 요약 (회의 개요, 안건)
2페이지: 항목별 평균점수(자동) + 종합의견 + 타당성검토의견

[Props]
  asctId     : 협의회ID
  councilDetail : 협의회 상세 (일시·장소)
  feasibility   : 타당성검토표 (사업명·내용)
  readonly   : 읽기 전용 여부

[Emits]
  saved : 저장 완료 시 발생

[Design Ref: §4.4 result/[id].vue — IT관리자 결과서 작성]
================================================================================
-->
<script setup lang="ts">
import type { CouncilDetail, FeasibilityData, ResultData, CheckItemAvgScore } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    councilDetail: CouncilDetail | null;
    feasibility: FeasibilityData | null;
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'saved'): void;
}>();

const { fetchResult, saveResult, fetchEvaluationSummary } = useCouncil();
const toast = useToast();

// ── 결과서 + 평가의견 요약 조회 ──────────────────────────────────────
const {
    data: resultData,
    pending: loadingResult,
    refresh: refreshResult,
} = fetchResult(props.asctId);

const {
    data: evalSummary,
    pending: loadingEval,
} = fetchEvaluationSummary(props.asctId);

// ── 폼 상태 ─────────────────────────────────────────────────────────
const form = reactive({
    synOpnn: '',
    ckgOpnn: '',
    flMngNo: null as string | null,
});

/** 결과서 데이터 로드 시 폼에 반영 */
watch(resultData, (val) => {
    if (!val) return;
    form.synOpnn = val.synOpnn ?? '';
    form.ckgOpnn = val.ckgOpnn ?? '';
    form.flMngNo = val.flMngNo ?? null;
}, { immediate: true });

const saving = ref(false);
/** 첫 저장 후 true (PUT 사용) */
const isUpdate = computed(() => !!resultData.value?.synOpnn || !!resultData.value?.ckgOpnn);

/**
 * 결과서를 저장합니다.
 */
const handleSave = async () => {
    if (!form.synOpnn.trim()) {
        toast.add({ severity: 'warn', summary: '확인', detail: '종합의견을 입력해 주세요.', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        await saveResult(props.asctId, {
            synOpnn: form.synOpnn,
            ckgOpnn: form.ckgOpnn,
            flMngNo: form.flMngNo,
        }, isUpdate.value);
        toast.add({ severity: 'success', summary: '저장 완료', detail: '결과서가 저장되었습니다.', life: 3000 });
        await refreshResult();
        emit('saved');
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
};

// ── 항목별 평균점수 표출 ─────────────────────────────────────────────
const avgScores = computed<CheckItemAvgScore[]>(() => evalSummary.value?.avgScores ?? []);

/** 날짜 형식 변환 */
const formatDate = (dt: string | null): string => {
    if (!dt) return '—';
    const [y, m, d] = dt.split('-');
    return `${y}년 ${m}월 ${d}일`;
};
</script>

<template>
    <div class="space-y-6">

        <!-- 로딩 -->
        <div v-if="loadingResult || loadingEval" class="space-y-3">
            <Skeleton height="8rem" class="w-full" />
        </div>

        <template v-else>

            <!-- ── 1페이지: 회의 개요 (일정공지 내용) ── -->
            <div class="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 p-5">
                <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">1. 회의 개요</h3>
                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div class="flex gap-3">
                        <dt class="text-zinc-400 w-16 shrink-0">사업명</dt>
                        <dd class="font-medium text-zinc-800 dark:text-zinc-200">{{ feasibility?.prjNm ?? '—' }}</dd>
                    </div>
                    <div class="flex gap-3">
                        <dt class="text-zinc-400 w-16 shrink-0">일시</dt>
                        <dd class="font-medium text-zinc-800 dark:text-zinc-200">
                            {{ formatDate(councilDetail?.cnrcDt ?? null) }}
                            {{ councilDetail?.cnrcTm ? ' ' + councilDetail.cnrcTm : '' }}
                        </dd>
                    </div>
                    <div class="flex gap-3">
                        <dt class="text-zinc-400 w-16 shrink-0">장소</dt>
                        <dd class="font-medium text-zinc-800 dark:text-zinc-200">{{ councilDetail?.cnrcPlc ?? '—' }}</dd>
                    </div>
                </dl>
            </div>

            <!-- ── 2페이지: 평균점수 + 종합의견 ── -->
            <div class="space-y-4">
                <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-300">2. 타당성 검토 결과</h3>

                <!-- 항목별 평균점수 -->
                <div v-if="avgScores.length > 0" class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                <th class="text-left px-3 py-2 font-medium">평가 항목</th>
                                <th class="text-center px-3 py-2 font-medium w-28">평균점수</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="score in avgScores"
                                :key="score.ckgItmC"
                                class="border-t border-zinc-100 dark:border-zinc-700"
                            >
                                <td class="px-3 py-2">{{ score.ckgItmNm }}</td>
                                <td class="px-3 py-2 text-center">
                                    <Tag
                                        :value="`${score.avgScore.toFixed(1)}점`"
                                        :severity="score.avgScore >= 3 ? 'success' : 'warn'"
                                        class="text-xs"
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <Message v-else severity="info" :closable="false">
                    <span class="text-sm">평가위원 의견이 아직 없습니다.</span>
                </Message>

                <!-- 종합의견 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        종합의견 <span class="text-red-500">*</span>
                    </label>
                    <Textarea
                        v-if="!readonly"
                        v-model="form.synOpnn"
                        rows="5"
                        placeholder="협의회 종합의견을 입력하세요..."
                        class="w-full text-sm"
                        auto-resize
                    />
                    <p v-else class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        {{ form.synOpnn || '—' }}
                    </p>
                </div>

                <!-- 타당성검토의견 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">타당성검토의견</label>
                    <Textarea
                        v-if="!readonly"
                        v-model="form.ckgOpnn"
                        rows="4"
                        placeholder="타당성검토의견을 입력하세요..."
                        class="w-full text-sm"
                        auto-resize
                    />
                    <p v-else class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                        {{ form.ckgOpnn || '—' }}
                    </p>
                </div>
            </div>

            <!-- 저장 버튼 -->
            <div v-if="!readonly" class="flex justify-end">
                <Button
                    label="결과서 저장"
                    icon="pi pi-save"
                    :loading="saving"
                    @click="handleSave"
                />
            </div>

        </template>
    </div>
</template>
