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

interface Props {
    asctId: string;
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
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

/** 전원 응답 완료 여부 */
const allResponded = computed(() => {
    if (!statusData.value) return false;
    return statusData.value.respondedCount >= statusData.value.totalCount &&
        statusData.value.totalCount > 0;
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
 * 전원 응답 완료 상태에서만 호출됩니다.
 */
const openConfirmDialog = () => {
    confirmForm.cnrcDt = null;
    confirmForm.cnrcTm = '';
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

// ── 가능 일정 슬롯을 날짜+시간 형태로 병합 표출 ────────────────────
const formatSlots = (slots: Array<{ dsdDt: string; dsdTm: string; psbYn: string }>) => {
    /* psbYn='Y'인 슬롯만 필터링하여 "MM/dd HH:mm" 형태로 조합 */
    return slots
        .filter((s) => s.psbYn === 'Y')
        .map((s) => `${s.dsdDt.slice(5)} ${s.dsdTm}`)
        .join(', ') || '—';
};
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

            <!-- 일정 확정 버튼 (전원 응답 완료 시 활성화) -->
            <div class="ml-auto">
                <Button
                    v-if="!readonly"
                    label="일정 확정"
                    icon="pi pi-calendar-plus"
                    :disabled="!allResponded"
                    severity="primary"
                    @click="openConfirmDialog"
                />
                <Tag v-else value="일정 확정 완료" severity="success" />
            </div>
        </div>

        <!-- 미응답 안내 -->
        <Message v-if="!allResponded && !loadingStatus" severity="warn" :closable="false">
            <span class="text-sm">전원 응답 완료 후 일정 확정이 가능합니다. 미응답 위원: {{ statusData?.pendingCount }}명</span>
        </Message>

        <!-- 위원별 응답 현황 테이블 -->
        <div v-if="loadingStatus" class="space-y-2">
            <Skeleton v-for="i in 4" :key="i" height="2.5rem" class="w-full" />
        </div>

        <div v-else-if="statusData && statusData.memberStatuses.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                        <th class="text-left px-3 py-2 font-medium">위원유형</th>
                        <th class="text-left px-3 py-2 font-medium">성명</th>
                        <th class="text-left px-3 py-2 font-medium">응답상태</th>
                        <th class="text-left px-3 py-2 font-medium">가능 일정</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="member in statusData.memberStatuses"
                        :key="member.eno"
                        class="border-t border-zinc-100 dark:border-zinc-700"
                        :class="!member.responded ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''"
                    >
                        <td class="px-3 py-2">
                            <Tag
                                :value="typeLabel(member.vlrTp)"
                                :severity="member.vlrTp === 'MAND' ? 'info' : member.vlrTp === 'CALL' ? 'success' : 'warn'"
                                class="text-xs"
                            />
                        </td>
                        <td class="px-3 py-2 font-medium">{{ member.usrNm ?? member.eno }}</td>
                        <td class="px-3 py-2">
                            <Tag
                                :value="member.responded ? '응답 완료' : '미응답'"
                                :severity="member.responded ? 'success' : 'warn'"
                                class="text-xs"
                            />
                        </td>
                        <td class="px-3 py-2 text-zinc-500">
                            {{ member.responded ? formatSlots(member.slots) : '—' }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-else class="text-sm text-zinc-400 py-6 text-center">
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
                <!-- 회의일자 -->
                <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        회의일자 <span class="text-red-500">*</span>
                    </label>
                    <DatePicker
                        v-model="confirmForm.cnrcDt"
                        dateFormat="yy-mm-dd"
                        placeholder="날짜 선택"
                        class="w-full"
                        :minDate="new Date()"
                    />
                </div>

                <!-- 회의시간 -->
                <div class="flex flex-col gap-1">
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
                <div class="flex justify-end gap-2">
                    <Button label="취소" severity="secondary" text @click="confirmDialogVisible = false" />
                    <Button label="확정" icon="pi pi-check" :loading="confirming" @click="handleConfirm" />
                </div>
            </template>
        </Dialog>

    </div>
</template>
