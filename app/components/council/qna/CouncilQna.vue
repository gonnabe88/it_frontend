<!--
================================================================================
[components/council/qna/CouncilQna.vue]
사전질의응답 컴포넌트 (Step 2 — 탭4)
================================================================================
평가위원의 사전 질의 목록을 표출하고,
추진부서 담당자(ITPZZ001)가 각 질의에 대해 답변을 입력합니다.

[Props]
  asctId   : 협의회ID
  canReply : 답변 입력 가능 여부 (ITPZZ001 전용)

[Design Ref: §4.3 prepare/[id].vue — 탭4 사전질의응답]
================================================================================
-->
<script setup lang="ts">
import type { QnaItem } from '~/types/council';
import { useToast } from 'primevue/usetoast';

interface Props {
    asctId: string;
    /** 답변 입력 가능 여부 (추진부서 담당자만 true) */
    canReply?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    canReply: false,
});

const { fetchQnaList, replyQna } = useCouncil();
const toast = useToast();

// ── 데이터 조회 ──────────────────────────────────────────────────────
const {
    data: qnaList,
    pending: loadingQna,
    refresh: refreshQna,
} = fetchQnaList(props.asctId);

// ── 답변 입력 상태 ───────────────────────────────────────────────────
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

        <!-- 로딩 -->
        <div v-if="loadingQna" class="space-y-3">
            <Skeleton v-for="i in 3" :key="i" height="5rem" class="w-full" />
        </div>

        <!-- 질의 없음 -->
        <div v-else-if="!qnaList || qnaList.length === 0"
            class="text-sm text-zinc-400 py-8 text-center border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
            등록된 사전 질의가 없습니다.
        </div>

        <!-- 질의 목록 -->
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
                        <!-- 질의 내용 -->
                        <p class="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                            {{ item.qtnCone }}
                        </p>
                        <!-- 질의자 정보 -->
                        <p class="text-xs text-zinc-400 mt-2">
                            질의자: {{ item.qtnNm ?? item.qtnEno }}
                        </p>
                    </div>

                    <!-- 답변 버튼 (추진부서 담당자, 미답변 상태) -->
                    <Button
                        v-if="canReply && item.repYn === 'N' && replyingId !== item.qtnId"
                        label="답변"
                        icon="pi pi-reply"
                        size="small"
                        severity="primary"
                        outlined
                        @click="startReply(item)"
                    />
                    <!-- 수정 버튼 (이미 답변된 경우) -->
                    <Button
                        v-else-if="canReply && item.repYn === 'Y' && replyingId !== item.qtnId"
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
                    class="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-700 bg-emerald-50/50 dark:bg-emerald-900/10"
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
                    class="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-700 bg-indigo-50/50 dark:bg-indigo-900/10"
                >
                    <div class="flex flex-col gap-2 pt-3">
                        <label class="text-xs font-medium text-indigo-600 dark:text-indigo-400">답변 입력</label>
                        <Textarea
                            v-model="replyText"
                            rows="4"
                            placeholder="답변 내용을 입력하세요..."
                            class="w-full text-sm"
                            autoResize
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
