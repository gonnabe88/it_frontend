<!--
================================================================================
[pages/admin/login-history.vue] 로그인 이력 조회 페이지
================================================================================
시스템관리자가 전체 사용자의 로그인 이력(TAAABB_CLOGNH)을 조회하는 화면입니다.

[주요 기능]
  - 전체 로그인 이력 조회 (최신순, 페이지네이션 50건)
  - LGN_TP 뱃지: LOGIN_SUCCESS(green), LOGIN_FAILURE(red), LOGOUT(secondary)
  - 이름 클릭: 직원정보 팝업

[Design Ref: §3.6 — 조회 전용 화면, §4.2 — 페이지네이션 응답 형식]
================================================================================
-->
<script setup lang="ts">
import type { AdminPageResponse, AdminLoginHistoryResponse } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();
const BASE = `${config.public.apiBase}/api/admin`;

const PAGE_SIZE = 50;
const currentPage = ref(0);
const pending = ref(false);

// 페이지 데이터 (반응형)
const historyData = ref<AdminPageResponse<AdminLoginHistoryResponse> | null>(null);

/**
 * 지정 페이지 로그인 이력 조회
 * 클라이언트 측 페이지 전환이므로 $apiFetch 사용
 */
const loadPage = async (page: number) => {
    pending.value = true;
    try {
        historyData.value = await $apiFetch<AdminPageResponse<AdminLoginHistoryResponse>>(
            `${BASE}/login-history`,
            { query: { page, size: PAGE_SIZE } },
        );
    } finally {
        pending.value = false;
    }
};

// 초기 데이터 로드
await loadPage(0);

// 페이지 변경 핸들러
const onPageChange = async (event: { page: number }) => {
    currentPage.value = event.page;
    await loadPage(event.page);
};

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 로그인 유형에 따른 Tag severity 반환
 */
const lgnTpSeverity = (lgnTp: string): string => {
    if (lgnTp === 'LOGIN_SUCCESS') return 'success';
    if (lgnTp === 'LOGIN_FAILURE') return 'danger';
    return 'secondary'; // LOGOUT
};

/**
 * 로그인 유형 한글 표시
 */
const lgnTpLabel = (lgnTp: string): string => {
    if (lgnTp === 'LOGIN_SUCCESS') return '로그인 성공';
    if (lgnTp === 'LOGIN_FAILURE') return '로그인 실패';
    if (lgnTp === 'LOGOUT') return '로그아웃';
    return lgnTp;
};
</script>

<template>
    <div>
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">로그인 이력</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    TAAABB_CLOGNH — 전체 로그인·실패·로그아웃 이력 (최신순)
                </p>
            </div>
        </div>

        <!-- 로그인 이력 DataTable -->
        <StyledDataTable
            :value="historyData?.content ?? []"
            :loading="pending"
            dataKey="fstEnrDtm"
            scrollable
            scrollHeight="calc(100vh - 360px)"
            class="p-datatable-sm"
            stripedRows>

            <!-- 사용자명 클릭 → 직원정보 팝업 -->
            <Column header="사용자" :style="{ width: '130px' }">
                <template #body="{ data }">
                    <span class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.eno)">
                        {{ data.usrNm || data.eno }}
                    </span>
                </template>
            </Column>

            <Column field="eno" header="사원번호" :style="{ width: '110px' }" />

            <Column field="lgnTp" header="유형" :style="{ width: '120px' }">
                <template #body="{ data }">
                    <Tag :value="lgnTpLabel(data.lgnTp)"
                         :severity="lgnTpSeverity(data.lgnTp)" />
                </template>
            </Column>

            <Column field="lgnDtm" header="발생시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.lgnDtm) }}
                </template>
            </Column>

            <Column field="ipAddr" header="IP 주소" :style="{ width: '140px' }" />

            <Column field="flurRsn" header="실패사유" :style="{ width: '200px' }">
                <template #body="{ data }">
                    <span class="text-red-500 text-sm">{{ data.flurRsn }}</span>
                </template>
            </Column>

            <Column field="ustAgt" header="User-Agent" :style="{ width: '250px' }">
                <template #body="{ data }">
                    <span class="text-xs text-zinc-400 truncate block max-w-[240px]"
                          :title="data.ustAgt">
                        {{ data.ustAgt }}
                    </span>
                </template>
            </Column>
        </StyledDataTable>

        <!-- 페이지네이션 -->
        <div class="mt-4 flex justify-center">
            <Paginator
                :rows="PAGE_SIZE"
                :totalRecords="historyData?.totalElements ?? 0"
                :first="currentPage * PAGE_SIZE"
                @page="onPageChange"
                template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport"
                currentPageReportTemplate="{first}–{last} / {totalRecords}건" />
        </div>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
