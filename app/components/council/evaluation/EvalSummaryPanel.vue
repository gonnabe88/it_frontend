<!--
================================================================================
[components/council/evaluation/EvalSummaryPanel.vue]
평가의견 전체 현황 패널 (IT관리자용)
================================================================================
위원별 제출 현황 + 항목별 평균점수 + 위원별 평가의견 상세를 표출합니다.
미제출 위원을 한눈에 파악할 수 있도록 제출 현황을 상단에 표시합니다.

[Props]
  asctId        : 협의회ID
  committeeData : 위원 목록 (부모 페이지에서 주입 — 중복 fetch 방지)

[Design Ref: §4.4 result/[id].vue — IT관리자 평가의견 현황]
================================================================================
-->
<script setup lang="ts">
import StyledDataTable from '~/components/common/StyledDataTable.vue';

interface Props {
    asctId: string;
    /** 부모 페이지가 이미 조회한 위원 목록을 주입받아 중복 useFetch 키 충돌을 방지합니다. */
    committeeData: CommitteeList | null;
}

const props = defineProps<Props>();

const { fetchEvaluationSummary } = useCouncil();

const { data: summary, pending } = fetchEvaluationSummary(props.asctId);

/**
 * 평가 대상 위원 목록 (간사 제외: MAND + CALL)
 * 간사(SECR)는 평가 의무가 없으므로 현황에서 제외합니다.
 * 부모에서 주입받은 committeeData prop을 사용합니다.
 *
 * committeeData가 없거나 MAND/CALL 위원이 비어있는 경우(위원 데이터 불일치):
 * 평가의견 제출자 목록을 기반으로 폴백 표시하여 데이터 손실 없이 현황을 확인할 수 있도록 합니다.
 */
const evaluators = computed<CommitteeMember[]>(() => {
    const fromCommittee = [
        ...(props.committeeData?.mandatory ?? []),
        ...(props.committeeData?.call ?? []),
    ];
    if (fromCommittee.length > 0) return fromCommittee;

    // 폴백: 위원 선정 데이터가 없을 때 평가의견 제출자 기반으로 목록 구성
    if (!summary.value) return [];
    const seen = new Set<string>();
    const fallback: CommitteeMember[] = [];
    for (const item of summary.value.evaluations) {
        if (!seen.has(item.eno)) {
            seen.add(item.eno);
            fallback.push({
                eno: item.eno,
                usrNm: item.usrNm ?? item.eno,
                bbrNm: null,
                ptCNm: null,
                vlrTp: 'MAND',
                cnfmYn: 'N',
            });
        }
    }
    return fallback;
});

/**
 * 위원별 제출 완료 여부
 * 6개 항목 모두 제출한 경우에만 완료로 판단합니다.
 */
const submittedEnoSet = computed(() => {
    if (!summary.value) return new Set<string>();
    // 사번별 제출 항목 수를 집계
    const countMap = new Map<string, number>();
    for (const item of summary.value.evaluations) {
        countMap.set(item.eno, (countMap.get(item.eno) ?? 0) + 1);
    }
    // 6개 항목 모두 제출한 사번만 완료 처리
    const set = new Set<string>();
    countMap.forEach((count, eno) => {
        if (count >= 6) set.add(eno);
    });
    return set;
});

/** 제출 완료 인원 수 */
const submittedCount = computed(() =>
    evaluators.value.filter(m => submittedEnoSet.value.has(m.eno)).length
);

/** 전원 완료 여부 */
const allSubmitted = computed(() =>
    evaluators.value.length > 0 && submittedCount.value === evaluators.value.length
);

/**
 * 위원 선정 데이터 불일치 여부
 * committeeData에 MAND/CALL 위원이 없지만 평가의견은 존재하는 경우 — 데이터 정합성 경고 표시
 */
const committeeDataMissing = computed(() => {
    const fromCommittee = [
        ...(props.committeeData?.mandatory ?? []),
        ...(props.committeeData?.call ?? []),
    ];
    return fromCommittee.length === 0 && (summary.value?.evaluations.length ?? 0) > 0;
});

