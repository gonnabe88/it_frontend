<!--
================================================================================
[components/council/evaluation/EvaluationForm.vue]
평가의견 작성 컴포넌트 (Step 3 — 평가위원)
================================================================================
타당성 자체점검 6항목별로 점수(1~5)와 검토의견을 입력합니다.
1~2점 시 검토의견 입력이 필수입니다.

[동작 흐름]
  최초 진입 (미제출): 편집 모드 → "평가의견 제출" 버튼
  재진입 (제출 완료): 읽기 전용 모드 → "수정" / "확정" 버튼
    수정: 편집 모드로 전환 → "저장" 버튼
    확정: 현재 저장된 데이터를 그대로 재확정 (재제출)

[Props]
  asctId : 협의회ID

[Emits]
  submitted : 제출/저장 완료 시 발생

[Design Ref: §4.4 result/[id].vue — 평가위원 평가의견 작성]
================================================================================
-->
<script setup lang="ts">
import type { CheckItemCode } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    (e: 'submitted'): void;
}>();

const { fetchMyEvaluation, saveEvaluation } = useCouncil();
const toast = useToast();

// ── 평가 항목 목록 ───────────────────────────────────────────────────
interface EvalItem {
    ckgItmC: CheckItemCode;
    ckgItmNm: string;
    ckgRcrd: number | null;
    ckgOpnn: string;
}

const evalItems = ref<EvalItem[]>([
    { ckgItmC: 'MGMT_STR', ckgItmNm: '경영전략/계획 부합',    ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'FIN_EFC',  ckgItmNm: '재무 효과',             ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'RISK_IMP', ckgItmNm: '리스크 개선 효과',      ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'REP_IMP',  ckgItmNm: '평판/이미지 개선 효과', ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'DUP_SYS',  ckgItmNm: '유사/중복 시스템 유무', ckgRcrd: null, ckgOpnn: '' },
    { ckgItmC: 'ETC',      ckgItmNm: '기타',                  ckgRcrd: null, ckgOpnn: '' },
]);

// ── 기존 제출 데이터 로드 ────────────────────────────────────────────

/**
 * 이미 제출한 평가의견이 있는지 여부
 * 6개 항목이 모두 로드된 경우에만 true
 */
const hasSubmitted = ref(false);

/**
 * 편집 모드 여부
 * 미제출: 처음부터 편집 모드
 * 제출 완료: 읽기 전용 → 수정 버튼 클릭 시 편집 모드 전환
 */
const editMode = ref(false);

const { data: myEvaluation, pending: loadingMyEval } = fetchMyEvaluation(props.asctId);

/**
 * 기존 평가의견 데이터를 폼에 반영
 * 6개 항목이 모두 있으면 hasSubmitted = true, 읽기 전용 모드로 시작
 */
watch(myEvaluation, (data) => {
    if (!data || data.length === 0) {
        // 제출 이력 없음 → 편집 모드로 시작
        hasSubmitted.value = false;
        editMode.value = true;
        return;
    }

    // 기존 제출 데이터를 항목별로 매핑하여 폼에 반영
    const dataMap = new Map(data.map(d => [d.ckgItmC, d]));
    evalItems.value = evalItems.value.map(item => {
        const saved = dataMap.get(item.ckgItmC);
        return saved
            ? { ...item, ckgRcrd: saved.ckgRcrd, ckgOpnn: saved.ckgOpnn ?? '' }
            : item;
    });

    hasSubmitted.value = data.length >= 6;
    // 제출 완료 → 읽기 전용 모드로 시작
    editMode.value = false;
}, { immediate: true });

// ── 유효성 검사 ─────────────────────────────────────────────────────

/** 점수가 1~2점인 항목에서 의견이 비어있는지 검사 */
const hasOpinionError = computed(() =>
    evalItems.value.some(item => item.ckgRcrd !== null && item.ckgRcrd <= 2 && !item.ckgOpnn.trim())
);

/** 전체 항목 점수 입력 완료 여부 */
const allScored = computed(() =>
    evalItems.value.every(item => item.ckgRcrd !== null)
);

// ── 저장 ────────────────────────────────────────────────────────────

const saving = ref(false);

/**
 * 확정 완료 여부
 * 확정 버튼 클릭 후 수정/확정 버튼을 비활성화합니다.
 */
const confirmed = ref(false);

/**
 * 평가의견을 서버에 저장합니다.
 * 신규 제출과 수정 후 저장 모두 이 함수를 공유합니다.
 */
const handleSave = async () => {
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
        const isFirstSubmit = !hasSubmitted.value;
        await saveEvaluation(
            props.asctId,
            evalItems.value.map(item => ({
                ckgItmC: item.ckgItmC,
                ckgRcrd: item.ckgRcrd!,
                ckgOpnn: item.ckgOpnn,
            }))
        );
        hasSubmitted.value = true;
        editMode.value = false;
        toast.add({
            severity: 'success',
            summary: isFirstSubmit ? '제출 완료' : '저장 완료',
            detail: '평가의견이 저장되었습니다.',
            life: 3000,
        });
        emit('submitted');
    } catch (e: unknown) {
        const err = e as { data?: { message?: string }; message?: string };
        toast.add({
            severity: 'error',
            summary: '오류',
            detail: err?.data?.message ?? err?.message ?? '저장 중 오류가 발생했습니다.',
            life: 4000,
        });
    } finally {
        saving.value = false;
    }
};

