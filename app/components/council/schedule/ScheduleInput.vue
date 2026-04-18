<!--
================================================================================
[components/council/schedule/ScheduleInput.vue]
평가위원 일정 입력 컴포넌트 (Step 2 — 평가위원용)
================================================================================
평가위원이 협의회 가능 일정을 날짜×시간대 체크박스 형태로 입력합니다.
IT관리자가 지정한 후보 날짜 목록에서 가능 시간대를 선택합니다.

[Props]
  asctId : 협의회ID

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
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'submitted'): void;
}>();

const { submitSchedule } = useCouncil();
const toast = useToast();

/** 가능 시간대 목록 (고정) */
const timeSlots = ['10:00', '14:00', '15:00', '16:00'];

/**
 * 후보 날짜 목록 (현재 날짜 기준 2주 이내 평일)
 * 실제 서비스에서는 IT관리자가 설정한 날짜를 서버에서 받아올 수 있으나,
 * 현재는 프론트에서 2주 이내 평일을 자동 생성합니다.
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
        /* 평일(월=1 ~ 금=5)만 포함 */
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

/**
 * 선택된 슬롯 집합
 * Key: "yyyy-MM-dd|HH:mm" 형태의 복합키
 */
const selectedSlots = ref<Set<string>>(new Set());

/**
 * 슬롯 선택/해제 토글
 * @param date 날짜 (yyyy-MM-dd)
 * @param time 시간 (HH:mm)
 */
const toggleSlot = (date: string, time: string) => {
    const key = `${date}|${time}`;
    if (selectedSlots.value.has(key)) {
        selectedSlots.value.delete(key);
    } else {
        selectedSlots.value.add(key);
    }
    /* Set 반응성 보장을 위해 새 Set으로 교체 */
    selectedSlots.value = new Set(selectedSlots.value);
};

const isSelected = (date: string, time: string) =>
    selectedSlots.value.has(`${date}|${time}`);

const saving = ref(false);

/**
 * 일정 입력을 서버에 제출합니다.
 * 최소 1개 이상 선택해야 합니다.
 */
const handleSubmit = async () => {
    if (selectedSlots.value.size === 0) {
        toast.add({ severity: 'warn', summary: '확인', detail: '가능한 일정을 1개 이상 선택해 주세요.', life: 3000 });
        return;
    }

    /* Set → ScheduleSlot[] 변환 */
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
        emit('submitted');
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '일정 제출 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
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

        <p class="text-sm text-zinc-500">
            아래에서 참석 가능한 날짜와 시간대를 모두 선택해 주세요.
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
                            class="px-2 py-2 border border-zinc-200 dark:border-zinc-700 text-center cursor-pointer transition-colors"
                            :class="isSelected(date, time)
                                ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'"
                            @click="toggleSlot(date, time)"
                        >
                            <Checkbox
                                :model-value="isSelected(date, time)"
                                binary
                                @change="toggleSlot(date, time)"
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- 선택된 슬롯 수 표시 -->
        <div class="flex items-center justify-between text-sm">
            <span class="text-zinc-500">
                선택된 가능 시간: <strong class="text-indigo-600 dark:text-indigo-400">{{ selectedSlots.size }}개</strong>
            </span>
            <Button
                label="일정 제출"
                icon="pi pi-send"
                :loading="saving"
                :disabled="selectedSlots.size === 0"
                @click="handleSubmit"
            />
        </div>

    </div>
</template>
