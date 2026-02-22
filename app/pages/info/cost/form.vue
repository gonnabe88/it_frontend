<!--
================================================================================
[pages/info/cost/form.vue] 전산업무비 신청/수정 폼 페이지
================================================================================
전산업무비 항목을 신규 등록하거나 기존 항목을 수정하는 인라인 편집 테이블 폼입니다.
쿼리 파라미터에 따라 3가지 모드로 동작합니다.

[동작 모드]
  1. 신규 등록: ?id 없음        → 빈 행 1개로 시작
  2. 단건 수정: ?id=itMngcNo    → 해당 항목 1건 로드
  3. 복수 수정: ?ids=id1,id2    → 복수 항목 일괄 로드 (일괄 수정)

[라우팅]
  - 접근: /info/cost/form
  - 단건 수정 접근: /info/cost/form?id=:id
  - 복수 수정 접근: /info/cost/form?ids=id1,id2,...
  - 저장 완료 후: /info/cost
  - 취소 시: router.back()

[UI 구성]
  - 인라인 편집 DataTable (editMode="cell" 방식)
  - 비목명, 계약명, 계약구분, 계약상대처, 예산, 통화, 지급주기, 최초지급일, 담당자
  - 행 추가 / 개별 행 삭제 버튼

[저장 로직]
  - itMngcNo 존재 시: updateCost (PUT) 호출
  - itMngcNo 없을 시: createCost (POST) 호출
  - fstDfrDt(Date 객체)는 YYYY-MM-01 문자열로 변환 후 전송
================================================================================
-->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useCost, type ItCost } from '~/composables/useCost';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchCost, createCost, updateCost, fetchCostsBulk } = useCost();

const title = '전산업무비 신청/수정';
definePageMeta({
    title
});

/** 현재 편집 중인 전산업무비 항목 목록 */
const costs = ref<ItCost[]>([]);

/**
 * 초기 데이터 로드
 * 쿼리 파라미터(id/ids)에 따라 적절한 API를 호출합니다.
 *
 * - id가 있으면 단건 조회 후 rows에 추가
 * - ids가 있으면 복수 조회(Bulk) 후 rows에 추가
 * - 둘 다 없으면 빈 행 1개 추가 (신규 등록)
 */
onMounted(async () => {
    const id = route.query.id as string;
    const ids = route.query.ids as string;

    if (id) {
        /* 단건 수정 모드: 지정된 관리번호 1건 로드 */
        try {
            const { data } = await fetchCost(id);
            if (data.value) {
                const costData = { ...data.value };
                /* 최초지급일을 Date 객체로 변환 (DatePicker 바인딩용) */
                if (costData.fstDfrDt) {
                    costData.fstDfrDt = new Date(costData.fstDfrDt);
                }
                costs.value.push(costData);
            }
        } catch (e) {
            console.error('Failed to load cost', e);
        }
    } else if (ids) {
        /* 복수 수정 모드: 쉼표 구분된 관리번호 목록 일괄 로드 */
        try {
            const idList = ids.split(',');
            const data = await fetchCostsBulk(idList);
            if (data) {
                costs.value = data.map((item: ItCost) => {
                    const costData = { ...item };
                    /* 최초지급일을 Date 객체로 변환 (DatePicker 바인딩용) */
                    if (costData.fstDfrDt) {
                        costData.fstDfrDt = new Date(costData.fstDfrDt);
                    }
                    return costData;
                });
            }
        } catch (e) {
            console.error('Failed to load costs bulk', e);
        }
    } else {
        /* 신규 등록 모드: 빈 행 1개로 시작 */
        addCostRow();
    }
});

/**
 * 새 행 추가
 * 기본값으로 초기화된 빈 전산업무비 항목을 목록에 추가합니다.
 */
const addCostRow = () => {
    costs.value.push({
        ioeNm: '',
        cttNm: '',
        cttTp: '',
        cttOpp: '',
        itMngcBg: 0,
        dfrCle: '',
        fstDfrDt: '',
        cur: 'KRW',
        xcr: 0,
        xcrBseDt: '',
        infPrtYn: 'N',
        indRsn: '',
        pulCgpr: '',
        lstYn: 'Y',
        delYn: 'N'
    });
};

/**
 * 지정된 인덱스의 행 삭제
 * UI 목록에서만 제거합니다.
 * (실제 DB 삭제는 상세 화면의 삭제 버튼에서 처리)
 *
 * @param index - 삭제할 행의 인덱스
 */
const removeCostRow = (index: number) => {
    const item = costs.value[index];
    if (item?.itMngcNo) {
        // 기존 데이터 삭제 시 (여기서는 UI에서만 제거하고 저장은 안함, 혹은 별도 처리)
        // 요구사항이 "행추가/삭제하는 형식"이므로 UI에서 제거.
        // 실제 삭제 API 호출은 저장 시점에는 하지 않고, UI 목록에서만 뺌.
        // 만약 삭제 API도 호출해야 한다면 로직 추가 필요.
        // 여기서는 "신청/수정" 화면이므로, 수정 모드일 때 행을 지우면 삭제로 간주할지 여부가 모호함.
        // 보통 이런 그리드 폼에서는 저장 시점에 삭제된 항목을 처리하거나,
        // 단순히 입력 폼에서만 제거하는 방식임.
        // 안전하게 UI 제거만 하고, 실제 데이터 삭제는 상세 화면에서 하도록 유도하거나,
        // 명시적으로 삭제 API를 호출하지 않음 (사용자가 실수로 지울 수 있으므로).
    }
    costs.value.splice(index, 1);
};

