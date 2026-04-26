<!--
================================================================================
[components/council/qna/CouncilQna.vue]
사전질의응답 컴포넌트 (Step 2 — 탭4 / result 페이지)
================================================================================
평가위원·IT관리자가 사전 질의를 등록하고,
추진부서 담당자(ITPZZ001)가 각 질의에 대해 답변을 입력합니다.

[Props]
  asctId   : 협의회ID
  canAsk   : 질의 등록 가능 여부 (평가위원 · IT관리자)
  canReply : 답변 입력 가능 여부 (추진부서 담당자)

[Design Ref: §4.3 prepare/[id].vue — 탭4 사전질의응답]
================================================================================
-->
<script setup lang="ts">
import type { QnaItem } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    /** 질의 등록 가능 여부 (평가위원 · IT관리자만 true) */
    canAsk?: boolean;
    /** 답변 입력 가능 여부 (추진부서 담당자만 true) */
    canReply?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    canAsk: false,
    canReply: false,
});

const { fetchQnaList, createQna, updateQna, replyQna } = useCouncil();
const toast = useToast();

/** 현재 로그인한 사용자 (본인 질의 여부 판단용) */
const { user } = useAuth();

// ── 데이터 조회 ──────────────────────────────────────────────────────
const {
    data: qnaList,
    pending: loadingQna,
    refresh: refreshQna,
} = fetchQnaList(props.asctId);

// ── 질의 등록 ────────────────────────────────────────────────────────

/** 질의 입력 폼 표시 여부 */
const showAskForm = ref(false);
/** 질의 내용 */
const askText = ref('');
/** 질의 등록 중 여부 */
const submittingAsk = ref(false);

/** 질의 등록 폼 열기 */
const openAskForm = () => {
    askText.value = '';
    showAskForm.value = true;
};

/** 질의 등록 폼 닫기 */
const closeAskForm = () => {
    showAskForm.value = false;
    askText.value = '';
};

/**
 * 질의 등록 (POST /api/council/{asctId}/qna)
 */
const handleAskSubmit = async () => {
    if (!askText.value.trim()) {
        toast.add({ severity: 'warn', summary: '확인', detail: '질의 내용을 입력해 주세요.', life: 3000 });
        return;
    }

    submittingAsk.value = true;
    try {
        await createQna(props.asctId, askText.value.trim());
        toast.add({ severity: 'success', summary: '등록 완료', detail: '사전 질의가 등록되었습니다.', life: 3000 });
        closeAskForm();
        await refreshQna();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '질의 등록 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        submittingAsk.value = false;
    }
};

// ── 질의 수정 ────────────────────────────────────────────────────────

/** 현재 수정 중인 qtnId (null = 수정 모드 아님) */
const editingId = ref<string | null>(null);
/** 수정 중인 질의 내용 */
const editText = ref('');
/** 수정 저장 중 여부 */
const savingEdit = ref(false);

/**
 * 본인 질의 여부 — 수정 버튼 표시 조건
 * canAsk=true 이고 본인이 등록한 질의일 때만 수정 가능
 */
const isMyQuestion = (qtnEno: string) =>
    props.canAsk && !!user.value?.eno && qtnEno === user.value.eno;

/** 질의 수정 모드 진입 */
const startEdit = (item: QnaItem) => {
    /* 답변 등록 폼이 열려 있으면 닫기 */
    replyingId.value = null;
    editingId.value = item.qtnId;
    editText.value = item.qtnCone;
};

/** 질의 수정 취소 */
const cancelEdit = () => {
    editingId.value = null;
    editText.value = '';
};

/**
 * 질의 수정 저장 (PATCH /api/council/{asctId}/qna/{qtnId})
 */
const handleSaveEdit = async (qtnId: string) => {
    if (!editText.value.trim()) {
        toast.add({ severity: 'warn', summary: '확인', detail: '질의 내용을 입력해 주세요.', life: 3000 });
        return;
    }

    savingEdit.value = true;
    try {
        await updateQna(props.asctId, qtnId, editText.value.trim());
        toast.add({ severity: 'success', summary: '수정 완료', detail: '질의가 수정되었습니다.', life: 3000 });
        cancelEdit();
        await refreshQna();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '질의 수정 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        savingEdit.value = false;
    }
};

