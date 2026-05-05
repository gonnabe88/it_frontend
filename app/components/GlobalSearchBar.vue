<!--
================================================================================
[components/GlobalSearchBar.vue] 헤더 통합검색 V1+V2 컴포넌트
================================================================================
V1: 기본 닫힘 상태 — zinc-100 pill + 검색 아이콘 + ⌘K 배지
V2: 포커스 상태 — indigo 링 + 스코프 칩(전체/사업/업무비) + 결과 드롭다운

[주요 기능]
 - 스코프 필터: 전체 / 정보화사업 / 전산업무비
 - 키보드 탐색: ↑↓ 선택, ↵ 이동, esc 닫기
 - ⌘K / Ctrl+K 전역 단축키로 포커스
 - 검색어 하이라이트 (DOMPurify 새니타이징 필수 — CLAUDE.md 4.4)
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import DOMPurify from 'isomorphic-dompurify';
import { useGlobalSearch, type SearchResult } from '~/composables/useGlobalSearch';

/** 스코프 구분 타입 */
type Scope = 'all' | 'project' | 'cost';

const { suggestions, searchByName } = useGlobalSearch();

const inputRef = ref<HTMLInputElement | null>(null);
const query = ref('');
const focused = ref(false);
const activeScope = ref<Scope>('all');
const highlightedIndex = ref(-1);

/* ── 결과 분류 ─────────────────────────────────────────────── */

const projectResults = computed(() =>
    suggestions.value.filter(s => s.type === '정보화사업')
);
const costResults = computed(() =>
    suggestions.value.filter(s => s.type === '전산업무비')
);
/** 현재 스코프에서 보여줄 정보화사업 목록 */
const visibleProjects = computed(() =>
    activeScope.value === 'cost' ? [] : projectResults.value
);
/** 현재 스코프에서 보여줄 전산업무비 목록 */
const visibleCosts = computed(() =>
    activeScope.value === 'project' ? [] : costResults.value
);
/** 키보드 탐색을 위한 단순 목록 (정보화사업 → 전산업무비 순) */
const flatResults = computed<SearchResult[]>(() => [
    ...visibleProjects.value,
    ...visibleCosts.value,
]);

/** 드롭다운 표시 여부 */
const showDropdown = computed(() =>
    focused.value && query.value.trim().length > 0
);

/* ── 이벤트 핸들러 ──────────────────────────────────────────── */

/** 검색어 입력 핸들러 */
const onInput = async (e: Event) => {
    query.value = (e.target as HTMLInputElement).value;
    highlightedIndex.value = -1;
    await searchByName({ query: query.value });
};

/** 검색창 초기화 및 포커스 유지 */
const clearQuery = () => {
    query.value = '';
    searchByName({ query: '' });
    highlightedIndex.value = -1;
    inputRef.value?.focus();
};

/** 결과 항목 선택 → 상세 페이지로 이동 */
const selectResult = (result: SearchResult) => {
    focused.value = false;
    query.value = '';
    searchByName({ query: '' });
    navigateTo(result.route);
};

/**
 * 키보드 탐색 핸들러
 * ↓/↑: 하이라이트 이동, ↵: 선택, esc: 드롭다운 닫기
 */
const onKeyDown = (e: KeyboardEvent) => {
    if (!showDropdown.value) return;
    if (e.key === 'Escape') {
        focused.value = false;
        inputRef.value?.blur();
        return;
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIndex.value = Math.min(
            highlightedIndex.value + 1,
            flatResults.value.length - 1
        );
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
    } else if (e.key === 'Enter') {
        const r = flatResults.value[highlightedIndex.value];
        if (r) selectResult(r);
    }
};

/* ── 유틸리티 ───────────────────────────────────────────────── */

/**
 * 검색어를 <mark> 태그로 감싸 하이라이트합니다.
 * v-html 사용 전 반드시 DOMPurify.sanitize()를 통해 새니타이징합니다. (CLAUDE.md 4.4)
 */
