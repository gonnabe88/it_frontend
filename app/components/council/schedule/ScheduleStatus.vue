<!--
================================================================================
[components/council/schedule/ScheduleStatus.vue]
일정 취합 현황 컴포넌트 (Step 2 — 탭2)
================================================================================
평가위원별 가능 일정 응답 현황을 표 형태로 표출합니다.
전원 응답 완료 시 일정확정 버튼이 활성화됩니다.

[Props]
  asctId   : 협의회ID
  readonly : 읽기 전용 여부 (SCHEDULED 이후)

[Emits]
  confirmed : 일정 확정 완료 시 발생

[Design Ref: §4.3 prepare/[id].vue — 탭2 일정 취합]
================================================================================
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

interface Props {
    asctId: string;
    readonly?: boolean;
    /** false 시 일정 확정 버튼/완료 태그를 표시하지 않습니다. (현황 조회 전용) */
    showConfirm?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
    showConfirm: true,
});

const emit = defineEmits<{
    (e: 'confirmed'): void;
}>();

const { fetchScheduleStatus, confirmSchedule } = useCouncil();
const toast = useToast();

// ── 데이터 조회 ──────────────────────────────────────────────────────
const {
    data: statusData,
    pending: loadingStatus,
    refresh: refreshStatus,
} = fetchScheduleStatus(props.asctId);

/**
 * 일정 확정 가능 여부
 * 백엔드에서 심의유형별로 계산된 allRequiredResponded 필드를 사용합니다.
 * INFO_SYS: 예산팀장 + IT기획팀장 응답 완료 / 기타: 전원 응답 완료
 */
const allResponded = computed(() => statusData.value?.allRequiredResponded ?? false);

// ── 공통 슬롯 선택 ──────────────────────────────────────────────────

/** 공통 가능 일정 중 선택된 슬롯 (단일 선택) */
const selectedCommonSlot = ref<{ dsdDt: string; dsdTm: string } | null>(null);

/**
 * 공통 슬롯 뱃지 클릭 시 선택/해제 토글
 * 이미 선택된 슬롯을 다시 클릭하면 해제합니다.
 */
const toggleCommonSlot = (dsdDt: string, dsdTm: string) => {
    if (selectedCommonSlot.value?.dsdDt === dsdDt && selectedCommonSlot.value?.dsdTm === dsdTm) {
        selectedCommonSlot.value = null;
    } else {
        selectedCommonSlot.value = { dsdDt, dsdTm };
    }
};

/** 일정 확정 버튼 비활성화 여부
 * 공통 슬롯이 있으면 반드시 하나를 선택해야 활성화됩니다.
 * 공통 슬롯이 없으면 기존 allResponded 기준을 따릅니다.
 */
const confirmButtonDisabled = computed(() => {
    if (commonSlotKeys.value.size > 0) return selectedCommonSlot.value === null;
    return !allResponded.value;
});

// ── 일정 확정 다이얼로그 ─────────────────────────────────────────────
const confirmDialogVisible = ref(false);
const confirmForm = reactive({
    cnrcDt: null as Date | null,
    cnrcTm: '',
    cnrcPlc: '',
});
const confirming = ref(false);

/**
 * 일정 확정 다이얼로그를 엽니다.
 * 선택된 공통 슬롯이 있으면 날짜·시간을 자동으로 채웁니다.
 */
const openConfirmDialog = () => {
    if (selectedCommonSlot.value) {
        /* yyyy-MM-dd → Date 변환 */
        const [y, m, d] = selectedCommonSlot.value.dsdDt.split('-').map(Number);
        confirmForm.cnrcDt = new Date(y, m - 1, d);
        confirmForm.cnrcTm = selectedCommonSlot.value.dsdTm;
    } else {
        confirmForm.cnrcDt = null;
        confirmForm.cnrcTm = '';
    }
    confirmForm.cnrcPlc = '';
    confirmDialogVisible.value = true;
};

/**
 * 일정 확정을 서버에 요청합니다.
 * 날짜/시간/장소 모두 입력해야 합니다.
 */
const handleConfirm = async () => {
    if (!confirmForm.cnrcDt || !confirmForm.cnrcTm || !confirmForm.cnrcPlc) {
        toast.add({ severity: 'warn', summary: '확인', detail: '날짜, 시간, 장소를 모두 입력해 주세요.', life: 3000 });
        return;
    }

    /* Date → yyyy-MM-dd 형식 변환 */
    const dt = confirmForm.cnrcDt as Date;
    const dtStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    confirming.value = true;
    try {
        await confirmSchedule(props.asctId, dtStr, confirmForm.cnrcTm, confirmForm.cnrcPlc);
        confirmDialogVisible.value = false;
        toast.add({ severity: 'success', summary: '확정 완료', detail: '협의회 일정이 확정되었습니다.', life: 3000 });
        emit('confirmed');
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '일정 확정 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        confirming.value = false;
    }
};

