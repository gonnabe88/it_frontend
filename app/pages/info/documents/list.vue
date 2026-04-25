<!--
================================================================================
[pages/info/documents/list.vue] 요구사항 정의서 목록 페이지
================================================================================
요구사항 정의서 전체 목록을 조회하고 관리하는 페이지입니다.

[주요 기능]
  - 전체 목록 DataTable 조회
  - 제목 기준 검색 필터
  - 신규 등록 버튼 → /info/documents/form 이동
  - 행 클릭 → /info/documents/{id} 상세 페이지 이동
  - 삭제 버튼 (확인 다이얼로그 포함)

[라우팅]
  - 목록:   /info/documents
  - 상세:   /info/documents/{docMngNo}
  - 등록:   /info/documents/form
================================================================================
-->
<script setup lang="ts">
import { useDocuments } from '~/composables/useDocuments';
import type { RequirementDocument } from '~/composables/useDocuments';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import EmployeeInfoDialog from '~/components/common/EmployeeInfoDialog.vue';

const title = '사전협의';
definePageMeta({ title });

const { fetchDocuments, deleteDocument } = useDocuments();
const toast = useToast();
const confirm = useConfirm();

/* ── 데이터 로드 ── */
const { data: documentsData, pending, error, refresh } = await fetchDocuments();

/** KeepAlive 재활성화 시 최신 데이터 재조회 (최초 마운트 시 skip — lazy fetch와 중복 방지) */
let isFirstActivation = true;
onActivated(() => {
    if (isFirstActivation) { isFirstActivation = false; return; }
    refresh();
});

/** 목록 (null 안전 처리) */
const documents = computed(() => documentsData.value || []);

/* ── 검색 필터 ── */
const searchText = ref('');

const filteredDocuments = computed(() => {
    if (!searchText.value) return documents.value;
    const q = searchText.value.toLowerCase();
    return documents.value.filter(d =>
        d.reqNm?.toLowerCase().includes(q) ||
        d.docMngNo?.toLowerCase().includes(q)
    );
});

/* ── 삭제 처리 ── */
const isDeleting = ref(false);

/**
 * 삭제 확인 다이얼로그 후 삭제 실행
 * @param doc - 삭제할 문서
 */
const onDeleteClick = (event: Event, doc: RequirementDocument) => {
    confirm.require({
        target: event.currentTarget as HTMLElement,
        message: `"${doc.reqNm}" 문서를 삭제하시겠습니까?`,
        header: '삭제 확인',
        icon: 'pi pi-exclamation-triangle',
        acceptClass: 'p-button-danger',
        acceptLabel: '삭제',
        rejectLabel: '취소',
        accept: async () => {
            isDeleting.value = true;
            try {
                await deleteDocument(doc.docMngNo);
                toast.add({ severity: 'success', summary: '삭제 완료', detail: '문서가 삭제되었습니다.', life: 3000 });
                await refresh();
            } catch {
                toast.add({ severity: 'error', summary: '삭제 실패', detail: '삭제 중 오류가 발생했습니다.', life: 4000 });
            } finally {
                isDeleting.value = false;
            }
        }
    });
};

/* ── 직원 정보 다이얼로그 ── */
const showEmployeeInfo = ref(false);
const selectedEno = ref<string | null>(null);

/** 작성자 이름 클릭 시 직원 정보 다이얼로그 열기 */
const openEmployeeInfo = (eno: string) => {
    if (!eno) return;
    selectedEno.value = eno;
    showEmployeeInfo.value = true;
};

/* ── 날짜 포맷 ── */
const formatDate = (str: string) => str?.substring(0, 10) || '-';
</script>

<template>
    <div class="space-y-6">

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
                <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">IT 사전협의 문서를 작성하고 관리합니다.</p>
            </div>
            <Button label="신규 작성" icon="pi pi-plus" @click="navigateTo('/info/documents/form')" />
        </div>

        <!-- 검색 + 테이블 카드 -->
        <div class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4">

            <!-- 검색 영역 -->
            <div class="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
                <TableSearchInput
                    v-model="searchText"
                    placeholder="문서 제목 검색..."
                    width="24rem"
                />
                <Button
v-tooltip="'새로고침'" icon="pi pi-refresh" severity="secondary" outlined :loading="pending"
                    @click="() => refresh()" />
            </div>

            <!-- 오류 표시 -->
            <div v-if="error" class="p-6 text-center">
                <i class="pi pi-exclamation-circle text-4xl text-red-400 mb-3 block"/>
                <p class="text-red-500">데이터를 불러오는 중 오류가 발생했습니다.</p>
                <p class="text-sm text-zinc-400 mt-1">{{ error.message }}</p>
            </div>

            <!-- DataTable -->
            <StyledDataTable
