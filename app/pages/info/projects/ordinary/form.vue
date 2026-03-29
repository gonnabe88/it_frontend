<!--
================================================================================
[pages/info/projects/ordinary/form.vue] 경상사업 등록/수정 폼 페이지
================================================================================
경상사업을 등록하거나 기존 경상사업을 수정하는 입력 폼입니다.
쿼리 파라미터 ?id가 있으면 수정 모드, 없으면 신규 등록 모드로 동작합니다.

[동작 모드]
  - 신규 등록: ?id 없음 → 빈 폼으로 시작
  - 수정 모드: ?id=prjMngNo → 해당 사업 정보 API 로드 후 폼에 바인딩

[폼 섹션 구성]
  1. 기본 정보: 사업연도, 유형, 사업명
  2. 사업 내용: 사업개요, 현황, 필요성
  3. 예산 정보: 소요예산(자동계산), 전결권(자동계산)
  4. 소요자원 상세내용: DataTable 인라인 편집 (행 추가/삭제)

[핵심 차이점: 일반 정보화사업과 다른 점]
  - ornYn='Y' 고정 전송 (경상사업 구분자)
  - 필드 축소: 담당부서, 사업범위, 기대효과 등 미표시
  - 저장 후 /info/projects/ordinary 로 이동

[단가 자동 계산]
  - gclAmt(소계) ÷ quantity(수량)으로 unitPrice 자동 계산

[라우팅]
  - 접근(신규): /info/projects/ordinary/form
  - 접근(수정): /info/projects/ordinary/form?id=:prjMngNo
  - 저장 완료 후: /info/projects/ordinary
  - 취소 시: router.back()
================================================================================
-->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useProjects } from '~/composables/useProjects';
import { PROJECT_STAGES, getApprovalAuthority } from '~/utils/common';
import { useCurrencyRates } from '~/composables/useCurrencyRates';
import { useProjectOptions } from '~/composables/useProjectOptions';
import ResourceTableSection from '~/components/projects/ResourceTableSection.vue';
import type { ResourceItem } from '~/components/projects/ResourceTableSection.vue';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchProject, createProject, updateProject } = useProjects();
const { exchangeRates, convertToKRW } = useCurrencyRates();

const title = '경상사업 예산 작성';
definePageMeta({
    title
});

/** 수정 모드의 사업 관리번호 (신규 등록 시 null) */
const projectId = route.query.id ? (route.query.id as string) : null;
/** 수정 모드 여부 (projectId 존재 시 true) */
const isEditMode = computed(() => !!projectId);

/** 폼 데이터 상태 (신규/수정 공통) */
const form = ref({
    prjNm: '',
    prjTp: '신규',
    prjBg: 0,
    prjSts: '예산 작성',
    prjDes: '',
    saf: '',    // 현황
    ncs: '',    // 필요성
    edrt: '',   // 전결권 (자동계산)
    prjYy: new Date().getMonth() + 1 >= 10 ? new Date().getFullYear() + 1 : new Date().getFullYear(), // 사업연도
    resourceItems: [] as ResourceItem[] // UI용 소요자원 상세내용
});

/**
 * 사업연도(prjYy) 선택지 옵션 생성 (현재 연도 기준: 작년, 올해, 내년)
 */
const { yearOptions, prjTypeOptions } = useProjectOptions();

const currencyOptions = computed(() => Object.keys(exchangeRates.value));
const statusOptions = PROJECT_STAGES;

/**
 * 소요자원 합계 계산
 * resourceItems의 gclAmt 합계로 총 소요예산을 자동 계산합니다.
 */
const totalBudget = computed(() => {
    return form.value.resourceItems.reduce((sum, item) => {
        // 외화 품목은 환율 적용하여 원화로 변환
        if (item.currency && item.currency !== 'KRW') {
            const rate = item.xcr || exchangeRates.value[item.currency] || 1;
            return sum + (item.gclAmt * rate);
        }
        return sum + (item.gclAmt || 0);
    }, 0);
});

/**
 * 자본예산(개발비/기계장치/기타무형자산) 합계
 */
