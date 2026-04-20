<!--
================================================================================
[components/council/evaluation/EvaluationForm.vue]
평가의견 작성 컴포넌트 (Step 3 — 평가위원)
================================================================================
타당성 자체점검 6항목별로 점수(1~5)와 검토의견을 입력합니다.
1~2점 시 검토의견 입력이 필수입니다.

[Props]
  asctId   : 협의회ID
  readonly : 이미 제출 완료된 경우 읽기 전용

[Emits]
  submitted : 저장 완료 시 발생

[Design Ref: §4.4 result/[id].vue — 평가위원 평가의견 작성]
================================================================================
-->
<script setup lang="ts">
import type { CheckItemCode } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'submitted'): void;
}>();

const { saveEvaluation } = useCouncil();
const toast = useToast();

// ── 평가 항목 목록 ───────────────────────────────────────────────────
interface EvalItem {
    ckgItmC: CheckItemCode;
    ckgItmNm: string;
    ckgRcrd: number | null;
    ckgOpnn: string;
}

const evalItems = ref<EvalItem[]>([
    { ckgItmC: 'MGMT_STR', ckgItmNm: '경영전략/계획 부합', ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'FIN_EFC',  ckgItmNm: '재무 효과',          ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'RISK_IMP', ckgItmNm: '리스크 개선 효과',   ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'REP_IMP',  ckgItmNm: '평판/이미지 개선 효과', ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'DUP_SYS',  ckgItmNm: '유사/중복 시스템 유무', ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'ETC',      ckgItmNm: '기타',                ckgRcrd: null, ckgOpnn: '' },
]);

const saving = ref(false);

/** 점수가 1~2점인 항목에서 의견이 비어있는지 검사 */
const hasOpinionError = computed(() =>
    evalItems.value.some((item) => item.ckgRcrd !== null && item.ckgRcrd <= 2 && !item.ckgOpnn.trim())
);

/** 전체 항목 점수 입력 완료 여부 */
const allScored = computed(() =>
    evalItems.value.every((item) => item.ckgRcrd !== null)
);

/**
 * 평가의견을 서버에 저장합니다.
 * 1~2점 항목은 의견 필수 검증합니다.
 */
const handleSubmit = async () => {
    if (!allScored.value) {
        toast.add({ severity: 'warn', summary: '확인', detail: '모든 항목의 점수를 입력해 주세요.', life: 3000 });
        return;
    }
    if (hasOpinionError.value) {
        toast.add({ severity: 'warn', summary: '확인', detail: '1~2점 항목은 검토의견 입력이 필수입니다.', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        await saveEvaluation(
            props.asctId,
            evalItems.value.map((item) => ({
                ckgItmC: item.ckgItmC,
                ckgRcrd: item.ckgRcrd!,
                ckgOpnn: item.ckgOpnn,
            }))
        );
        toast.add({ severity: 'success', summary: '제출 완료', detail: '평가의견이 저장되었습니다.', life: 3000 });
        emit('submitted');
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
};

/** 점수 옵션 레이블 */
const scoreOptions = [
    { value: 1, label: '1점 (매우 낮음)' },
    { value: 2, label: '2점 (낮음)' },
    { value: 3, label: '3점 (보통)' },
    { value: 4, label: '4점 (높음)' },
    { value: 5, label: '5점 (매우 높음)' },
];
</script>

<template>
    <div class="space-y-5">

        <p class="text-sm text-zinc-500">
            각 항목별로 타당성 점수(1~5점)를 선택하고, 1~2점 항목은 검토의견을 반드시 입력해 주세요.
        </p>

        <!-- 항목별 평가 입력 -->
        <div
            v-for="(item, idx) in evalItems"
            :key="item.ckgItmC"
            class="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3"
            :class="item.ckgRcrd !== null && item.ckgRcrd <= 2 ? 'border-amber-300 dark:border-amber-600' : ''"
        >
            <!-- 항목 헤더 -->
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <span
class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400
                                 text-xs font-bold flex items-center justify-center shrink-0">
                        {{ idx + 1 }}
                    </span>
                    <span class="font-medium text-zinc-800 dark:text-zinc-200 text-sm">
                        {{ item.ckgItmNm }}
                    </span>
                    <!-- 낮은 점수 경고 -->
                    <Tag
                        v-if="item.ckgRcrd !== null && item.ckgRcrd <= 2"
                        value="의견 필수"
                        severity="warn"
                        class="text-xs"
                    />
                </div>

                <!-- 점수 선택 -->
                <div v-if="!readonly">
                    <Select
                        v-model="item.ckgRcrd"
                        :options="scoreOptions"
                        option-label="label"
                        option-value="value"
                        placeholder="점수 선택"
                        class="text-sm"
                        style="min-width: 150px"
                    />
                </div>
                <div v-else>
                    <Tag
                        :value="`${item.ckgRcrd}점`"
                        :severity="item.ckgRcrd !== null && item.ckgRcrd <= 2 ? 'warn' : 'success'"
                    />
                </div>
            </div>

            <!-- 검토의견 입력 (1~2점 시 필수) -->
            <div v-if="!readonly || (readonly && item.ckgOpnn)">
                <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                    검토의견
                    <span v-if="item.ckgRcrd !== null && item.ckgRcrd <= 2" class="text-red-500">*</span>
                </label>
                <Textarea
                    v-if="!readonly"
                    v-model="item.ckgOpnn"
                    rows="3"
                    placeholder="검토의견을 입력하세요..."
                    class="w-full text-sm"
                    auto-resize
                    :class="item.ckgRcrd !== null && item.ckgRcrd <= 2 && !item.ckgOpnn.trim()
                        ? 'border-amber-400 dark:border-amber-600'
                        : ''"
                />
                <p v-else class="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-line">
                    {{ item.ckgOpnn || '—' }}
                </p>
            </div>
        </div>

        <!-- 제출 버튼 -->
        <div v-if="!readonly" class="flex justify-end pt-2">
            <Button
                label="평가의견 제출"
                icon="pi pi-send"
                :loading="saving"
                :disabled="!allScored || hasOpinionError"
                @click="handleSubmit"
            />
        </div>

    </div>
</template>
