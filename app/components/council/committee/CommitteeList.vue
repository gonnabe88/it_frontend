<!--
================================================================================
[components/council/committee/CommitteeList.vue]
평가위원 목록 표출 컴포넌트
================================================================================
확정된 평가위원 목록을 위원유형(당연/소집/간사)별로 읽기 전용으로 표출합니다.
result/[id].vue 등 다른 화면에서 평가위원 구성을 참고용으로 보여줄 때 사용합니다.

[Props]
  asctId : 협의회ID

[Design Ref: §3.2 컴포넌트 구조 — CommitteeList.vue]
================================================================================
-->
<script setup lang="ts">
import type { CommitteeType } from '~/types/council';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

interface Props {
    asctId: string;
}

const props = defineProps<Props>();

const { fetchCommittee } = useCouncil();

// ── 데이터 조회 ──────────────────────────────────────────────────────
const { data: committeeData, pending } = fetchCommittee(props.asctId);

// ── CCODEM 기반 위원유형 레이블 ──────────────────────────────────────
const { getMemberTypeLabel } = useCouncilCodes();

/** 위원유형 코드 → 한글명 (CCODEM VLR_TP) */
const typeLabel = (type: CommitteeType): string => getMemberTypeLabel(type);

/** 위원유형 코드 → PrimeVue Tag severity (UI 전용) */
const typeSeverity = (type: CommitteeType) => {
    const map: Record<CommitteeType, string> = {
        MAND: 'info',
        CALL: 'success',
        SECR: 'warn',
    };
    return map[type];
};

/** 전체 위원 목록 (유형 순서대로 병합) */
const allMembers = computed(() => {
    if (!committeeData.value) return [];
    return [
        ...committeeData.value.mandatory.map((m) => ({ ...m, vlrTp: 'MAND' as CommitteeType })),
        ...committeeData.value.call.map((m) => ({ ...m, vlrTp: 'CALL' as CommitteeType })),
        ...committeeData.value.secretary.map((m) => ({ ...m, vlrTp: 'SECR' as CommitteeType })),
    ];
});
</script>

<template>
    <div>
        <StyledDataTable :value="allMembers" :loading="pending">
            <template #empty>
                <span class="text-sm text-zinc-400">배정된 평가위원이 없습니다.</span>
            </template>
            <Column field="vlrTp" header="유형" style="width: 80px">
                <template #body="{ data }">
                    <Tag :value="typeLabel(data.vlrTp)" :severity="typeSeverity(data.vlrTp)" class="text-xs" />
                </template>
            </Column>
            <Column field="usrNm" header="성명" />
            <Column field="bbrNm" header="부서" />
            <Column field="ptCNm" header="직위" />
        </StyledDataTable>
    </div>
</template>