const capitalBudget = computed(() => {
    const capitalCategories = ['개발비', '기계장치', '기타무형자산'];
    return form.value.resourceItems
        .filter(item => capitalCategories.some(c => item.category.startsWith(c)))
        .reduce((sum, item) => {
            const rate = (item.currency && item.currency !== 'KRW')
                ? (item.xcr || exchangeRates.value[item.currency] || 1) : 1;
            return sum + (item.gclAmt * rate);
        }, 0);
});

/**
 * 일반관리비(전산임차료/전산제비) 합계
 */
const operatingExpense = computed(() => {
    const opCategories = ['전산임차료', '전산제비'];
    return form.value.resourceItems
        .filter(item => opCategories.some(c => item.category.startsWith(c)))
        .reduce((sum, item) => {
            const rate = (item.currency && item.currency !== 'KRW')
                ? (item.xcr || exchangeRates.value[item.currency] || 1) : 1;
            return sum + (item.gclAmt * rate);
        }, 0);
});

/**
 * 소요자원 변경 시 총 예산 및 전결권 자동 계산
 */
watch(() => form.value.resourceItems, () => {
    form.value.prjBg = Math.round(totalBudget.value);
    form.value.edrt = getApprovalAuthority(capitalBudget.value, operatingExpense.value);
}, { deep: true });

/**
 * 수정 모드 초기 데이터 로드
 */