/** 점수 → 심각도 변환 */
const scoreSeverity = (score: number | null) => {
    if (score === null) return 'secondary';
    if (score >= 4) return 'success';
    if (score >= 3) return 'info';
    return 'warn';
};
</script>

<template>
    <div class="space-y-5">

        <div v-if="pending" class="space-y-2">
            <Skeleton v-for="i in 3" :key="i" height="2.5rem" class="w-full" />
        </div>

        <template v-else>

            <!-- ── 위원 선정 데이터 불일치 경고 ── -->
            <Message v-if="committeeDataMissing" severity="warn" :closable="false">
                <span class="text-sm">
                    위원 선정 데이터와 평가의견 데이터가 일치하지 않습니다.
                    평가의견 제출자 기준으로 현황을 표시합니다. prepare 페이지에서 위원을 재선정해 주세요.
                </span>
            </Message>

            <!-- ── 위원별 제출 현황 ── -->
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                        위원별 제출 현황
                    </h4>
                    <Tag
                        :value="allSubmitted ? '전원 완료' : `${submittedCount} / ${evaluators.length}명 완료`"
                        :severity="allSubmitted ? 'success' : 'warn'"
                        class="text-xs"
                    />
                </div>

                <div v-if="evaluators.length === 0" class="text-sm text-zinc-400 py-3">
                    평가위원이 선정되지 않았습니다.
                </div>

                <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div
                        v-for="member in evaluators"
                        :key="member.eno"
                        class="flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm"
                        :class="submittedEnoSet.has(member.eno)
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'"
                    >
                        <div class="flex items-center gap-2 min-w-0">
                            <i
                                class="pi shrink-0 text-sm"
                                :class="submittedEnoSet.has(member.eno)
                                    ? 'pi-check-circle text-emerald-500'
                                    : 'pi-clock text-amber-500'"
                            />
                            <div class="min-w-0">
                                <span class="font-medium text-zinc-800 dark:text-zinc-200 block truncate">
                                    {{ member.usrNm ?? member.eno }}
                                </span>
                                <span class="text-xs text-zinc-400">
                                    {{ member.bbrNm }} · {{ member.vlrTp === 'MAND' ? '당연위원' : '소집위원' }}
                                </span>
                            </div>
                        </div>
                        <Tag
                            :value="submittedEnoSet.has(member.eno) ? '완료' : '미제출'"
                            :severity="submittedEnoSet.has(member.eno) ? 'success' : 'warn'"
                            class="text-xs shrink-0 ml-2"
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

                <!-- ── 항목별 평균점수 ── -->
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

                <!-- ── 위원별 평가의견 상세 ── -->
                <div v-if="summary.evaluations.length > 0">
                    <h4 class="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">위원별 평가의견 상세</h4>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm border-collapse">
                            <thead>
                                <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                    <th class="text-left px-3 py-2 font-medium">위원</th>
                                    <th class="text-left px-3 py-2 font-medium">항목</th>
                                    <th class="text-center px-3 py-2 font-medium w-16">점수</th>
                                    <th class="text-left px-3 py-2 font-medium">의견</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="item in summary.evaluations"
                                    :key="`${item.eno}-${item.ckgItmC}`"
                                    class="border-t border-zinc-100 dark:border-zinc-700"
                                >
                                    <td class="px-3 py-2 font-medium text-xs">{{ item.usrNm ?? item.eno }}</td>
                                    <td class="px-3 py-2 text-xs text-zinc-500">{{ item.ckgItmNm }}</td>
                                    <td class="px-3 py-2 text-center">
                                        <Tag
                                            v-if="item.ckgRcrd"
                                            :value="`${item.ckgRcrd}`"
                                            :severity="scoreSeverity(item.ckgRcrd)"
                                            class="text-xs"
                                        />
                                        <span v-else class="text-zinc-300">—</span>
                                    </td>
                                    <td class="px-3 py-2 text-xs text-zinc-500">
                                        {{ item.ckgOpnn || '—' }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div v-else class="text-sm text-zinc-400 text-center py-4">
                    아직 제출된 평가의견이 없습니다.
                </div>

            </template>

        </template>
    </div>
</template>