// ── 위원유형 한글 변환 ──────────────────────────────────────────────
const typeLabel = (type: string): string => {
    const map: Record<string, string> = { MAND: '당연', CALL: '소집', SECR: '간사' };
    return map[type] ?? type;
};

// ── 가능 일정 슬롯 목록 반환 (psbYn='Y'인 것만) ────────────────────
const availableSlots = (slots: Array<{ dsdDt: string; dsdTm: string; psbYn: string }>) => {
    return slots.filter((s) => s.psbYn === 'Y');
};

/**
 * 응답 완료한 위원 전원이 공통으로 선택한 날짜·시간대 키 Set
 * Key 형식: "yyyy-MM-dd|HH:mm"
 * 응답자가 0명이면 빈 Set을 반환합니다.
 */
const commonSlotKeys = computed<Set<string>>(() => {
    const members = statusData.value?.memberStatuses ?? [];
    const respondedMembers = members.filter(m => m.responded);
    if (respondedMembers.length === 0) return new Set();

    // 각 슬롯의 선택 횟수를 집계
    const countMap = new Map<string, number>();
    for (const member of respondedMembers) {
        for (const slot of member.slots) {
            if (slot.psbYn !== 'Y') continue;
            const key = `${slot.dsdDt}|${slot.dsdTm}`;
            countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }
    }

    // 전원이 선택한 슬롯만 추출
    const total = respondedMembers.length;
    return new Set([...countMap.entries()]
        .filter(([, count]) => count === total)
        .map(([key]) => key));
});

/** 해당 슬롯이 공통 선택 슬롯인지 여부 */
const isCommonSlot = (dsdDt: string, dsdTm: string) =>
    commonSlotKeys.value.has(`${dsdDt}|${dsdTm}`);

/** 미응답 위원 행 배경 강조 */
const rowClass = (data: { responded: boolean }) =>
    !data.responded ? 'bg-amber-50 dark:bg-amber-900/10' : '';
</script>

