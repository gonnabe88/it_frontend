<!--
================================================================================
[components/council/committee/CommitteeSelector.vue]
평가위원 선정 컴포넌트 (Step 2 — 탭1)
================================================================================
IT관리자(ITPAD001)가 심의유형 선택 → 당연위원 자동표출 → 소집위원/간사 추가/삭제
→ 확정 버튼으로 저장합니다.

[Props]
  asctId   : 협의회ID
  dbrTp    : 심의유형 (당연위원 자동조회에 사용)
  readonly : 읽기 전용 여부 (SCHEDULED 이후)

[Emits]
  saved    : 저장 완료 시 발생

[Design Ref: §4.3 prepare/[id].vue — 탭1 평가위원 선정]
================================================================================
-->
<script setup lang="ts">
import type { CommitteeMember, CommitteeList, CommitteeType } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    dbrTp: string | null;
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'saved'): void;
}>();

const { fetchCommittee, saveCommittee } = useCouncil();
const toast = useToast();
const { getMemberTypeLabel } = useCouncilCodes();

// ── 위원 목록 상태 ──────────────────────────────────────────────────
/** 당연위원 목록 */
const mandatoryList = ref<CommitteeMember[]>([]);
/** 소집위원 목록 */
const callList = ref<CommitteeMember[]>([]);
/** 간사 목록 */
const secretaryList = ref<CommitteeMember[]>([]);

/** 저장 중 여부 */
const saving = ref(false);

// 직원검색 다이얼로그 상태
const orgSearchVisible = ref(false);
/** 현재 추가 중인 위원유형 */
const addingType = ref<CommitteeType | null>(null);

// ── 조회 ────────────────────────────────────────────────────────────

/** 현재 확정된 평가위원 목록을 서버에서 불러옵니다. */
const {
    data: committeeData,
    pending: loadingCommittee,
    refresh: refreshCommittee,
} = fetchCommittee(props.asctId);

/**
 * committeeData 변경 시 로컬 상태에 반영합니다.
 * 서버 응답(CommitteeList)을 각 유형별 ref에 분산합니다.
 */
watch(
    committeeData,
    (val) => {
        if (!val) return;
        mandatoryList.value = val.mandatory ? [...val.mandatory] : [];
        callList.value = val.call ? [...val.call] : [];
        secretaryList.value = val.secretary ? [...val.secretary] : [];
    },
    { immediate: true }
);

// ── 조직도 검색 ─────────────────────────────────────────────────────

/**
 * 직원검색 다이얼로그를 엽니다.
 * @param type 추가할 위원유형
 */
const openOrgSearch = (type: CommitteeType) => {
    addingType.value = type;
    orgSearchVisible.value = true;
};

/**
 * 직원검색 결과에서 위원을 선택하면 해당 유형 목록에 추가합니다.
 * 중복 사번은 추가하지 않습니다.
 *
 * EmployeeSearchDialog가 emit('select', { ...OrgUser, orgCode }) 형태로 발생시킵니다.
 *
 * @param selected 선택된 직원 정보
 */
const onOrgUserSelected = (selected: { eno: string; usrNm: string; bbrNm: string; ptCNm?: string }) => {
    if (!addingType.value) return;

    /* 중복 체크: 이미 추가된 사번인지 확인 */
    const allMembers = [...mandatoryList.value, ...callList.value, ...secretaryList.value];
    if (allMembers.some((m) => m.eno === selected.eno)) {
        toast.add({ severity: 'warn', summary: '중복', detail: '이미 추가된 위원입니다.', life: 3000 });
        return;
    }

    const newMember: CommitteeMember = {
        eno: selected.eno,
        usrNm: selected.usrNm,
        bbrNm: selected.bbrNm,
        ptCNm: selected.ptCNm ?? null,
        vlrTp: addingType.value,
    };

    if (addingType.value === 'CALL') {
        callList.value = [...callList.value, newMember];
    } else if (addingType.value === 'SECR') {
        secretaryList.value = [...secretaryList.value, newMember];
    }

    orgSearchVisible.value = false;
    addingType.value = null;
};

/**
 * 소집위원 또는 간사를 목록에서 제거합니다.
 * 당연위원은 제거 불가입니다.
 *
 * @param type 위원유형
 * @param eno  제거할 사번
 */
const removeMember = (type: CommitteeType, eno: string) => {
    if (type === 'CALL') {
        callList.value = callList.value.filter((m) => m.eno !== eno);
    } else if (type === 'SECR') {
        secretaryList.value = secretaryList.value.filter((m) => m.eno !== eno);
    }
};

// ── 저장 ────────────────────────────────────────────────────────────

/**
 * 평가위원 목록을 서버에 저장합니다.
 * mandatory + call + secretary 전체를 PUT으로 전송합니다.
 */
