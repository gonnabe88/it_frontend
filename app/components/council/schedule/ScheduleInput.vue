<!--
================================================================================
[components/council/schedule/ScheduleInput.vue]
평가위원 일정 입력 컴포넌트 (Step 2 — 평가위원용)
================================================================================
평가위원이 협의회 가능 일정을 날짜×시간대 체크박스 형태로 입력합니다.
IT관리자가 지정한 후보 날짜 목록에서 가능 시간대를 선택합니다.

[Props]
  asctId   : 협의회ID
  readonly : true 시 일정 수정 불가 (일정 확정 후 잠금 용도)

[Emits]
  submitted : 일정 입력 완료 시 발생

[Design Ref: §3.2 컴포넌트 구조 — ScheduleInput.vue]
================================================================================
-->
<script setup lang="ts">
import type { ScheduleSlot } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    /** true 시 수정 불가 — 일정 확정(SCHEDULED) 이후 잠금 */
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'submitted'): void;
}>();

const { fetchMySchedule, submitSchedule } = useCouncil();
const toast = useToast();

/** 가능 시간대 목록 (고정) */
const timeSlots = ['10:00', '14:00', '15:00', '16:00'];

/**
 * 후보 날짜 목록 (현재 날짜 기준 2주 이내 평일)
 */
