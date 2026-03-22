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

/**
 * 소요자원 항목 인터페이스 (UI 모델)
 */
interface ResourceItem {
    category: string;        // 품목구분 대분류 (API: gclDtt 앞부분)
    subCategory: string;     // 품목구분 소분류 (API: gclDtt 뒷부분)
    item: string;            // 품목명 (API: gclNm)
    quantity: number;        // 수량 (API: gclQtt)
    currency: string;        // 통화 (API: cur)
    basis: string;           // 예산산출근거 (API: bgFdtn)
    introDate: Date | null;  // 도입시기 (API: itdDt)
    paymentCycle: string;    // 지급주기 (API: dfrCle)
    infoProtection: string;  // 정보보호여부 (API: infPrtYn)
    integratedInfra: string; // 통합인프라여부 (API: itrInfrYn)
    gclAmt: number;          // 소계 (API: gclAmt)
    unitPrice?: number;      // 단가 (UI 계산 필드: gclAmt ÷ quantity)
    xcr?: number;            // 환율 (API: xcr, 수정 모드에서 복원)
}

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
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

/* ── 드롭다운 선택지 옵션 ── */
const resourceCategoryOptions = ['개발비', '기계장치', '기타무형자산', '전산용역비', '전산임차료', '전산제비'];

/**
 * 2단계 선택이 필요한 구분별 소분류 옵션 맵
 */
const resourceSubCategoryMap: Record<string, string[]> = {
    '개발비': ['일반', '감리/컨설팅'],
    '기타무형자산': ['일반', 'SW라이선스'],
    '전산용역비': ['외주(운영,관제 등)', '자문/심사'],
};

/* ── 구분 cascading dropdown 상태 ── */
const activeCatDropdownIndex = ref<number | null>(null);
const hoveredMainCategory = ref<string>('');
const catDropdownPos = ref({ top: 0, bottom: 0, left: 0, width: 0, openUpward: false });

/**
 * 구분 드롭다운 열기
 */
const openCatDropdown = (index: number, event: MouseEvent) => {
    const btn = event.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const estimatedHeight = resourceCategoryOptions.length * 34 + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < estimatedHeight + 8;
    catDropdownPos.value = {
        top: rect.bottom + 4,
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: Math.max(rect.width, 140),
        openUpward,
    };
    activeCatDropdownIndex.value = activeCatDropdownIndex.value === index ? null : index;
    hoveredMainCategory.value = '';
};

/** 구분 드롭다운 닫기 */
const closeCatDropdown = () => {
    activeCatDropdownIndex.value = null;
    hoveredMainCategory.value = '';
};

/**
 * 대분류 항목 클릭 처리
 */
const selectMainCat = (rowData: ResourceItem, cat: string) => {
    if (resourceSubCategoryMap[cat]) return;
    rowData.category = cat;
    rowData.subCategory = '';
    closeCatDropdown();
};

/**
 * 소분류 항목 클릭 처리
 */
const selectSubCat = (rowData: ResourceItem, cat: string, sub: string) => {
    rowData.category = cat;
    rowData.subCategory = sub;
    closeCatDropdown();
};

const currencyOptions = computed(() => Object.keys(exchangeRates.value));
const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];
const prjTypeOptions = ['신규', '계속'];
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

    /* 단가 자동 계산: gclAmt ÷ quantity */
    form.value.resourceItems.forEach(item => {
        if (item.quantity > 0 && item.gclAmt > 0) {
            item.unitPrice = Math.round(item.gclAmt / item.quantity);
        } else {
            item.unitPrice = 0;
        }
    });
}, { deep: true });

/**
 * 소요자원 행 추가
 */
const addResourceItem = () => {
    form.value.resourceItems.push({
        category: '',
        subCategory: '',
        item: '',
        quantity: 1,
        currency: 'KRW',
        basis: '',
        introDate: null,
        paymentCycle: '월',
        infoProtection: 'N',
        integratedInfra: 'N',
        gclAmt: 0,
        unitPrice: 0,
    });
};

/**
 * 소요자원 행 삭제
 * @param index - 삭제할 행 인덱스
 */
