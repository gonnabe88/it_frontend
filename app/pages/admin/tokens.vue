<!--
================================================================================
[pages/admin/tokens.vue] JWT 갱신토큰 조회 페이지
================================================================================
시스템관리자가 JWT 갱신토큰(TAAABB_CRTOKM)을 조회하는 화면입니다.

[주요 기능]
  - 전체 갱신토큰 목록 조회 (조회 전용, 수정·삭제 없음)
  - 토큰값은 보안상 앞 20자 + "..." 마스킹 표시
  - 만료 여부 시각화 (현재 시각 기준)
  - 이름 클릭: 직원정보 팝업

[Design Ref: §3.6 — 조회 전용 화면, §6.3 — JWT 토큰 마스킹]
================================================================================
-->
<script setup lang="ts">
import { useAdminApi } from '~/composables/useAdminApi';
import { formatDateTime } from '~/utils/common';
import EmployeeSearchDialog from '~/components/common/EmployeeSearchDialog.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const { fetchTokens } = useAdminApi();

// 토큰 목록 (반응형)
const { data: tokens, pending } = await fetchTokens();

// 직원정보 팝업 상태
const employeeDialogVisible = ref(false);
const selectedEno = ref('');

const showEmployeeDialog = (eno: string) => {
    selectedEno.value = eno;
    employeeDialogVisible.value = true;
};

/**
 * 토큰 만료 여부 확인 (현재 시각 기준)
 */
const isExpired = (endDtm: string): boolean => {
    if (!endDtm) return true;
    return new Date(endDtm) < new Date();
};
</script>

<template>
    <div>
        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">JWT 갱신토큰</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    TAAABB_CRTOKM — 사용자별 Refresh Token 현황 (조회 전용)
                </p>
            </div>
        </div>

        <!-- 토큰 DataTable -->
        <StyledDataTable
            :value="tokens ?? []"
            :loading="pending"
            data-key="tokMasked"
            scrollable
            scroll-height="calc(100vh - 300px)"
            class="p-datatable-sm"
            striped-rows>

            <!-- 사용자명 클릭 → 직원정보 팝업 -->
            <Column header="사용자" :style="{ width: '130px' }">
                <template #body="{ data }">
                    <span
class="cursor-pointer text-blue-500 hover:underline"
                          @click="showEmployeeDialog(data.eno)">
                        {{ data.usrNm || data.eno }}
                    </span>
                </template>
            </Column>

            <Column field="eno" header="사원번호" :style="{ width: '110px' }" />

            <Column field="tokMasked" header="토큰 (마스킹)" :style="{ width: '220px' }">
                <template #body="{ data }">
                    <code class="text-xs text-zinc-500 dark:text-zinc-400">{{ data.tokMasked }}</code>
                </template>
            </Column>

            <Column field="endDtm" header="만료일시" :style="{ width: '160px' }">
                <template #body="{ data }">
                    <span :class="isExpired(data.endDtm) ? 'text-red-500' : 'text-green-600'">
                        {{ formatDateTime(data.endDtm) }}
                    </span>
                </template>
            </Column>

            <Column header="상태" :style="{ width: '90px' }">
                <template #body="{ data }">
                    <Tag
:value="isExpired(data.endDtm) ? '만료' : '유효'"
                         :severity="isExpired(data.endDtm) ? 'danger' : 'success'" />
                </template>
            </Column>

            <Column field="fstEnrDtm" header="발급시간" :style="{ width: '160px' }">
                <template #body="{ data }">
                    {{ formatDateTime(data.fstEnrDtm) }}
                </template>
            </Column>
        </StyledDataTable>

        <!-- 직원정보 팝업 -->
        <EmployeeSearchDialog v-model:visible="employeeDialogVisible" />
    </div>
</template>
