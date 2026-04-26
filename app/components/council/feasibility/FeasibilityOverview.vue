<!--
================================================================================
[components/council/feasibility/FeasibilityOverview.vue]
타당성검토표 — 1. 사업 개요 섹션
================================================================================
타당성검토표의 첫 번째 섹션으로, 사업 기본 정보를 입력/표출합니다.

[입력 항목]
  - 사업명          (필수)
  - 사업기간        (예: 2026.01 ~ 2026.12)
  - 필요성          (최대 1000자)
  - 소요예산        (숫자, 원 단위)
  - 전결권자        (텍스트)
  - 사업내용        (최대 1000자)
  - 법률규제대응여부 (Y/N RadioButton)
  - 관련법률규제명   (법률규제=Y 일 때만 표출)
  - 기대효과        (최대 1000자)

[Props]
  modelValue  : FeasibilityData (v-model 바인딩)
  readonly    : 읽기 전용 여부 (SUBMITTED 이상 상태)

[Design Ref: §4.2 [id].vue — 사업 개요 섹션]
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { FeasibilityData } from '~/types/council';

interface Props {
    /** 타당성검토표 폼 데이터 (v-model) */
    modelValue: FeasibilityData;
    /** 읽기 전용 여부 (SUBMITTED 이상이면 true) */
    readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    readonly: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: FeasibilityData): void;
}>();

/** 개별 필드 업데이트 헬퍼 */
const update = (field: keyof FeasibilityData, value: unknown) => {
    emit('update:modelValue', { ...props.modelValue, [field]: value });
};

/** 법률규제=N으로 변경 시 관련법률규제명 초기화 */
const onLglRglYnChange = (val: 'Y' | 'N') => {
    if (val === 'N') {
        emit('update:modelValue', {
            ...props.modelValue,
            lglRglYn: val,
            lglRglNm: null,
        });
    } else {
        update('lglRglYn', val);
    }
};

/** 소요예산 표시값 (null 안전) */
const prjBgValue = computed({
    get: () => props.modelValue.prjBg ?? null,
    set: (v: number | null) => update('prjBg', v),
});
</script>

<template>
    <div class="space-y-5">

        <!-- 사업명 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                사업명 <span class="text-red-500">*</span>
            </label>
            <div class="md:col-span-3">
                <InputText
                    :value="modelValue.prjNm"
                    :disabled="readonly"
                    placeholder="사업명을 입력하세요"
                    fluid
                    @input="update('prjNm', ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>

        <!-- 사업기간 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                사업기간
            </label>
            <div class="md:col-span-3">
                <InputText
                    :value="modelValue.prjTrm"
                    :disabled="readonly"
                    placeholder="예: 2026.01 ~ 2026.12"
                    fluid
                    @input="update('prjTrm', ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>

        <!-- 필요성 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                필요성
            </label>
            <div class="md:col-span-3">
                <Textarea
                    :value="modelValue.ncs"
                    :disabled="readonly"
                    placeholder="사업의 필요성을 입력하세요 (최대 1000자)"
                    rows="4"
                    :maxlength="1000"
                    fluid
                    @input="update('ncs', ($event.target as HTMLTextAreaElement).value)"
                />
            </div>
        </div>

        <!-- 소요예산 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                소요예산 (원)
            </label>
            <div class="md:col-span-3">
                <InputNumber
                    v-model="prjBgValue"
                    :disabled="readonly"
                    placeholder="소요예산 (원 단위)"
                    :min="0"
                    mode="decimal"
                    :use-grouping="true"
                    fluid
                />
            </div>
        </div>

        <!-- 전결권자 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                전결권자
            </label>
            <div class="md:col-span-3">
                <InputText
                    :value="modelValue.edrt"
                    :disabled="readonly"
                    placeholder="예: 부점장, 본부장"
                    fluid
                    @input="update('edrt', ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>

        <!-- 사업내용 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                사업내용
            </label>
            <div class="md:col-span-3">
                <Textarea
                    :value="modelValue.prjDes"
                    :disabled="readonly"
                    placeholder="사업내용을 입력하세요 (최대 1000자)"
                    rows="4"
                    :maxlength="1000"
                    fluid
                    @input="update('prjDes', ($event.target as HTMLTextAreaElement).value)"
                />
            </div>
        </div>

        <!-- 법률규제대응여부 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                법률규제 대응 여부
            </label>
            <div class="md:col-span-3 flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <RadioButton
                        input-id="lglYes"
                        value="Y"
                        :model-value="modelValue.lglRglYn"
                        :disabled="readonly"
                        @update:model-value="onLglRglYnChange"
                    />
                    <label for="lglYes" class="text-sm cursor-pointer">해당</label>
                </div>
                <div class="flex items-center gap-2">
                    <RadioButton
                        input-id="lglNo"
                        value="N"
                        :model-value="modelValue.lglRglYn"
                        :disabled="readonly"
                        @update:model-value="onLglRglYnChange"
                    />
                    <label for="lglNo" class="text-sm cursor-pointer">해당없음</label>
                </div>
            </div>
        </div>

        <!-- 관련법률규제명 (법률규제=Y일 때만 표출) -->
        <div v-if="modelValue.lglRglYn === 'Y'" class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                관련 법률규제명
            </label>
            <div class="md:col-span-3">
                <InputText
                    :value="modelValue.lglRglNm ?? ''"
                    :disabled="readonly"
                    placeholder="관련 법률 또는 규제명을 입력하세요"
                    fluid
                    @input="update('lglRglNm', ($event.target as HTMLInputElement).value)"
                />
            </div>
        </div>

        <!-- 기대효과 -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-start">
            <label class="font-medium text-sm text-zinc-700 dark:text-zinc-300 md:pt-2">
                기대효과
            </label>
            <div class="md:col-span-3">
                <Textarea
                    :value="modelValue.xptEff"
                    :disabled="readonly"
                    placeholder="기대효과를 입력하세요 (최대 1000자)"
                    rows="4"
                    :maxlength="1000"
                    fluid
                    @input="update('xptEff', ($event.target as HTMLTextAreaElement).value)"
                />
            </div>
        </div>
    </div>
</template>
