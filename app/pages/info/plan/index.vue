<!--
================================================================================
[pages/info/plan/index.vue] 정보기술부문 계획 조회 페이지
================================================================================
등록된 IT 부문 계획 목록을 데이터테이블 형태로 표시합니다.

[주요 기능]
  - 계획 목록 조회 (DataTable 표시)
  - 예산 단위 전환 (원 / 천원 / 백만원 / 억원)
  - 행 클릭 → 상세 페이지(/info/plan/:id) 이동
  - [계획 등록] 버튼 → 계획 등록 폼(/info/plan/form) 이동
================================================================================
-->
<script setup lang="ts">
import { ref, computed, onActivated } from 'vue';
import { usePlan, type Plan } from '~/composables/usePlan';
import { formatBudget as formatBudgetUtil } from '~/utils/common';

/* 페이지 탭 제목 설정 */
const title = '정보기술부문 계획';
definePageMeta({ title });

/* 계획 목록 데이터 가져오기 */
const { fetchPlans } = usePlan();
const { data: plansData, error, refresh: refreshPlans } = await fetchPlans();

/** KeepAlive 재활성화 시 최신 데이터 재조회 */
onActivated(() => refreshPlans());

/** 계획 목록 (null 안전 처리) */
const plans = computed(() => plansData.value || []);

/* ── 예산 단위 변환 ── */
const units = ['원', '천원', '백만원', '억원'];
const selectedUnit = ref('백만원'); // 기본 표시 단위

/**
 * 예산 금액을 선택된 단위로 변환하여 반환
 *
 * @param amount - 변환할 원(KRW) 단위 숫자
 * @returns 단위 변환 후 포맷팅된 문자열
 */
const formatBudget = (amount: number) => formatBudgetUtil(amount, selectedUnit.value);

/**
 * 날짜 문자열을 YYYY-MM-DD 형태로 표시
 *
 * @param dateStr - ISO datetime 문자열
 * @returns 날짜 문자열 (YYYY-MM-DD)
 */
const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return dateStr.substring(0, 10);
};

/**
 * 계획 행 클릭 시 상세 페이지로 이동
 *
 * @param event - DataTable rowClick 이벤트
 */
const onRowClick = (event: { data: Plan }) => {
    navigateTo(`/info/plan/${event.data.plnMngNo}`);
};
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더: 제목 + 예산 단위 선택 + 액션 버튼 -->
        <div class="flex items-center justify-between gap-4 flex-wrap">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-3 flex-wrap">
                <!-- 예산 표시 단위 선택 (원/천원/백만원/억원) -->
                <SelectButton v-model="selectedUnit" :options="units" aria-labelledby="unit-select" />
                <!-- 계획 등록 이동 -->
                <Button label="계획 등록" icon="pi pi-plus" @click="navigateTo('/info/plan/form')" />
            </div>
        </div>

        <!-- 데이터 테이블 영역 -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">

            <!-- API 오류 표시 -->
            <div v-if="error" class="p-4 text-red-500">
                데이터를 불러오는 중 오류가 발생했습니다: {{ error.message }}
            </div>

            <!-- 계획 목록 테이블 -->
            <DataTable
                v-else
                :value="plans"
                paginator
                :rows="10"
                :rowsPerPageOptions="[10, 20, 50]"
                dataKey="plnMngNo"
                tableStyle="min-width: 50rem"
                selectionMode="single"
                @rowClick="onRowClick"
                :pt="{
                    headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                    bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer' }
                }"
            >
                <!-- 대상연도 -->
                <Column field="plnYy" header="대상연도" sortable headerClass="font-bold" style="width: 8rem" />

                <!-- 계획구분 (신규/조정) -->
                <Column field="plnTp" header="신규/조정" sortable headerClass="font-bold" style="width: 8rem">
                    <template #body="slotProps">
                        <Tag
                            :value="slotProps.data.plnTp"
                            :severity="slotProps.data.plnTp === '신규' ? 'success' : 'warn'"
                        />
                    </template>
                </Column>

                <!-- 계획관리번호 -->
                <Column field="plnMngNo" header="계획관리번호" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                            {{ slotProps.data.plnMngNo }}
                        </span>
                    </template>
                </Column>

                <!-- 총예산 -->
                <Column field="ttlBg" :header="`총예산 (${selectedUnit})`" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.ttlBg) }}</span>
                    </template>
                </Column>

                <!-- 자본예산 -->
                <Column field="cptBg" :header="`자본예산 (${selectedUnit})`" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.cptBg) }}</span>
                    </template>
                </Column>

                <!-- 일반관리비 -->
                <Column field="mngc" :header="`일반관리비 (${selectedUnit})`" sortable headerClass="font-bold">
                    <template #body="slotProps">
                        <span class="tabular-nums">{{ formatBudget(slotProps.data.mngc) }}</span>
                    </template>
                </Column>

                <!-- 등록일 -->
                <Column field="fstEnrDtm" header="등록일" sortable headerClass="font-bold" style="width: 10rem">
                    <template #body="slotProps">
                        {{ formatDate(slotProps.data.fstEnrDtm) }}
                    </template>
                </Column>

                <!-- 등록자 -->
                <Column field="fstEnrUsid" header="등록자" sortable headerClass="font-bold" style="width: 8rem" />

                <!-- 데이터 없음 표시 -->
                <template #empty>
                    <div class="text-center py-8 text-zinc-500 dark:text-zinc-400">
                        등록된 계획이 없습니다.
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>