/**
 * 확정: 현재 저장된 평가의견을 그대로 확정합니다.
 * 데이터는 이미 저장되어 있으므로 API 호출 없이 UI 상태만 변경합니다.
 * (재저장 시 부모 refreshCouncil → 컴포넌트 remount → confirmed 초기화 문제 방지)
 */
const handleConfirm = () => {
    confirmed.value = true;
    toast.add({
        severity: 'success',
        summary: '확정 완료',
        detail: '평가의견이 확정되었습니다.',
        life: 3000,
    });
};

/**
 * 수정 모드 전환
 */
const handleEdit = () => {
    editMode.value = true;
};

/**
 * 수정 취소 — 기존 저장 데이터로 복원
 */
const handleCancelEdit = () => {
    if (!myEvaluation.value || myEvaluation.value.length === 0) return;
    const dataMap = new Map(myEvaluation.value.map(d => [d.ckgItmC, d]));
    evalItems.value = evalItems.value.map(item => {
        const saved = dataMap.get(item.ckgItmC);
        return saved
            ? { ...item, ckgRcrd: saved.ckgRcrd, ckgOpnn: saved.ckgOpnn ?? '' }
            : item;
    });
    editMode.value = false;
};

// ── 점수 옵션 ────────────────────────────────────────────────────────
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

        <!-- 로딩 -->
        <div v-if="loadingMyEval" class="space-y-3">
            <Skeleton v-for="i in 6" :key="i" height="5rem" class="w-full" />
        </div>

        <template v-else>
            <!-- 상태 배너 -->
            <div
                v-if="hasSubmitted && !editMode"
                class="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
            >
                <div class="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                    <i class="pi pi-check-circle" />
                    <span>평가의견을 제출하셨습니다. 내용을 확인하고 수정하거나 확정해 주세요.</span>
                </div>
            </div>

            <!-- 안내 문구 (미제출) -->
            <p v-if="!hasSubmitted" class="text-sm text-zinc-500">
                각 항목별로 타당성 점수(1~5점)를 선택하고, 1~2점 항목은 검토의견을 반드시 입력해 주세요.
            </p>

            <!-- 항목별 평가 -->
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
                                   text-xs font-bold flex items-center justify-center shrink-0"
                        >
                            {{ idx + 1 }}
                        </span>
                        <span class="font-medium text-zinc-800 dark:text-zinc-200 text-sm">
                            {{ item.ckgItmNm }}
                        </span>
                        <!-- 낮은 점수 경고 (편집 모드에서만) -->
                        <Tag
                            v-if="editMode && item.ckgRcrd !== null && item.ckgRcrd <= 2"
                            value="의견 필수"
                            severity="warn"
                            class="text-xs"
                        />
                    </div>

                    <!-- 점수: 편집 모드 → Select, 읽기 전용 → Tag -->
                    <div v-if="editMode">
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
                            :value="item.ckgRcrd !== null ? `${item.ckgRcrd}점` : '미입력'"
                            :severity="item.ckgRcrd !== null && item.ckgRcrd <= 2 ? 'warn' : 'success'"
                        />
                    </div>
                </div>

                <!-- 검토의견 -->
                <div v-if="editMode || item.ckgOpnn">
                    <label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                        검토의견
                        <span v-if="editMode && item.ckgRcrd !== null && item.ckgRcrd <= 2" class="text-red-500">*</span>
                    </label>
                    <Textarea
                        v-if="editMode"
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

            <!-- 버튼 영역 -->
            <div class="flex justify-end gap-2 pt-2">

                <!-- 읽기 전용 모드: 수정 + 확정 -->
                <template v-if="hasSubmitted && !editMode">
                    <Button
                        label="수정"
                        icon="pi pi-pencil"
                        severity="secondary"
                        outlined
                        :disabled="confirmed"
                        @click="handleEdit"
                    />
                    <Button
                        label="확정"
                        icon="pi pi-check"
                        severity="success"
                        :loading="saving"
                        :disabled="confirmed"
                        @click="handleConfirm"
                    />
                </template>

                <!-- 편집 모드: 취소(기제출인 경우) + 저장/제출 -->
                <template v-else>
                    <Button
                        v-if="hasSubmitted"
                        label="취소"
                        icon="pi pi-times"
                        severity="secondary"
                        outlined
                        :disabled="saving"
                        @click="handleCancelEdit"
                    />
                    <Button
                        :label="hasSubmitted ? '저장' : '평가의견 제출'"
                        :icon="hasSubmitted ? 'pi pi-save' : 'pi pi-send'"
                        :loading="saving"
                        :disabled="!allScored || hasOpinionError"
                        @click="handleSave"
                    />
                </template>
            </div>
        </template>

    </div>
</template>