const removeResourceItem = (index: number) => {
    form.value.resourceItems.splice(index, 1);
};

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
    <div class="space-y-6">

        <!-- 페이지 헤더 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{{ title }}</h1>
            <div class="flex items-center gap-2">
                <Button label="취소" icon="pi pi-times" severity="secondary" outlined @click="router.back()" />
                <Button label="저장" icon="pi pi-save" @click="handleSave" />
            </div>
        </div>

        <!-- 폼 카드 -->
        <div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-8">

            <!-- 섹션 1: 기본 정보 -->
            <section>
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                    기본 정보
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

                    <!-- 사업연도 -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업연도 <span class="text-red-500">*</span></label>
                        <Select v-model="form.prjYy" :options="yearOptions" placeholder="사업연도 선택" fluid />
                    </div>

                    <!-- 프로젝트유형 -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">유형 <span class="text-red-500">*</span></label>
                        <Select v-model="form.prjTp" :options="prjTypeOptions" placeholder="유형 선택" fluid />
                    </div>

                    <!-- 사업현황 (수정 모드에서만 표시) -->
                    <div v-if="isEditMode" class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업현황</label>
                        <Select v-model="form.prjSts" :options="statusOptions" placeholder="상태 선택" fluid />
                    </div>
                </div>

                <!-- 사업명 -->
                <div class="flex flex-col gap-1 mt-4">
                    <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업명 <span class="text-red-500">*</span></label>
                    <InputText v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid />
                </div>
            </section>

            <!-- 섹션 2: 사업 내용 -->
            <section>
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                    사업 내용
                </h2>
                <div class="flex flex-col gap-4">

                    <!-- 사업개요 -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">사업개요</label>
                        <Textarea v-model="form.prjDes" rows="4" placeholder="사업 개요를 입력하세요" fluid autoResize />
                    </div>

                    <!-- 현황 -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">현황</label>
                        <Textarea v-model="form.saf" rows="4" placeholder="현재 현황을 입력하세요" fluid autoResize />
                    </div>

                    <!-- 필요성 -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">필요성</label>
                        <Textarea v-model="form.ncs" rows="4" placeholder="사업 필요성을 입력하세요" fluid autoResize />
                    </div>
                </div>
            </section>

            <!-- 섹션 3: 예산 정보 -->
            <section>
                <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                    예산 정보
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <!-- 소요예산 (자동계산) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            소요예산
                            <span class="text-xs text-zinc-400 ml-1">(소요자원 합계 자동계산)</span>
                        </label>
                        <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR"
                            :minFractionDigits="0" fluid readonly
                            class="bg-zinc-50 dark:bg-zinc-800" />
                    </div>

                    <!-- 전결권 (자동계산) -->
                    <div class="flex flex-col gap-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            전결권
                            <span class="text-xs text-zinc-400 ml-1">(예산 기준 자동산정)</span>
                        </label>
                        <InputText v-model="form.edrt" placeholder="자동 계산됩니다" readonly
                            class="bg-zinc-50 dark:bg-zinc-800" fluid />
                    </div>
                </div>
            </section>

            <!-- 섹션 4: 소요자원 상세내용 -->
            <section>
                <div class="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                    <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">소요자원 상세내용</h2>
                    <Button label="행 추가" icon="pi pi-plus" size="small" severity="secondary" outlined
                        @click="addResourceItem" />
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[130px]">구분</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[150px]">품목명</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[80px]">수량</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[90px]">통화</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[120px]">단가</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[120px]">소계</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[150px]">예산산출근거</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[110px]">도입시기</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[90px]">지급주기</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[80px]">정보보호</th>
                                <th class="p-2 text-left border border-zinc-200 dark:border-zinc-700 min-w-[80px]">통합인프라</th>
                                <th class="p-2 text-center border border-zinc-200 dark:border-zinc-700 w-12">삭제</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="form.resourceItems.length === 0">
                                <td colspan="12"
                                    class="p-4 text-center text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                    소요자원 항목이 없습니다. "행 추가" 버튼을 눌러 항목을 추가하세요.
                                </td>
                            </tr>
                            <tr v-for="(item, index) in form.resourceItems" :key="index"
                                class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">

                                <!-- 구분 (cascading dropdown) -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700 relative">
                                    <button type="button" @click="openCatDropdown(index, $event)"
                                        class="w-full text-left px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm hover:border-indigo-400 transition-colors">
                                        {{ item.subCategory
                                            ? `${item.category} > ${item.subCategory}`
                                            : (item.category || '선택') }}
                                    </button>
                                </td>

                                <!-- 품목명 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <InputText v-model="item.item" placeholder="품목명" class="w-full text-sm" />
                                </td>

                                <!-- 수량 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <InputNumber v-model="item.quantity" :min="1" class="w-full text-sm" />
                                </td>

                                <!-- 통화 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <Select v-model="item.currency" :options="currencyOptions" class="w-full text-sm" />
                                </td>

                                <!-- 단가 (자동계산) -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <InputNumber :modelValue="item.unitPrice" :minFractionDigits="0" readonly
                                        class="w-full text-sm bg-zinc-50 dark:bg-zinc-800" />
                                </td>

                                <!-- 소계 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <InputNumber v-model="item.gclAmt" :minFractionDigits="0" class="w-full text-sm" />
                                </td>

                                <!-- 예산산출근거 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <InputText v-model="item.basis" placeholder="산출근거" class="w-full text-sm" />
                                </td>

                                <!-- 도입시기 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <DatePicker v-model="item.introDate" dateFormat="yy-mm" view="month" showIcon
                                        class="w-full text-sm" />
                                </td>

                                <!-- 지급주기 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <Select v-model="item.paymentCycle" :options="paymentCycleOptions"
                                        class="w-full text-sm" />
                                </td>

                                <!-- 정보보호여부 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <Select v-model="item.infoProtection" :options="ynOptions"
                                        class="w-full text-sm" />
                                </td>

                                <!-- 통합인프라여부 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700">
                                    <Select v-model="item.integratedInfra" :options="ynOptions"
                                        class="w-full text-sm" />
                                </td>

                                <!-- 행 삭제 -->
                                <td class="p-1 border border-zinc-200 dark:border-zinc-700 text-center">
                                    <Button icon="pi pi-trash" text rounded severity="danger" size="small"
                                        @click="removeResourceItem(index)" />
                                </td>
                            </tr>

                            <!-- 합계 행 -->
                            <tr v-if="form.resourceItems.length > 0"
                                class="bg-zinc-50 dark:bg-zinc-800 font-semibold">
                                <td colspan="5" class="p-2 border border-zinc-200 dark:border-zinc-700 text-right">합계</td>
                                <td class="p-2 border border-zinc-200 dark:border-zinc-700">
                                    {{ totalBudget.toLocaleString() }} 원
                                </td>
                                <td colspan="6" class="p-2 border border-zinc-200 dark:border-zinc-700"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>

        <!-- Cascading 드롭다운 (Teleport → body에 렌더링) -->
        <Teleport to="body">
            <div v-if="activeCatDropdownIndex !== null" @click.self="closeCatDropdown"
                class="fixed inset-0 z-40" style="background: transparent;">
                <div class="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1"
                    :style="{
                        top: catDropdownPos.openUpward ? 'auto' : `${catDropdownPos.top}px`,
                        bottom: catDropdownPos.openUpward ? `${catDropdownPos.bottom}px` : 'auto',
                        left: `${catDropdownPos.left}px`,
                        minWidth: `${catDropdownPos.width}px`,
                    }">
                    <div v-for="cat in resourceCategoryOptions" :key="cat" class="relative group">
                        <button type="button"
                            @click="selectMainCat(form.resourceItems[activeCatDropdownIndex!]!, cat)"
                            @mouseenter="hoveredMainCategory = cat"
                            class="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center justify-between"
                            :class="{ 'cursor-default text-zinc-500': !!resourceSubCategoryMap[cat] }">
                            <span>{{ cat }}</span>
                            <span v-if="resourceSubCategoryMap[cat]" class="text-zinc-400 ml-4">▶</span>
                        </button>
                        <!-- 소분류 flyout -->
                        <div v-if="resourceSubCategoryMap[cat] && hoveredMainCategory === cat"
                            class="absolute left-full top-0 ml-0.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px] z-50">
                            <button v-for="sub in resourceSubCategoryMap[cat]" :key="sub" type="button"
                                @click="selectSubCat(form.resourceItems[activeCatDropdownIndex!]!, cat, sub)"
                                class="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                                {{ sub }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Teleport>

        <!-- ConfirmDialog -->
        <ConfirmDialog />
    </div>
</template>
