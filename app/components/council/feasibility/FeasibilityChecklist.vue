<!--
================================================================================
[components/council/feasibility/FeasibilityChecklist.vue]
타당성검토표 — 2. 타당성 자체점검 섹션
================================================================================
6개 고정 점검항목(CCODEM CKG_ITM 기준)에 대해 내용 입력 + 1~5점 평가를 수행합니다.

[점검항목 목록]
  1. MGMT_STR — 경영전략/계획 부합
  2. FIN_EFC   — 재무 효과
  3. RISK_IMP  — 리스크 개선 효과
  4. REP_IMP   — 평판/이미지 개선 효과
  5. DUP_SYS   — 유사/중복 시스템 유무
  6. ETC       — 기타

[점수 RadioButton: 1 ~ 5 (별도 라벨 없이 숫자만 표시)]

[Props]
  modelValue : CheckItemData[] (v-model, 6개 항목 배열)
  readonly   : 읽기 전용 여부

[Design Ref: §4.2 [id].vue — 타당성 자체점검 섹션]
================================================================================
-->
<script setup lang="ts">
import type { CheckItemData } from '~/types/council';

interface Props {
    /** 6개 점검항목 배열 (v-model) */
    modelValue: CheckItemData[];
    /** 읽기 전용 여부 */
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: CheckItemData[]): void;
}>();

/** 점수 옵션 */
const scoreOptions = [1, 2, 3, 4, 5] as const;

/**
 * 특정 항목의 점수 업데이트
 *
 * @param index   항목 인덱스 (0~5)
 * @param score   선택된 점수 (1~5)
 */
const updateScore = (index: number, score: 1 | 2 | 3 | 4 | 5) => {
    const updated = props.modelValue.map((item, i) =>
        i === index ? { ...item, ckgRcrd: score } : item
    );
    emit('update:modelValue', updated);
};

/**
 * 특정 항목의 내용 업데이트
 *
 * @param index   항목 인덱스 (0~5)
 * @param content 입력된 내용
 */
const updateContent = (index: number, content: string) => {
    const updated = props.modelValue.map((item, i) =>
        i === index ? { ...item, ckgCone: content } : item
    );
    emit('update:modelValue', updated);
};
</script>

<template>
    <!--
        6개 점검항목 반복 렌더링
        Plan SC: 모든 항목에 내용과 점수 입력 필요 (작성완료 시 검증은 [id].vue에서 수행)
    -->
    <div class="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800">
        <div
            v-for="(item, index) in modelValue"
            :key="item.ckgItmC"
            class="grid grid-cols-1 md:grid-cols-12 gap-3 py-4 items-start"
        >
            <!-- 항목명 (좌측 고정) -->
            <div class="md:col-span-3">
                <p class="font-semibold text-sm text-zinc-700 dark:text-zinc-300">
                    {{ item.ckgItmNm }}
                </p>
            </div>

            <!-- 점검 내용 입력 (중앙) -->
            <div class="md:col-span-6">
                <Textarea
                    :value="item.ckgCone"
                    :disabled="readonly"
                    placeholder="점검 내용을 입력하세요"
                    rows="3"
                    fluid
                    @input="updateContent(index, ($event.target as HTMLTextAreaElement).value)"
                />
            </div>

            <!-- 점수 RadioButton 1~5 (우측) -->
            <div class="md:col-span-3">
                <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-2">점수 (1~5)</p>
                <div class="flex items-center gap-3">
                    <div
                        v-for="score in scoreOptions"
                        :key="score"
                        class="flex flex-col items-center gap-1"
                    >
                        <RadioButton
                            :input-id="`${item.ckgItmC}-${score}`"
                            :value="score"
                            :model-value="item.ckgRcrd"
                            :disabled="readonly"
                            @update:model-value="updateScore(index, score)"
                        />
                        <label
                            :for="`${item.ckgItmC}-${score}`"
                            class="text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer"
                        >
                            {{ score }}
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