v-else :value="filteredDocuments" :loading="pending" paginator :rows="10"
                :rows-per-page-options="[10, 20, 50]" data-key="docMngNo" sort-field="fstEnrDtm" :sort-order="-1"
                >

                <!-- 문서번호 -->
                <Column
field="docMngNo" header="문서번호" sortable style="width: 14%"
                    :pt="{ bodyCell: { style: 'text-align: center' } }"/>

                <!-- 버전 -->
                <Column
                    field="docVrs" header="버전" sortable style="width: 80px"
                    :pt="{ bodyCell: { style: 'text-align: center' } }">
                    <template #body="{ data }">
                        v{{ Number(data.docVrs).toFixed(2) }}
                    </template>
                </Column>

                <!-- 요구사항명: 상세 페이지 링크 -->
                <Column field="reqNm" header="요구사항명" sortable header-class="font-bold">
                    <template #body="{ data }">
                        <NuxtLink
:to="`/info/documents/${data.docMngNo}`"
                            class="hover:underline hover:text-indigo-600 cursor-pointer font-bold transition-colors text-zinc-900 dark:text-zinc-100">
                            {{ data.reqNm }}
                        </NuxtLink>
                    </template>
                </Column>

                <!-- 요청구분 -->
                <Column
field="reqDtt" header="요청구분" sortable style="width: 12%"
                    :pt="{ bodyCell: { style: 'text-align: center' } }"/>

                <!-- 업무구분 -->
                <Column
field="bzDtt" header="업무구분" sortable style="width: 12%"
                    :pt="{ bodyCell: { style: 'text-align: center' } }"/>

                <!-- 완료기한 -->
                <Column field="fsgTlm" header="완료기한" sortable style="width: 10%">
                    <template #body="{ data }">
                        <span
                            :class="data.fsgTlm && data.fsgTlm < new Date().toISOString().slice(0, 10) ? 'text-red-500 font-semibold' : ''">
                            {{ formatDate(data.fsgTlm) }}
                        </span>
                    </template>
                </Column>

                <!-- 등록일시 -->
                <Column field="fstEnrDtm" header="등록일시" sortable style="width: 11%">
                    <template #body="{ data }">
                        {{ data.fstEnrDtm?.substring(0, 16).replace('T', ' ') }}
                    </template>
                </Column>

                <!-- 작성자 -->
                <Column
field="fstEnrUsNm" header="작성자" sortable style="width: 8%"
                    :pt="{ bodyCell: { style: 'text-align: center' } }">
                    <template #body="{ data }">
                        <span
v-if="data.fstEnrUsNm"
                            class="hover:underline hover:text-indigo-600 cursor-pointer transition-colors"
                            @click="openEmployeeInfo(data.fstEnrUsid)">
                            {{ data.fstEnrUsNm }}
                        </span>
                        <span v-else class="text-zinc-400">-</span>
                    </template>
                </Column>

                <!-- 액션 버튼 -->
                <Column
header="" style="width: 8%"
                    :pt="{ bodyCell: { style: 'text-align: center' } }">
                    <template #body="{ data }">
                        <div class="flex justify-center gap-1.5">
                            <Button
v-tooltip="'편집'" icon="pi pi-pencil" size="small" text
                                rounded @click.stop="navigateTo(`/info/documents/${data.docMngNo}`)" />
                            <Button
v-tooltip="'삭제'" icon="pi pi-trash" size="small" text rounded severity="danger"
                                :loading="isDeleting" @click.stop="(e: Event) => onDeleteClick(e, data)" />
                        </div>
                    </template>
                </Column>

                <!-- 빈 상태 -->
                <template #empty>
                    <div class="py-12 text-center text-zinc-400">
                        <i class="pi pi-file text-4xl mb-3 block"/>
                        <p>등록된 요구사항 정의서가 없습니다.</p>
                        <Button
label="첫 문서 작성하기" icon="pi pi-plus" class="mt-3" size="small"
                            @click="navigateTo('/info/documents/form')" />
                    </div>
                </template>
            </StyledDataTable>
        </div>
    <ConfirmPopup />
    <EmployeeInfoDialog v-model:visible="showEmployeeInfo" :eno="selectedEno" />
    </div>
</template>