// ── 답변 입력 ────────────────────────────────────────────────────────

/**
 * 현재 답변 입력 중인 qtnId
 * null 이면 답변 입력 모드가 아닙니다.
 */
const replyingId = ref<string | null>(null);
/** 답변 입력 내용 */
const replyText = ref('');
/** 저장 중 여부 */
const saving = ref(false);

/**
 * 답변 입력 모드 진입
 * @param item 답변 대상 질의
 */
const startReply = (item: QnaItem) => {
    /* 질의 수정 폼이 열려 있으면 닫기 */
    editingId.value = null;
    replyingId.value = item.qtnId;
    /* 기존 답변이 있으면 불러옵니다 */
    replyText.value = item.repCone ?? '';
};

/** 답변 입력 취소 */
const cancelReply = () => {
    replyingId.value = null;
    replyText.value = '';
};

/**
 * 답변 저장 (PUT /api/council/{asctId}/qna/{qtnId})
 * @param qtnId 질의응답ID
 */
const handleSaveReply = async (qtnId: string) => {
    if (!replyText.value.trim()) {
        toast.add({ severity: 'warn', summary: '확인', detail: '답변 내용을 입력해 주세요.', life: 3000 });
        return;
    }

    saving.value = true;
    try {
        await replyQna(props.asctId, qtnId, replyText.value.trim());
        toast.add({ severity: 'success', summary: '저장 완료', detail: '답변이 등록되었습니다.', life: 3000 });
        replyingId.value = null;
        replyText.value = '';
        await refreshQna();
    } catch {
        toast.add({ severity: 'error', summary: '오류', detail: '답변 저장 중 오류가 발생했습니다.', life: 3000 });
    } finally {
        saving.value = false;
    }
};
</script>