onMounted(async () => {
    if (isEditMode.value && projectId) {
        try {
            const { data, error } = await fetchProject(projectId);
            if (data.value) {
                const project = data.value;

                /* API 응답의 items를 UI resourceItems 모델로 변환 */
                const mappedItems = (project.items || []).map((item: any) => {
                    const parts = (item.gclDtt || '').split(' > ');
                    const mainCat = parts[0] || '';
                    const subCat = parts[1] || '';
                    return {
                        category: mainCat,
                        subCategory: subCat,
                        item: item.gclNm,
                        quantity: item.gclQtt,
                        currency: item.cur,
                        basis: item.bgFdtn,
                        introDate: item.itdDt ? new Date(item.itdDt) : null,
                        paymentCycle: item.dfrCle,
                        infoProtection: item.infPrtYn,
                        integratedInfra: item.itrInfrYn,
                        gclAmt: item.gclAmt || 0,
                        xcr: item.xcr
                    };
                });

                /* API 응답을 폼에 병합 */
                form.value = {
                    ...form.value,
                    ...project,
                    resourceItems: mappedItems
                };
            } else if (error.value) {
                console.error('Failed to load project', error.value);
                confirm.require({
                    message: '사업 정보를 불러오는데 실패했습니다.',
                    header: '오류',
                    icon: 'pi pi-exclamation-circle',
                    acceptLabel: '확인',
                    accept: () => { router.push('/info/projects/ordinary'); }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
});

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환
 */
const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0]!;
};

/**
 * 실제 저장 로직 (신규/수정 공통)
 * ornYn='Y'를 항상 포함하여 경상사업임을 구분합니다.
 */
const executeSave = async () => {
    /* 1. UI의 resourceItems를 API 스펙인 items로 역변환 */
    const items = form.value.resourceItems.map(item => ({
        gclDtt: item.subCategory ? `${item.category} > ${item.subCategory}` : item.category,
        gclNm: item.item,
        gclQtt: item.quantity,
        cur: item.currency,
        bgFdtn: item.basis,
        itdDt: formatDate(item.introDate),
        dfrCle: item.paymentCycle,
        infPrtYn: item.infoProtection,
        itrInfrYn: item.integratedInfra,
        upr: item.quantity > 0 && item.gclAmt > 0 ? Math.round(item.gclAmt / item.quantity) : 0,
        gclAmt: item.gclAmt,
        gclMngNo: null as string | null,
        gclSno: 0,
        xcr: exchangeRates.value[item.currency] || 1,
        xcrBseDt: formatDate(new Date()),
        lstYn: 'Y'
    }));

    /* 2. 전체 Payload 구성 - ornYn='Y' 고정 (경상사업 구분자) */
    const payload = {
        ...form.value,
        prjMngNo: projectId,
        ornYn: 'Y', // 경상사업 구분자 고정
        items: items
    };

    try {
        if (isEditMode.value && projectId) {
            await updateProject(projectId, payload);
        } else {
            await createProject(payload);
        }

        /* 저장 완료 확인 다이얼로그 */
        confirm.require({
            message: isEditMode.value ? '수정되었습니다.' : '등록되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/projects/ordinary');
            }
        });
    } catch (e) {
        console.error(e);
        confirm.require({
            message: '저장 중 오류가 발생했습니다.',
            header: '오류',
            icon: 'pi pi-exclamation-circle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인',
        });
    }
};

/**
 * 저장 확인 다이얼로그
 */
const handleSave = () => {
    confirm.require({
        message: isEditMode.value ? '수정하시겠습니까?' : '등록하시겠습니까?',
        header: '확인',
        icon: 'pi pi-question-circle',
        acceptLabel: '확인',
        rejectLabel: '취소',
        accept: executeSave
    });
};

</script>

<template>
    <div class="space-y-3">

        <!-- 상단 고정(Sticky) 헤더 영역 -->
        <div class="sticky -top-6 z-20 -mt-6 -mx-6 px-6 py-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                {{ isEditMode ? '경상사업 예산 수정' : '경상사업 예산 작성' }}
                <!-- 수정 모드에서만 상태 변경 드롭다운을 헤더 영역에 노출 -->
                <div v-if="isEditMode" class="flex items-center gap-2 text-base font-normal">
                    <span class="text-zinc-500 text-sm">| 진행 상태 :</span>
                    <Select v-model="form.prjSts" :options="statusOptions" placeholder="상태 변경" class="w-48 !text-sm"
                        size="small" />
                </div>
            </h1>
            <div class="flex items-center gap-2">
                <Button label="취소" severity="secondary" @click="router.back()" class="!px-5 !rounded-lg" />
                <Button label="저장" severity="primary" @click="handleSave"
                    class="!px-5 !rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none shadow-md shadow-indigo-500/20" />
            </div>
        </div>

        <!-- 기본 정보 + 사업 내용 + 예산 정보 카드 -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3 max-w-[1440px] mx-auto w-full">

            <!-- 사업 개요 섹션 -->
            <div class="space-y-3">
                <h3 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                    사업 개요<span class="text-red-500">*</span>
                </h3>
                <!-- 사업연도 + 유형 + 사업명 -->
                <div class="flex gap-3">
                    <div class="flex flex-col gap-2">
                        <Select v-model="form.prjYy" :options="yearOptions" placeholder="연도 선택" class="w-32" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <Select v-model="form.prjTp" :options="prjTypeOptions" placeholder="유형 선택" class="w-32" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <InputText v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid />
                    </div>
                </div>
                <!-- 사업개요 -->
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업개요</label>
                    <Textarea v-model="form.prjDes" rows="4" placeholder="사업 개요를 입력하세요" fluid autoResize />
                </div>
                <!-- 현황 / 필요성 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">현황</label>
                        <Textarea v-model="form.saf" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">필요성</label>
                        <Textarea v-model="form.ncs" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 추진시기 및 소요예산 섹션 -->
            <div class="space-y-3">
                <div class="flex items-end gap-2">
                    <span class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">추진시기 및 소요예산<span
                            class="text-red-500">*</span></span>
                </div>
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            소요예산 (원)
                        </label>
                        <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR"
                            placeholder="자동 계산됨" fluid readonly inputClass="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">전결권</label>
                        <InputText v-model="form.edrt" readonly placeholder="자동 지정됨" fluid
                            class="bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                </div>
            </div>
        </div>

        <!-- 소요자원 상세내용 (공통 컴포넌트) -->
        <ResourceTableSection v-model="form.resourceItems" :currencyOptions="currencyOptions" />

        <!-- ConfirmDialog -->
        <ConfirmDialog />
    </div>
</template>