/**
 * 전체 저장 처리
 * 목록의 모든 항목에 대해 순차적으로 생성(createCost) 또는 수정(updateCost) API를 호출합니다.
 * 저장 성공 시 확인 다이얼로그 표시 후 목록 페이지로 이동합니다.
 */
const saveCosts = async () => {
    if (costs.value.length === 0) {
        alert('저장할 데이터가 없습니다.');
        return;
    }

    /* 간단한 필수 입력값 유효성 검사 */
    for (const cost of costs.value) {
        if (!cost.ioeNm) {
            alert('비목명을 입력해주세요.');
            return;
        }
    }

    try {
        /* 항목별 순차 처리 */
        for (const cost of costs.value) {
            /* fstDfrDt가 Date 객체인 경우 YYYY-MM-DD 형식의 문자열로 변환 */
            /* 복사본을 만들어 전송 (UI 상태 유지를 위해 원본 변경 방지) */
            const payload = { ...cost };
            if (payload.fstDfrDt && payload.fstDfrDt instanceof Date) {
                const year = payload.fstDfrDt.getFullYear();
                const month = String(payload.fstDfrDt.getMonth() + 1).padStart(2, '0');
                const day = '01'; // 월 단위 선택이므로 1일로 고정
                payload.fstDfrDt = `${year}-${month}-${day}`;
            }

            /* itMngcNo 존재 여부로 수정/신규 구분 */
            if (payload.itMngcNo) {
                await updateCost(payload.itMngcNo, payload);
            } else {
                await createCost(payload);
            }
        }

        /* 저장 완료 확인 다이얼로그 표시 */
        confirm.require({
            message: '저장되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/cost');
            }
        });
    } catch (e) {
        console.error('Save failed', e);
        alert('저장 중 오류가 발생했습니다.');
    }
};

/**
 * 취소 처리
 * 이전 페이지로 이동합니다.
 */
const cancel = () => {
    router.back();
};

/* 드롭다운 선택지 옵션 */
const currencyOptions = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];
const ynOptions = ['Y', 'N'];
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더: 제목 + 액션 버튼 그룹 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex gap-2">
                <!-- 인라인 행 추가 버튼 -->
                <Button label="행 추가" icon="pi pi-plus" severity="secondary" @click="addCostRow" />
                <Button label="취소" severity="secondary" @click="cancel" />
                <Button label="저장" icon="pi pi-save" @click="saveCosts" />
            </div>
        </div>

        <!-- 인라인 편집 DataTable -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <DataTable :value="costs" editMode="cell" tableClass="editable-cells-table" :pt="{
                headerRow: { class: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300' },
                bodyRow: { class: 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors' }
            }">
                <!-- 비목명: 필수 입력 -->
                <Column header="비목명" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.ioeNm" class="w-full" />
                    </template>
                </Column>

                <!-- 계약명 -->
                <Column header="계약명" style="min-width: 150px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttNm" class="w-full" />
                    </template>
                </Column>

                <!-- 계약구분 -->
                <Column header="계약구분" style="min-width: 100px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttTp" class="w-full" />
                    </template>
                </Column>

                <!-- 계약상대처 -->
                <Column header="계약상대처" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputText v-model="data.cttOpp" class="w-full" />
                    </template>
                </Column>

                <!-- 예산: 통화에 따라 동적 서식 적용 -->
                <Column header="예산" style="min-width: 120px">
                    <template #body="{ data }">
                        <InputNumber v-model="data.itMngcBg" mode="currency" :currency="data.cur || 'KRW'"
                            locale="ko-KR" class="w-full" />
                    </template>
                </Column>

                <!-- 통화: 드롭다운 선택 -->
                <Column header="통화" style="width: 100px">
                    <template #body="{ data }">
                        <Select v-model="data.cur" :options="currencyOptions" class="w-full" />
                    </template>
                </Column>

                <!-- 지급주기 -->
                <Column header="지급주기" style="min-width: 100px">
                    <template #body="{ data }">
                        <InputText v-model="data.dfrCle" class="w-full" />
                    </template>
                </Column>

                <!-- 최초지급일: 월 단위(YYYY-MM) 선택 -->
                <Column header="최초지급일" style="min-width: 140px">
                    <template #body="{ data }">
                        <DatePicker v-model="data.fstDfrDt" view="month" dateFormat="yy-mm" showIcon fluid
                            placeholder="최초지급일" class="w-full" />
                    </template>
                </Column>

                <!-- 담당자 사원번호 입력 -->
                <Column header="담당자" style="min-width: 100px">
                    <template #body="{ data }">
                        <InputText v-model="data.pulCgpr" class="w-full" />
                    </template>
                </Column>

                <!-- 행 삭제 버튼 -->
                <Column header="삭제" style="width: 50px; text-align: center">
                    <template #body="{ index }">
                        <Button icon="pi pi-trash" text severity="danger" @click="removeCostRow(index)" />
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