const highlight = (text: string): string => {
    if (!query.value.trim()) return DOMPurify.sanitize(text);
    const escaped = query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const marked = text.replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`);
    return DOMPurify.sanitize(marked);
};

/**
 * 상태값에 따른 인라인 태그 CSS 클래스를 반환합니다.
 * components.html의 .tag 색상 체계를 Tailwind 클래스로 구현합니다.
 */
const gsTagClass = (status: string, type: '정보화사업' | '전산업무비'): string => {
    if (type === '전산업무비') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    const map: Record<string, string> = {
        '예산 작성':    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        '사전 협의':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        '정실협':       'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
        '요건 상세화':  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        '소요예산 산정':'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
        '과심위':       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
        '입찰/계약':    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
        '사업 추진':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        '예산배정':     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
        '대금지급':     'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
        '성과평가':     'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
        '완료':         'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    };
    return map[status] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400';
};

/* ── 전역 단축키 ────────────────────────────────────────────── */

/** ⌘K / Ctrl+K 로 검색창 포커스 */
const handleGlobalKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.value?.focus();
    }
};

onMounted(() => window.addEventListener('keydown', handleGlobalKey));
onUnmounted(() => window.removeEventListener('keydown', handleGlobalKey));
</script>

<template>
    <!--
        gsearch-stack: V2 드롭다운 포지셔닝 래퍼 (position: relative)
        @mousedown.prevent 드롭다운 영역: 클릭 시 input blur 방지 → 드롭다운 유지
    -->
    <div class="gsearch-stack" style="width: 20rem">
        <!-- V1 검색 바 (기본 닫힘 상태) -->
        <div class="gsearch" :class="{ 'is-focus': focused }">
            <i class="pi pi-search" />
            <input
                ref="inputRef"
                :value="query"
                class="gsearch-input"
                placeholder="통합검색"
                autocomplete="off"
                @input="onInput"
                @focus="focused = true"
                @blur="focused = false"
                @keydown="onKeyDown"
            >
            <button v-if="query" type="button" class="gs-clear" @click="clearQuery">
                <i class="pi pi-times" />
            </button>
        </div>

        <!-- V2 드롭다운 (포커스 + 입력 시 표시) -->
        <div v-if="showDropdown" class="gs-dropdown" @mousedown.prevent>
            <!-- 스코프 칩 -->
            <div class="gs-scopes">
                <button
                    class="gs-scope"
                    :class="{ on: activeScope === 'all' }"
                    @click="activeScope = 'all'; highlightedIndex = -1">
                    전체 <span class="ct">{{ suggestions.length }}</span>
                </button>
                <button
                    class="gs-scope"
                    :class="{ on: activeScope === 'project' }"
                    @click="activeScope = 'project'; highlightedIndex = -1">
                    사업 <span class="ct">{{ projectResults.length }}</span>
                </button>
                <button
                    class="gs-scope"
                    :class="{ on: activeScope === 'cost' }"
                    @click="activeScope = 'cost'; highlightedIndex = -1">
                    업무비 <span class="ct">{{ costResults.length }}</span>
                </button>
            </div>

            <template v-if="flatResults.length > 0">
                <!-- 정보화사업 섹션 -->
                <div v-if="visibleProjects.length > 0" class="gs-section">
                    <div class="gs-shead">
                        <span>정보화사업 · {{ visibleProjects.length }}건</span>
                        <span class="more" @click="selectResult({ id: '', name: '', type: '정보화사업', route: '/info/projects', deptNm: '', budget: 0, status: '' })">전체보기</span>
                    </div>
                    <button
                        v-for="r in visibleProjects"
                        :key="r.id"
                        class="gs-result proj"
                        :class="{ hi: flatResults.indexOf(r) === highlightedIndex }"
                        @click="selectResult(r)"
                        @mouseenter="highlightedIndex = flatResults.indexOf(r)">
                        <div class="gsr-ic"><i class="pi pi-briefcase" /></div>
                        <div class="gsr-body">
                            <div class="gsr-title" v-html="highlight(r.name)" />
                            <div class="gsr-meta">
                                <span class="mono">{{ r.id }}</span>
                                <span>·</span>
                                <span>{{ r.deptNm || '-' }}</span>
                                <template v-if="r.status">
                                    <span>·</span>
                                    <span
                                        class="rounded px-1.5 py-px text-[10px] leading-none"
                                        :class="gsTagClass(r.status, r.type)">{{ r.status }}</span>
                                </template>
                            </div>
                        </div>
                        <div v-if="flatResults.indexOf(r) === highlightedIndex" class="gsr-trail">↵ 열기</div>
                    </button>
                </div>

                <!-- 전산업무비 섹션 -->
                <div v-if="visibleCosts.length > 0" class="gs-section">
                    <div class="gs-shead">
                        <span>전산업무비 · {{ visibleCosts.length }}건</span>
                        <span class="more" @click="selectResult({ id: '', name: '', type: '전산업무비', route: '/info/cost', deptNm: '', budget: 0, status: '' })">전체보기</span>
                    </div>
                    <button
                        v-for="r in visibleCosts"
                        :key="r.id"
                        class="gs-result cost"
                        :class="{ hi: flatResults.indexOf(r) === highlightedIndex }"
                        @click="selectResult(r)"
                        @mouseenter="highlightedIndex = flatResults.indexOf(r)">
                        <div class="gsr-ic"><i class="pi pi-wallet" /></div>
                        <div class="gsr-body">
                            <div class="gsr-title" v-html="highlight(r.name)" />
                            <div class="gsr-meta">
                                <span class="mono">{{ r.id }}</span>
                                <span>·</span>
                                <span>{{ r.deptNm || '-' }}</span>
                                <template v-if="r.status">
                                    <span>·</span>
                                    <span
                                        class="rounded px-1.5 py-px text-[10px] leading-none"
                                        :class="gsTagClass(r.status, r.type)">{{ r.status }}</span>
                                </template>
                            </div>
                        </div>
                        <div v-if="flatResults.indexOf(r) === highlightedIndex" class="gsr-trail">↵ 열기</div>
                    </button>
                </div>
            </template>

            <!-- 빈 상태 -->
            <div v-else class="gs-empty">
                <i class="pi pi-search" />
                <span>"{{ query }}"에 대한 결과 없음</span>
            </div>

            <!-- 키보드 단축키 안내 푸터 -->
            <div class="gs-foot">
                <span><kbd>↑↓</kbd> 탐색</span>
                <span><kbd>↵</kbd> 열기</span>
                <span><kbd>esc</kbd> 닫기</span>
            </div>
        </div>
    </div>
</template>
