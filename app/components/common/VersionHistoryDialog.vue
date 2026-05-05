<!--
================================================================================
[components/common/VersionHistoryDialog.vue] 버전 히스토리 다이얼로그 공통 컴포넌트
================================================================================
문서/계획 등 다양한 리소스의 버전 목록을 표시하는 재사용 가능한 다이얼로그입니다.
현재 조회 중인 버전을 강조하며, 특정 버전을 클릭하면 `select` 이벤트로 알립니다.
데이터 I/O 없음 — 부모에서 전달한 props만 렌더링하는 순수 표현 컴포넌트입니다.

[Props]
  - visible        : 다이얼로그 표시 여부 (v-model)
  - header         : 다이얼로그 헤더 텍스트 (기본: '버전 히스토리')
  - versions       : 표시할 버전 목록 (VersionHistoryItem[])
  - currentVersion : 현재 조회 중인 버전 번호 (강조 표시용, optional)
  - emptyMessage   : 버전 목록이 비어있을 때 안내 문구

[Events]
  - update:visible : 다이얼로그 닫힘 시 visible 상태 동기화
  - select         : 버전 항목 클릭 시 발생 (VersionHistoryItem 전달)

[사용처]
  - pages/info/documents/[id]/index.vue : 요구사항 정의서 상세 — 버전 뱃지 클릭
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue';

/** 버전 히스토리 항목 공용 타입 (리소스 종속성 없음) */
export interface VersionHistoryItem {
    /** 고유 키 (v-for key로 사용) */
    key: string | number;
    /** 버전 번호 (예: 1.00, 2.01) - 화면에는 v{version.toFixed(2)} 형태로 표시 */
    version: number;
    /** 최종 변경 일시 (부모가 미리 가공해 전달한 표시용 문자열) */
    changedAt: string;
    /** 부가 설명 라벨 (optional) */
    label?: string;
}

const props = withDefaults(defineProps<{
    visible: boolean;
    header?: string;
    versions: VersionHistoryItem[];
    currentVersion?: number;
    emptyMessage?: string;
}>(), {
    header: '버전 히스토리',
    currentVersion: undefined,
    emptyMessage: '버전 정보가 없습니다.'
});

const emit = defineEmits<{
    'update:visible': [value: boolean];
    'select': [item: VersionHistoryItem];
}>();

/** v-model:visible 양방향 바인딩 */
const isVisible = computed({
    get: () => props.visible,
    set: (value: boolean) => emit('update:visible', value)
});

/** 버전 항목 클릭 핸들러 — select 이벤트 발행 후 다이얼로그 자동 종료 */
const onSelect = (item: VersionHistoryItem) => {
    emit('select', item);
    isVisible.value = false;
};

/** 현재 버전 여부 판별 (부모에서 currentVersion을 제공한 경우에만 true 가능) */
const isCurrent = (item: VersionHistoryItem): boolean => {
    if (props.currentVersion === undefined) return false;
    return item.version === props.currentVersion;
};
</script>

<template>
    <Dialog
        v-model:visible="isVisible"
        :header="header"
        modal
        :style="{ width: 'var(--dialog-sm)' }">
        <!-- 버전 목록 -->
        <ul
            v-if="versions.length > 0"
            class="list-none p-0 m-0 max-h-[60vh] overflow-y-auto">
            <li
                v-for="item in versions" :key="item.key"
                class="flex items-center justify-between py-2.5 px-3 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors"
                :class="{ 'bg-indigo-50 dark:bg-indigo-900/20 font-bold text-primary': isCurrent(item) }"
                @click="onSelect(item)">
                <div class="flex items-center gap-2">
                    <span>v{{ item.version.toFixed(2) }}</span>
                    <!-- 현재 버전 표시 뱃지 -->
                    <Tag
                        v-if="isCurrent(item)"
                        value="현재"
                        severity="info"
                        class="text-xs" />
                    <span v-if="item.label" class="text-xs text-zinc-400 ml-1">{{ item.label }}</span>
                </div>
                <span class="text-sm text-zinc-500">{{ item.changedAt }}</span>
            </li>
        </ul>

        <!-- 버전 없음 안내 -->
        <p v-else class="text-sm text-zinc-400 italic py-4 text-center m-0">
            {{ emptyMessage }}
        </p>

        <template #footer>
            <AppDialogFooter>
                <Button label="닫기" severity="secondary" @click="isVisible = false" />
            </AppDialogFooter>
        </template>
    </Dialog>
</template>