<template>
    <div class="space-y-4">

        <!-- ── 질의 등록 버튼 / 폼 ── -->
        <div v-if="canAsk">
            <!-- 폼이 닫혀 있을 때: 등록 버튼 -->
            <div v-if="!showAskForm" class="flex justify-end">
                <Button
                    label="질의 등록"
                    icon="pi pi-plus"
                    size="small"
                    @click="openAskForm"
                />
            </div>

            <!-- 질의 입력 폼 -->
            <div
                v-else
                class="border border-indigo-200 dark:border-indigo-700 rounded-lg p-4
                       bg-indigo-50/50 dark:bg-indigo-900/10 space-y-3"
            >
                <label class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    사전 질의 내용
                </label>
                <Textarea
                    v-model="askText"
                    rows="4"
                    placeholder="질의할 내용을 입력하세요..."
                    class="w-full text-sm"
                    auto-resize
                />
                <div class="flex justify-end gap-2">
                    <Button
                        label="취소"
                        severity="secondary"
                        outlined
                        size="small"
                        @click="closeAskForm"
                    />
                    <Button
                        label="등록"
                        icon="pi pi-send"
                        size="small"
                        :loading="submittingAsk"
                        :disabled="!askText.trim()"
                        @click="handleAskSubmit"
                    />
                </div>
            </div>
        </div>

        <!-- ── 로딩 ── -->
        <div v-if="loadingQna" class="space-y-3">
            <Skeleton v-for="i in 3" :key="i" height="5rem" class="w-full" />
        </div>

        <!-- ── 질의 없음 ── -->
        <div
            v-else-if="!qnaList || qnaList.length === 0"
            class="text-sm text-zinc-400 py-8 text-center border border-dashed
                   border-zinc-200 dark:border-zinc-700 rounded-lg"
        >
            등록된 사전 질의가 없습니다.
        </div>

        <!-- ── 질의 목록 ── -->
        <div v-else class="space-y-4">
            <div
                v-for="item in qnaList"
                :key="item.qtnId"
                class="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
            >
                <!-- 질의 헤더 -->
                <div class="flex items-start gap-3 p-4 bg-white dark:bg-zinc-900">
                    <!-- 상태 뱃지 -->
                    <Tag
                        :value="item.repYn === 'Y' ? '답변완료' : '미답변'"
                        :severity="item.repYn === 'Y' ? 'success' : 'warn'"
                        class="text-xs mt-0.5 shrink-0"
                    />

                    <div class="flex-1 min-w-0">
                        <!-- 질의 내용 (수정 모드가 아닐 때) -->
                        <p
                            v-if="editingId !== item.qtnId"
                            class="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed"
                        >
                            {{ item.qtnCone }}
                        </p>
                        <!-- 질의 수정 폼 (수정 모드일 때) -->
                        <div v-else class="flex flex-col gap-2">
                            <Textarea
                                v-model="editText"
                                rows="3"
                                placeholder="수정할 질의 내용을 입력하세요..."
                                class="w-full text-sm"
                                auto-resize
                            />
                            <div class="flex justify-end gap-2">
                                <Button
                                    label="취소"
                                    severity="secondary"
                                    text
                                    size="small"
                                    @click="cancelEdit"
                                />
                                <Button
                                    label="저장"
                                    icon="pi pi-check"
                                    size="small"
                                    :loading="savingEdit"
                                    :disabled="!editText.trim()"
                                    @click="handleSaveEdit(item.qtnId)"
                                />
                            </div>
                        </div>
                        <!-- 질의자 정보 -->
                        <p class="text-xs text-zinc-400 mt-2">
                            질의자: {{ item.qtnNm ?? item.qtnEno }}
                        </p>
                    </div>

                    <!-- 질의 수정 버튼 (본인 질의이고, 수정/답변 모드가 아닐 때) -->
                    <Button
                        v-if="isMyQuestion(item.qtnEno) && editingId !== item.qtnId && replyingId !== item.qtnId"
                        icon="pi pi-pencil"
                        size="small"
                        severity="secondary"
                        text
                        v-tooltip.top="'질의 수정'"
                        @click="startEdit(item)"
                    />
                    <!-- 답변 버튼 (추진부서 담당자, 미답변 상태) -->
                    <Button
                        v-if="canReply && item.repYn === 'N' && replyingId !== item.qtnId && editingId !== item.qtnId"
                        label="답변"
                        icon="pi pi-reply"
                        size="small"
                        severity="primary"
                        outlined
                        @click="startReply(item)"
                    />
                    <!-- 답변 수정 버튼 (이미 답변된 경우) -->
                    <Button
                        v-else-if="canReply && item.repYn === 'Y' && replyingId !== item.qtnId && editingId !== item.qtnId"
                        label="수정"
                        icon="pi pi-pencil"
                        size="small"
                        severity="secondary"
                        text
                        @click="startReply(item)"
                    />
                </div>

                <!-- 답변 표출 (답변완료 상태이고, 현재 편집 중이 아닐 때) -->
                <div
                    v-if="item.repYn === 'Y' && replyingId !== item.qtnId"
                    class="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-700
                           bg-emerald-50/50 dark:bg-emerald-900/10"
                >
                    <div class="flex items-start gap-3 pt-3">
                        <span class="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">답변</span>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                                {{ item.repCone }}
                            </p>
                            <p class="text-xs text-zinc-400 mt-2">
                                답변자: {{ item.repNm ?? item.repEno }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- 답변 입력 폼 -->
                <div
                    v-if="replyingId === item.qtnId"
                    class="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-700
                           bg-indigo-50/50 dark:bg-indigo-900/10"
                >
                    <div class="flex flex-col gap-2 pt-3">
                        <label class="text-xs font-medium text-indigo-600 dark:text-indigo-400">답변 입력</label>
                        <Textarea
                            v-model="replyText"
                            rows="4"
                            placeholder="답변 내용을 입력하세요..."
                            class="w-full text-sm"
                            auto-resize
                        />
                        <div class="flex justify-end gap-2">
                            <Button
                                label="취소"
                                severity="secondary"
                                text
                                size="small"
                                @click="cancelReply"
                            />
                            <Button
                                label="저장"
                                icon="pi pi-check"
                                size="small"
                                :loading="saving"
                                @click="handleSaveReply(item.qtnId)"
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>

    </div>
</template>
