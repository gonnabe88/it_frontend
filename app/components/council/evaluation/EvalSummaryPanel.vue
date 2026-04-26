<!--
================================================================================
[components/council/evaluation/EvalSummaryPanel.vue]
평가의견 전체 현황 패널 (IT관리자용)
================================================================================
위원별 평가의견 + 항목별 평균점수를 표출합니다.

[Props]
  asctId : 협의회ID

[Design Ref: §4.4 result/[id].vue — IT관리자 평가의견 현황]
================================================================================
-->
<script setup lang="ts">
import StyledDataTable from '~/components/common/StyledDataTable.vue';

interface Props {
    asctId: string;
}

const props = defineProps<Props>();

const { fetchEvaluationSummary } = useCouncil();

const { data: summary, pending } = fetchEvaluationSummary(props.asctId);

/** 점수 → 심각도 변환 */
const scoreSeverity = (score: number | null) => {
    if (score === null) return 'secondary';
    if (score >= 4) return 'success';
    if (score >= 3) return 'info';
    return 'warn';
};
</script>

<template>
    <div class="space-y-4">

        <div v-if="pending" class="space-y-2">
            <Skeleton v-for="i in 3" :key="i" height="2.5rem" class="w-full" />
        </div>

        <template v-else-if="summary">

            <!-- 항목별 평균점수 -->
            <div v-if="summary.avgScores.length > 0">
                <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">항목별 평균점수</h4>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div
                        v-for="avg in summary.avgScores"
                        :key="avg.ckgItmC"
                        class="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
                    >
                        <span class="text-zinc-600 dark:text-zinc-300 text-xs">{{ avg.ckgItmNm }}</span>
                        <Tag
                            :value="`${avg.avgScore.toFixed(1)}`"
                            :severity="scoreSeverity(avg.avgScore)"
                            class="text-xs"
                        />
                    </div>
                </div>
            </div>

            <!-- 위원별 의견 -->
            <div v-if="summary.evaluations.length > 0">
                <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">위원별 평가의견</h4>
                <StyledDataTable :value="summary.evaluations">
                    <Column header="위원">
                        <template #body="{ data }">{{ data.usrNm ?? data.eno }}</template>
                    </Column>
                    <Column field="ckgItmNm" header="항목" />
                    <Column field="ckgRcrd" header="점수" style="width: 72px; text-align: center">
                        <template #body="{ data }">
                            <Tag v-if="data.ckgRcrd" :value="`${data.ckgRcrd}`" :severity="scoreSeverity(data.ckgRcrd)" class="text-xs" />
                            <span v-else class="text-zinc-300">—</span>
                        </template>
                    </Column>
                    <Column header="의견">
                        <template #body="{ data }">{{ data.ckgOpnn || '—' }}</template>
                    </Column>
                </StyledDataTable>
            </div>

            <div v-else class="text-sm text-zinc-400 text-center py-4">
                아직 제출된 평가의견이 없습니다.
            </div>

        </template>
    </div>
</template>