const candidateDates = computed(() => {
    const dates: string[] = [];
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);

    const cursor = new Date(today);
    cursor.setDate(today.getDate() + 1); /* 내일부터 시작 */

    while (cursor <= maxDate) {
        const day = cursor.getDay();
        if (day >= 1 && day <= 5) {
            const y = cursor.getFullYear();
            const m = String(cursor.getMonth() + 1).padStart(2, '0');
            const d = String(cursor.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
});

// ── 기제출 일정 조회 ────────────────────────────────────────────────
const { data: myScheduleData, pending: loadingMySchedule } = fetchMySchedule(props.asctId);

/**
 * 선택된 슬롯 집합 (Key: "yyyy-MM-dd|HH:mm")
 * 기제출 데이터가 로드되면 psbYn=Y인 슬롯으로 초기화합니다.
 */
const selectedSlots = ref<Set<string>>(new Set());

watch(myScheduleData, (slots) => {
    if (!slots) return;
    selectedSlots.value = new Set(
        slots.filter(s => s.psbYn === 'Y').map(s => `${s.dsdDt}|${s.dsdTm}`)
    );
}, { immediate: true });

/** 이미 제출된 이력이 있는지 여부 */
const isSubmitted = computed(() => (myScheduleData.value?.length ?? 0) > 0);

/** 수정 모드 여부 (제출 후 "일정 수정" 버튼 클릭 시 활성화) */
const isEditing = ref(false);

/**
 * 그리드가 편집 가능한지 여부
 * readonly=true(일정 확정 후)이면 항상 false — 수정 불가
 */
const isEditable = computed(() => {
    if (props.readonly) return false;
    return !isSubmitted.value || isEditing.value;
});

// ── 슬롯 토글 ──────────────────────────────────────────────────────

const toggleSlot = (date: string, time: string) => {
    if (!isEditable.value) return;
    const key = `${date}|${time}`;
    if (selectedSlots.value.has(key)) {
        selectedSlots.value.delete(key);
    } else {
        selectedSlots.value.add(key);
    }
    selectedSlots.value = new Set(selectedSlots.value);
};

const isSelected = (date: string, time: string) =>
    selectedSlots.value.has(`${date}|${time}`);

// ── 제출 / 수정 ────────────────────────────────────────────────────

const saving = ref(false);

/**
 * 일정 제출 (신규 또는 수정)
 */
const handleSubmit = async () => {
    if (selectedSlots.value.size === 0) {
        toast.add({ severity: 'warn', summary: '확인', detail: '가능한 일정을 1개 이상 선택해 주세요.', life: 3000 });
        return;
    }

    const allSlots: ScheduleSlot[] = [];
    for (const date of candidateDates.value) {
        for (const time of timeSlots) {
            allSlots.push({
                dsdDt: date,
                dsdTm: time,
                psbYn: isSelected(date, time) ? 'Y' : 'N',
            });
        }
    }

    saving.value = true;
    try {
        await submitSchedule(props.asctId, allSlots);
        toast.add({ severity: 'success', summary: '제출 완료', detail: '가능 일정이 제출되었습니다.', life: 3000 });
        isEditing.value = false;
        emit('submitted');
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '일정 제출 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
};

/** 수정 모드 진입 */
const handleEdit = () => {
    isEditing.value = true;
};

/** 날짜 표시 형식: yyyy-MM-dd → MM/dd (요일) */
const formatDateLabel = (dt: string): string => {
    const [, m, d] = dt.split('-');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const day = new Date(dt).getDay();
    return `${m}/${d} (${dayNames[day]})`;
};
</script>

<template>
    <div class="space-y-4">

        <!-- 로딩 -->
        <div v-if="loadingMySchedule" class="space-y-2">
            <Skeleton height="2rem" class="w-full" />
            <Skeleton height="8rem" class="w-full" />
        </div>

        <template v-else>
            <!-- 안내 문구: 확정 잠금 / 제출 후 수정 모드 / 신규 입력 -->
            <p class="text-sm text-zinc-500">
                <template v-if="readonly">
                    일정이 확정되어 수정할 수 없습니다.
                </template>
                <template v-else-if="isSubmitted && !isEditing">
                    제출한 일정입니다. 수정하려면 <strong>일정 수정</strong> 버튼을 클릭하세요.
                </template>
                <template v-else>
                    참석 가능한 날짜와 시간대를 모두 선택해 주세요.
                </template>
            </p>

            <!-- 일정 체크박스 그리드 -->
            <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                    <thead>
                        <tr>
                            <th class="text-left px-3 py-2 bg-zinc-50 dark:bg-zinc-800 font-medium text-zinc-500 border border-zinc-200 dark:border-zinc-700 w-24">
                                시간대
                            </th>
                            <th
                                v-for="date in candidateDates"
                                :key="date"
                                class="px-2 py-2 bg-zinc-50 dark:bg-zinc-800 font-medium text-zinc-500 border border-zinc-200 dark:border-zinc-700 text-center whitespace-nowrap"
                            >
                                {{ formatDateLabel(date) }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="time in timeSlots" :key="time">
                            <td class="px-3 py-2 font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
                                {{ time }}
                            </td>
                            <td
                                v-for="date in candidateDates"
                                :key="`${date}-${time}`"
                                class="px-2 py-2 border border-zinc-200 dark:border-zinc-700 text-center transition-colors"
                                :class="[
                                    isEditable ? 'cursor-pointer' : 'cursor-default',
                                    isSelected(date, time)
                                        ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                        : isEditable ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''
                                ]"
                                @click="toggleSlot(date, time)"
                            >
                                <Checkbox
                                    :model-value="isSelected(date, time)"
                                    binary
                                    :pt="{ root: { style: 'pointer-events: none' } }"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 하단 버튼 영역 (readonly=true 시 버튼 미표출) -->
            <div class="flex items-center justify-between text-sm">
                <span class="text-zinc-500">
                    선택된 가능 시간: <strong class="text-indigo-600 dark:text-indigo-400">{{ selectedSlots.size }}개</strong>
                </span>
                <template v-if="!readonly">
                    <!-- 제출 완료 후 수정 모드가 아닐 때: 일정 수정 버튼 -->
                    <Button
                        v-if="isSubmitted && !isEditing"
                        label="일정 수정"
                        icon="pi pi-pencil"
                        severity="secondary"
                        outlined
                        @click="handleEdit"
                    />
                    <!-- 신규 제출 또는 수정 중일 때: 일정 제출 버튼 -->
                    <Button
                        v-else
                        label="일정 제출"
                        icon="pi pi-send"
                        :loading="saving"
                        :disabled="selectedSlots.size === 0"
                        @click="handleSubmit"
                    />
                </template>
            </div>
        </template>

    </div>
</template>