const handleSave = async () => {
    /* 최소 1명 이상 소집위원 필수 */
    if (callList.value.length === 0) {
        toast.add({ severity: 'warn', summary: '확인', detail: '소집위원을 1명 이상 추가해 주세요.', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        const payload: CommitteeList = {
            mandatory: mandatoryList.value,
            call: callList.value,
            secretary: secretaryList.value,
        };
        await saveCommittee(props.asctId, payload);
        toast.add({ severity: 'success', summary: '저장 완료', detail: '평가위원 목록이 저장되었습니다.', life: 3000 });
        emit('saved');
        await refreshCommittee();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
};

// ── 위원유형 한글 레이블 (CCODEM VLR_TP) ────────────────────────────
const typeLabel = (type: CommitteeType): string => getMemberTypeLabel(type);
</script>

<template>
    <div class="space-y-6">

        <!-- 로딩 스켈레톤 -->
        <div v-if="loadingCommittee" class="space-y-3">
            <Skeleton height="2rem" class="w-full" />
            <Skeleton height="6rem" class="w-full" />
        </div>

        <template v-else>

            <!-- ── 당연위원 섹션 ── -->
            <div>
                <div class="flex items-center gap-2 mb-3">
                    <Tag :value="typeLabel('MAND')" severity="info" class="text-xs" />
                    <span class="text-xs text-zinc-400">(심의유형에 따라 자동 배정)</span>
                </div>

                <div v-if="mandatoryList.length === 0"
                    class="text-sm text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    당연위원이 없습니다.
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                <th class="text-left px-3 py-2 font-medium">사번</th>
                                <th class="text-left px-3 py-2 font-medium">성명</th>
                                <th class="text-left px-3 py-2 font-medium">부서</th>
                                <th class="text-left px-3 py-2 font-medium">직위</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="m in mandatoryList" :key="m.eno"
                                class="border-t border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td class="px-3 py-2 text-zinc-500">{{ m.eno }}</td>
                                <td class="px-3 py-2 font-medium">{{ m.usrNm }}</td>
                                <td class="px-3 py-2 text-zinc-500">{{ m.bbrNm }}</td>
                                <td class="px-3 py-2 text-zinc-500">{{ m.ptCNm }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ── 소집위원 섹션 ── -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <Tag :value="typeLabel('CALL')" severity="success" class="text-xs" />
                        <span class="text-xs text-zinc-400">(추가 선정)</span>
                    </div>
                    <Button
                        v-if="!readonly"
                        label="위원 추가"
                        icon="pi pi-plus"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="openOrgSearch('CALL')"
                    />
                </div>

                <div v-if="callList.length === 0"
                    class="text-sm text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    소집위원을 추가해 주세요.
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                <th class="text-left px-3 py-2 font-medium">사번</th>
                                <th class="text-left px-3 py-2 font-medium">성명</th>
                                <th class="text-left px-3 py-2 font-medium">부서</th>
                                <th class="text-left px-3 py-2 font-medium">직위</th>
                                <th v-if="!readonly" class="px-3 py-2 font-medium w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="m in callList" :key="m.eno"
                                class="border-t border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td class="px-3 py-2 text-zinc-500">{{ m.eno }}</td>
                                <td class="px-3 py-2 font-medium">{{ m.usrNm }}</td>
                                <td class="px-3 py-2 text-zinc-500">{{ m.bbrNm }}</td>
                                <td class="px-3 py-2 text-zinc-500">{{ m.ptCNm }}</td>
                                <td v-if="!readonly" class="px-3 py-2 text-center">
                                    <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                                        @click="removeMember('CALL', m.eno)" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ── 간사 섹션 ── -->
            <div>
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <Tag :value="typeLabel('SECR')" severity="warn" class="text-xs" />
                    </div>
                    <Button
                        v-if="!readonly"
                        :label="`${typeLabel('SECR')} 추가`"
                        icon="pi pi-plus"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="openOrgSearch('SECR')"
                    />
                </div>

                <div v-if="secretaryList.length === 0"
                    class="text-sm text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    간사를 추가해 주세요.
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                <th class="text-left px-3 py-2 font-medium">사번</th>
                                <th class="text-left px-3 py-2 font-medium">성명</th>
                                <th class="text-left px-3 py-2 font-medium">부서</th>
                                <th class="text-left px-3 py-2 font-medium">직위</th>
                                <th v-if="!readonly" class="px-3 py-2 font-medium w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="m in secretaryList" :key="m.eno"
                                class="border-t border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                <td class="px-3 py-2 text-zinc-500">{{ m.eno }}</td>
                                <td class="px-3 py-2 font-medium">{{ m.usrNm }}</td>
                                <td class="px-3 py-2 text-zinc-500">{{ m.bbrNm }}</td>
                                <td class="px-3 py-2 text-zinc-500">{{ m.ptCNm }}</td>
                                <td v-if="!readonly" class="px-3 py-2 text-center">
                                    <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                                        @click="removeMember('SECR', m.eno)" />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ── 저장 버튼 ── -->
            <div v-if="!readonly" class="flex justify-end pt-2">
                <Button
                    label="위원 확정"
                    icon="pi pi-check"
                    :loading="saving"
                    @click="handleSave"
                />
            </div>

        </template>

        <!-- ── 직원검색 다이얼로그 (EmployeeSearchDialog 재사용) ── -->
        <EmployeeSearchDialog
            v-model:visible="orgSearchVisible"
            :header="`${addingType ? typeLabel(addingType as CommitteeType) : ''} 추가 — 직원 검색`"
            @select="onOrgUserSelected"
        />

    </div>
</template>