<template>
    <div class="space-y-4">

        <!-- 응답 현황 요약 -->
        <div class="flex items-center gap-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div class="text-center">
                <div class="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
                    {{ statusData?.totalCount ?? 0 }}
                </div>
                <div class="text-xs text-zinc-400 mt-1">전체 위원</div>
            </div>
            <div class="text-zinc-200 dark:text-zinc-600 text-2xl">/</div>
            <div class="text-center">
                <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {{ statusData?.respondedCount ?? 0 }}
                </div>
                <div class="text-xs text-zinc-400 mt-1">응답 완료</div>
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-amber-500">
                    {{ statusData?.pendingCount ?? 0 }}
                </div>
                <div class="text-xs text-zinc-400 mt-1">미응답</div>
            </div>

            <!-- 일정 확정 버튼 / 완료 태그 (showConfirm=false 시 미표출) -->
            <div v-if="showConfirm" class="ml-auto">
                <Button
                    v-if="!readonly"
                    label="일정 확정"
                    icon="pi pi-calendar-plus"
                    :disabled="confirmButtonDisabled"
                    severity="primary"
                    @click="openConfirmDialog"
                />
                <Tag v-else value="일정 확정 완료" severity="success" />
            </div>
        </div>

        <!-- 공통 가능 일정 요약 (1개 이상일 때만 표출) -->
        <div
            v-if="commonSlotKeys.size > 0"
            class="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800 space-y-2"
        >
            <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-violet-700 dark:text-violet-300">공통 가능 일정</span>
                <span class="text-xs text-violet-500 dark:text-violet-400">— 하나를 선택 후 일정 확정 버튼을 클릭하세요</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
                <button
                    v-for="key in commonSlotKeys"
                    :key="key"
                    type="button"
                    class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border transition-all"
                    :class="selectedCommonSlot && `${selectedCommonSlot.dsdDt}|${selectedCommonSlot.dsdTm}` === key
                        ? 'bg-violet-600 text-white border-violet-600 dark:bg-violet-500 dark:border-violet-500 ring-2 ring-violet-300 dark:ring-violet-700'
                        : 'bg-violet-100 text-violet-800 border-violet-300 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700 dark:hover:bg-violet-800/50'"
                    @click="toggleCommonSlot(...(key.split('|') as [string, string]))"
                >
                    {{ key.replace('|', ' ') }}
                </button>
            </div>
        </div>

        <!-- 미응답 안내 -->
        <Message v-if="!allResponded && !loadingStatus" severity="warn" :closable="false">
            <span class="text-sm">
                필수 위원 응답 완료 후 일정 확정이 가능합니다.
                <template v-if="statusData && statusData.pendingCount > 0">
                    미응답 위원: {{ statusData.pendingCount }}명
                </template>
            </span>
        </Message>

        <!-- 위원별 응답 현황 테이블 -->
        <StyledDataTable
            v-if="statusData && statusData.memberStatuses.length > 0"
            :value="statusData.memberStatuses"
            :loading="loadingStatus"
            :row-class="rowClass"
            data-key="eno"
        >
            <template #empty>
                <span class="text-sm text-zinc-400">등록된 위원이 없습니다.</span>
            </template>
            <Column field="vlrTp" header="구분" style="width: 80px">
                <template #body="{ data }">
                    <Tag :value="typeLabel(data.vlrTp)" :severity="data.vlrTp === 'MAND' ? 'info' : data.vlrTp === 'CALL' ? 'success' : 'warn'" class="text-xs" />
                </template>
            </Column>
            <Column header="위원">
                <template #body="{ data }">
                    <div class="font-semibold text-zinc-800 dark:text-zinc-200">{{ data.usrNm ?? data.eno }}</div>
                    <div class="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                        <span v-if="data.bbrNm">{{ data.bbrNm }}</span>
                        <span v-if="data.bbrNm && data.ptCNm" class="mx-1">·</span>
                        <span v-if="data.ptCNm">{{ data.ptCNm }}</span>
                    </div>
                </template>
            </Column>
            <Column field="responded" header="응답여부" style="width: 100px; text-align: center">
                <template #body="{ data }">
                    <Tag :value="data.responded ? '완료' : '미응답'" :severity="data.responded ? 'success' : 'warn'" class="text-xs" />
                </template>
            </Column>
            <Column header="선택 일정 (가능 날짜·시간대)">
                <template #body="{ data }">
                    <template v-if="data.responded && availableSlots(data.slots).length > 0">
                        <div class="flex flex-wrap gap-1">
                            <span
                                v-for="slot in availableSlots(data.slots)"
                                :key="`${slot.dsdDt}-${slot.dsdTm}`"
                                class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                                :class="isCommonSlot(slot.dsdDt, slot.dsdTm)
                                    ? 'bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'"
                            >
                                {{ slot.dsdDt.slice(5) }} {{ slot.dsdTm }}
                            </span>
                        </div>
                    </template>
                    <span v-else-if="data.responded" class="text-xs text-zinc-400">가능 일정 없음</span>
                    <span v-else class="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                </template>
            </Column>
        </StyledDataTable>

        <div v-else-if="!loadingStatus" class="text-sm text-zinc-400 py-6 text-center">
            등록된 위원이 없습니다.
        </div>

        <!-- ── 일정 확정 다이얼로그 ── -->
        <Dialog
            v-model:visible="confirmDialogVisible"
            header="협의회 일정 확정"
            modal
            class="w-full max-w-md"
        >
            <div class="space-y-4 py-2">
                <!-- 공통 슬롯 선택 시 안내 -->
                <div
                    v-if="selectedCommonSlot"
                    class="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-700 text-sm"
                >
                    <i class="pi pi-calendar text-violet-500 text-xs" />
                    <span class="text-violet-700 dark:text-violet-300 font-medium">
                        {{ selectedCommonSlot.dsdDt }} {{ selectedCommonSlot.dsdTm }}
                    </span>
                    <span class="text-violet-500 dark:text-violet-400 text-xs">(공통 선택 일정)</span>
                </div>

                <!-- 회의일자 (공통 슬롯 미선택 시에만 직접 입력) -->
                <div v-if="!selectedCommonSlot" class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        회의일자 <span class="text-red-500">*</span>
                    </label>
                    <DatePicker
                        v-model="confirmForm.cnrcDt"
                        date-format="yy-mm-dd"
                        placeholder="날짜 선택"
                        class="w-full"
                        :min-date="new Date()"
                    />
                </div>

                <!-- 회의시간 (공통 슬롯 미선택 시에만 직접 입력) -->
                <div v-if="!selectedCommonSlot" class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        회의시간 <span class="text-red-500">*</span>
                    </label>
                    <Select
                        v-model="confirmForm.cnrcTm"
                        :options="['10:00', '14:00', '15:00', '16:00']"
                        placeholder="시간 선택"
                        class="w-full"
                    />
                </div>

                <!-- 회의장소 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        회의장소 <span class="text-red-500">*</span>
                    </label>
                    <InputText
                        v-model="confirmForm.cnrcPlc"
                        placeholder="예) 본관 3층 대회의실"
                        class="w-full"
                    />
                </div>
            </div>

            <template #footer>
                <AppDialogFooter>
                    <Button label="취소" severity="secondary" outlined @click="confirmDialogVisible = false" />
                    <Button label="확정" icon="pi pi-check" :loading="confirming" @click="handleConfirm" />
                </AppDialogFooter>
            </template>
        </Dialog>

    </div>
</template>
