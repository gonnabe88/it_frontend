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
import type { CommitteeMember, CommitteeType } from '~/types/council';
import { useToast } from 'primevue/usetoast';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

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
const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();
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

/** 기본 위원 배정 중 여부 */
const loadingDefaults = ref(false);

/** 위원 조회 오류 여부 (API 실패 시 오류 안내 표출) */
const fetchError = ref(false);

// 직원검색 다이얼로그 상태
const orgSearchVisible = ref(false);
/** 현재 추가 중인 위원유형 */
const addingType = ref<CommitteeType | null>(null);

// ── 조회 ────────────────────────────────────────────────────────────

/** 현재 확정된 평가위원 목록을 서버에서 불러옵니다. */
const {
    data: committeeData,
    pending: loadingCommittee,
    error: committeeError,
    refresh: refreshCommittee,
} = fetchCommittee(props.asctId);

/**
 * committeeData 또는 오류 상태 변경 시 로컬 상태에 반영합니다.
 * 서버 응답(CommitteeList)을 각 유형별 ref에 분산합니다.
 */
watch(
    [committeeData, committeeError],
    ([val, err]) => {
        if (err) {
            // 404(미등록)는 빈 상태로 처리 — 그 외 오류만 fetchError 표시
            const status = (err as { statusCode?: number; status?: number })?.statusCode
                ?? (err as { statusCode?: number; status?: number })?.status;
            if (status === 404) {
                fetchError.value = false;
            } else {
                fetchError.value = true;
            }
            return;
        }
        fetchError.value = false;
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
        cnfmYn: 'N',
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
        // 백엔드 CommitteeRequest 형식으로 변환: { dbrTp, members: [{eno, vlrTp}] }
        const members = [
            ...mandatoryList.value.map(m => ({ eno: m.eno, vlrTp: 'MAND' })),
            ...callList.value.map(m => ({ eno: m.eno, vlrTp: 'CALL' })),
            ...secretaryList.value.map(m => ({ eno: m.eno, vlrTp: 'SECR' })),
        ];
        await saveCommittee(props.asctId, { dbrTp: props.dbrTp ?? '', members });
        toast.add({ severity: 'success', summary: '저장 완료', detail: '평가위원 목록이 저장되었습니다.', life: 3000 });
        emit('saved');
        await refreshCommittee();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
};

// ── 기본 위원 자동 배정 ───────────────────────────────────────────────

/**
 * 심의유형에 따른 당연위원 후보를 서버에서 불러와 mandatoryList에 자동 배정합니다.
 * 저장된 위원이 없을 때(빈 상태) IT관리자가 클릭하여 시작점으로 사용합니다.
 *
 * ※ useFetch(useApiFetch)는 setup 컨텍스트에서만 호출 가능하므로
 *   이벤트 핸들러 내부에서는 $apiFetch를 사용합니다.
 */
const loadDefaultCommittee = async () => {
    if (!props.dbrTp) {
        toast.add({ severity: 'warn', summary: '심의유형 없음', detail: '협의회 심의유형 정보가 없습니다.', life: 3000 });
        return;
    }
    loadingDefaults.value = true;
    try {
        const url = `${config.public.apiBase}/api/council/${props.asctId}/committee/default`;
        const result = await $apiFetch<CommitteeMember[]>(url, {
            query: { dbrTp: props.dbrTp },
            credentials: 'include',
        });
        // vlrTp 기준으로 당연위원/간사 분리
        mandatoryList.value = result ? result.filter(m => m.vlrTp === 'MAND') : [];
        secretaryList.value = result ? result.filter(m => m.vlrTp === 'SECR') : [];
        if (!result || result.length === 0) {
            toast.add({ severity: 'info', summary: '안내', detail: '심의유형에 해당하는 당연위원이 없습니다.', life: 3000 });
        }
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '기본 위원 조회 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        loadingDefaults.value = false;
    }
};

/** 위원 목록이 모두 비어 있는지 여부 */
const isEmpty = computed(
    () => mandatoryList.value.length === 0
        && callList.value.length === 0
        && secretaryList.value.length === 0
);

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

        <!-- 조회 오류 -->
        <div v-else-if="fetchError" class="text-sm text-red-500 dark:text-red-400 py-6 text-center">
            위원 정보를 불러오는 중 오류가 발생했습니다.
            <Button label="다시 시도" icon="pi pi-refresh" size="small" severity="secondary" class="ml-2" @click="() => refreshCommittee()" />
        </div>

        <template v-else>

            <!--
                빈 상태 안내: 아직 위원이 한 명도 없을 때 기본 위원 자동 배정 버튼 표출
                '기본 위원 배정' 클릭 → 심의유형(dbrTp)별 당연위원 후보를 서버에서 불러옵니다.
            -->
            <div
v-if="isEmpty && !readonly"
                class="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl mb-4">
                <i class="pi pi-users text-3xl text-zinc-300 dark:text-zinc-600" />
                <p class="text-sm text-zinc-500 dark:text-zinc-400">등록된 평가위원이 없습니다.</p>
                <Button
                    label="기본 위원 자동 배정"
                    icon="pi pi-magic-wand"
                    severity="secondary"
                    outlined
                    :loading="loadingDefaults"
                    @click="loadDefaultCommittee"
                />
                <p class="text-xs text-zinc-400 dark:text-zinc-500">심의유형({{ dbrTp }})에 따른 당연위원을 자동으로 불러옵니다.</p>
            </div>

            <!-- ── 당연위원 섹션 ── -->
            <div>
                <div class="flex items-center gap-2 mb-3">
                    <Tag :value="typeLabel('MAND')" severity="info" class="text-xs" />
                    <span class="text-xs text-zinc-400">(심의유형에 따라 자동 배정)</span>
                </div>

                <div
v-if="mandatoryList.length === 0"
                    class="text-sm text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    당연위원이 없습니다.
                </div>

                <StyledDataTable v-else :value="mandatoryList" data-key="eno">
                    <Column field="eno" header="사번" />
                    <Column field="usrNm" header="성명" />
                    <Column field="bbrNm" header="부서" />
                    <Column field="ptCNm" header="직위" />
                </StyledDataTable>
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

                <div
v-if="callList.length === 0"
                    class="text-sm text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    소집위원을 추가해 주세요.
                </div>

                <StyledDataTable v-else :value="callList" data-key="eno">
                    <Column field="eno" header="사번" />
                    <Column field="usrNm" header="성명" />
                    <Column field="bbrNm" header="부서" />
                    <Column field="ptCNm" header="직위" />
                    <Column v-if="!readonly" style="width: 56px">
                        <template #body="{ data }">
                            <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeMember('CALL', data.eno)" />
                        </template>
                    </Column>
                </StyledDataTable>
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

                <div
v-if="secretaryList.length === 0"
                    class="text-sm text-zinc-400 py-3 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                    간사를 추가해 주세요.
                </div>

                <StyledDataTable v-else :value="secretaryList" data-key="eno">
                    <Column field="eno" header="사번" />
                    <Column field="usrNm" header="성명" />
                    <Column field="bbrNm" header="부서" />
                    <Column field="ptCNm" header="직위" />
                    <Column v-if="!readonly" style="width: 56px">
                        <template #body="{ data }">
                            <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="removeMember('SECR', data.eno)" />
                        </template>
                    </Column>
                </StyledDataTable>
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

        <!-- ── 직원검색 다이얼로그 ── -->
        <CommonEmployeeSearchDialog
            v-model:visible="orgSearchVisible"
            :header="`${addingType ? typeLabel(addingType as CommitteeType) : ''} 추가 — 직원 검색`"
            @select="onOrgUserSelected"
        />

    </div>
</template>
