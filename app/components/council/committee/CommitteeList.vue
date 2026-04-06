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

interface Props {
    asctId: string;
}

const props = defineProps<Props>();

const { fetchCommittee } = useCouncil();

// ── 데이터 조회 ──────────────────────────────────────────────────────
const { data: committeeData, pending } = fetchCommittee(props.asctId);

// ── 위원유형 레이블 ─────────────────────────────────────────────────
const typeLabel = (type: CommitteeType): string => {
    const map: Record<CommitteeType, string> = {
        MAND: '당연위원',
        CALL: '소집위원',
        SECR: '간사',
    };
    return map[type];
};

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
        <!-- 로딩 -->
        <div v-if="pending" class="space-y-2">
            <Skeleton v-for="i in 3" :key="i" height="2.5rem" class="w-full" />
        </div>

        <!-- 목록 없음 -->
        <div v-else-if="allMembers.length === 0"
            class="text-sm text-zinc-400 py-4 text-center">
            배정된 평가위원이 없습니다.
        </div>

        <!-- 위원 목록 테이블 -->
        <div v-else class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        <th class="text-left px-3 py-2 font-medium">유형</th>
                        <th class="text-left px-3 py-2 font-medium">성명</th>
                        <th class="text-left px-3 py-2 font-medium">부서</th>
                        <th class="text-left px-3 py-2 font-medium">직위</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="m in allMembers"
                        :key="m.eno"
                        class="border-t border-zinc-100 dark:border-zinc-700"
                    >
                        <td class="px-3 py-2">
                            <Tag
                                :value="typeLabel(m.vlrTp)"
                                :severity="typeSeverity(m.vlrTp)"
                                class="text-xs"
                            />
                        </td>
                        <td class="px-3 py-2 font-medium">{{ m.usrNm }}</td>
                        <td class="px-3 py-2 text-zinc-500">{{ m.bbrNm }}</td>
                        <td class="px-3 py-2 text-zinc-500">{{ m.ptCNm }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
