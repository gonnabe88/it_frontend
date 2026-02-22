<!--
================================================================================
[pages/info/projects/form.vue] 정보화사업 등록/수정 폼 페이지
================================================================================
신규 정보화사업을 등록하거나 기존 사업을 수정하는 입력 폼입니다.
쿼리 파라미터 ?id가 있으면 수정 모드, 없으면 신규 등록 모드로 동작합니다.

[동작 모드]
  - 신규 등록: ?id 없음 → 빈 폼으로 시작
  - 수정 모드: ?id=prjMngNo → 해당 사업 정보 API 로드 후 폼에 바인딩

[폼 섹션 구성]
  1. 사업명: 유형(신규/계속) + 상태(수정 모드만 표시) + 사업명 텍스트
  2. 사업 개요: RichEditor 설명 + 현황/필요성/기대효과/미추진시문제점 Textarea (4개)
  3. 사업 범위: RichEditor (전산 요구사항)
  4. 진행 상황: 추진 경과 / 향후 계획 Textarea (2개)
  5. 사업 구분: 업무구분/사업유형/기술유형/주요사용자
  6. 편성 기준: 중복여부(Y/N) / 법규상 완료시기 DatePicker
  7. 담당부서: 주관부문 → 주관부서(팀장/담당자) → IT부서(팀장/담당자)
  8. 추진시기 및 소요예산: 예산/전결권/보고상태 + 시작일/종료일/추진가능성
  9. 소요자원 상세내용: DataTable 인라인 편집 (행 추가/삭제)

[소요자원 데이터 변환]
  - 로드 시: API 응답 items → UI resourceItems 변환
    (gclDtt → category, gclNm → item, gclQtt → quantity 등)
  - 저장 시: UI resourceItems → API items 역변환
    (category → gclDtt, item → gclNm 등)
  - fstDfrDt, sttDt, endDt, lblFsgTlm: Date 객체 → YYYY-MM-DD 문자열 변환

[단가 자동 계산]
  - watch(resourceItems): gclAmt(소계) ÷ quantity(수량)으로 unitPrice 자동 계산
  - gclAmt나 quantity가 0이면 unitPrice = 0

[라우팅]
  - 접근(신규): /info/projects/form
  - 접근(수정): /info/projects/form?id=:prjMngNo
  - 저장 완료 후: /info/projects
  - 취소 시: router.back()
================================================================================
-->
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useConfirm } from "primevue/useconfirm";
import { useRouter, useRoute } from 'vue-router'; // Ensure useRouter and useRoute are imported
import { useProjects } from '~/composables/useProjects'; // Assuming useProjects is in composables

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { fetchProject, createProject, updateProject } = useProjects();

const title = '사업정보 입력';
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
    svnDpm: '',
    itDpm: '',
    prjBg: 0,
    prjSts: '예산 신청',
    sttDt: null as Date | null,
    endDt: null as Date | null,
    prjDes: '',
    pulRsn: '', // 추진사유
    xptEff: '', // 기대효과
    svnHdq: '', // 주관부문

    // 추가 상세 필드
    bzDtt: '', // 업무구분
    dplYn: 'N', // 중복여부
    edrt: '', // 전결권
    hrfPln: '', // 향후계획
    itDpmCgpr: '', // 정보전략팀 담당자
    itDpmTlr: '', // IT팀장
    lblFsgTlm: null as Date | null, // 의무완료기한
    mnUsr: '', // 주요사용자
    ncs: '', // 필요성
    plm: '', // 미추진 시 문제점
    prjPulPtt: '', // 프로젝트추진가능성
    prjRng: '', // 사업범위
    pulPsg: '', // 추진경과
    rprSts: '', // 보고상태
    saf: '', // 현황
    svnDpmCgpr: '', // 주관부서 담당자
    svnDpmTlr: '', // 주관부서 팀장
    tchnTp: '', // 기술유형
    resourceItems: [] as any[] // UI용 소요자원 상세내용 (저장 시 items로 변환)
});

/* ── 드롭다운 선택지 옵션 ── */
const resourceCategoryOptions = ['개발비', '기계장치', '기타무형자산', '전산임차료', '전산제비'];
const currencyOptions = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];
const paymentCycleOptions = ['월', '분기', '반기', '년'];
const ynOptions = ['Y', 'N'];

const prjTypeOptions = ['신규', '계속'];
const statusOptions = ['예산 신청', '사전 협의', '정실협', '요건 상세화', '소요예산 산정', '과심위', '입찰/계약', '사업 추진', '대금지급', '성과평가', '완료'];

/* ── 부서 목록 (Mock 데이터 - 향후 API 연결 예정) ── */
const majorHdqs = ['글로벌사업부문', '경영지원부문', 'IT운영부문', '정보보호부문', '디지털혁신부문'];
const majorDepartments = ['글로벌사업부', '경영지원부', 'IT운영부', '정보보호부', '디지털혁신부'];
const itDepartments = ['정보전략팀', '경영지원팀', 'IT운영팀', '정보보호팀', '디지털혁신팀', 'CS팀'];

/**
 * 수정 모드 초기 데이터 로드
 * isEditMode가 true이면 fetchProject API를 호출하여 폼 데이터를 채웁니다.
 * API 응답의 items를 UI 모델인 resourceItems로 변환합니다.
 */
onMounted(async () => {
    if (isEditMode.value && projectId) {
        try {
            const { data, error } = await fetchProject(projectId);
            if (data.value) {
                const project = data.value;

                /* API 응답의 items를 UI resourceItems 모델로 변환 */
                const mappedItems = (project.items || []).map((item: any) => ({
                    category: item.gclDtt, // 품목구분
                    item: item.gclNm, // 품목명
                    quantity: item.gclQtt, // 수량
                    currency: item.cur, // 통화
                    basis: item.bgFdtn, // 예산산출근거
                    introDate: item.itdDt ? new Date(item.itdDt) : null, // 도입시기 (Date 변환)
                    paymentCycle: item.dfrCle, // 지급주기
                    infoProtection: item.infPrtYn, // 정보보호여부
                    integratedInfra: item.itrInfrYn, // 통합인프라여부

                    /* UI 계산 필드 복원 */
                    unitPrice: item.upr || 0, // 단가
                    gclAmt: item.gclAmt || 0, // 소계
                }));

                /* API 응답을 폼에 병합 (날짜 필드는 Date 객체로 변환) */
                form.value = {
                    ...form.value,
                    ...project,
                    sttDt: project.sttDt ? new Date(project.sttDt) : null,
                    endDt: project.endDt ? new Date(project.endDt) : null,
                    lblFsgTlm: project.lblFsgTlm ? new Date(project.lblFsgTlm) : null,
                    resourceItems: mappedItems
                };
            } else if (error.value) {
                console.error('Failed to load project', error.value);
                confirm.require({
                    message: '사업 정보를 불러오는데 실패했습니다.',
                    header: '오류',
                    icon: 'pi pi-exclamation-circle',
                    acceptLabel: '확인',
                    accept: () => { router.push('/info/projects'); }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }
});

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환
 * 타임존 오프셋을 보정하여 로컬 날짜 기준으로 변환합니다.
 *
 * @param date - 변환할 Date 객체 (null이면 빈 문자열 반환)
 * @returns 'YYYY-MM-DD' 형식의 문자열
 */
const formatDate = (date: Date | null): string => {
    if (!date) return '';
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().split('T')[0]!;
};

/**
 * 실제 저장 로직 (신규/수정 공통)
 *
 * [처리 순서]
 * 1. UI resourceItems → API 스펙 items 변환 (필드명 역매핑)
 * 2. 날짜 필드를 문자열로 변환하여 payload 구성
 * 3. isEditMode에 따라 updateProject 또는 createProject 호출
 * 4. 성공/실패 시 confirm 다이얼로그 표시
 */
const executeSave = async () => {
    /* 1. UI의 resourceItems를 API 스펙인 items로 역변환 */
    const items = form.value.resourceItems.map(item => ({
        gclDtt: item.category, // 품목구분
        gclNm: item.item, // 품목명
        gclQtt: item.quantity, // 수량
        cur: item.currency, // 통화
        bgFdtn: item.basis, // 예산산출근거
        itdDt: formatDate(item.introDate), // 도입시기 (날짜 문자열 변환)
        dfrCle: item.paymentCycle, // 지급주기
        infPrtYn: item.infoProtection, // 정보보호여부 (Y/N)
        itrInfrYn: item.integratedInfra, // 통합인프라여부 (Y/N)

        /* UI 계산 필드 */
        upr: item.unitPrice, // 단가
        gclAmt: item.gclAmt, // 소계

        /* API 필수 기본값 설정 */
        gclMngNo: null as string | null, // 신규 시 null
        gclSno: 0,
        xcr: 0,
        xcrBseDt: formatDate(new Date()), // 현재 날짜 기준
        lstYn: 'Y' // 최종여부 기본값
    }));

    /* 2. 전체 Payload 구성 */
    const payload = {
        ...form.value,
        prjMngNo: projectId,
        sttDt: formatDate(form.value.sttDt),
        endDt: formatDate(form.value.endDt),
        lblFsgTlm: formatDate(form.value.lblFsgTlm),
        items: items // 역변환된 소요자원 목록
    };

    /* 불필요한 UI용 resourceItems 필드는 백엔드에서 무시됨 */

    try {
        let response;
        if (isEditMode.value && projectId) {
            response = await updateProject(projectId, payload);
        } else {
            response = await createProject(payload);
        }

        /* 저장 완료 확인 다이얼로그 */
        confirm.require({
            message: isEditMode.value ? '수정되었습니다.' : '등록되었습니다.',
            header: '완료',
            icon: 'pi pi-check',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인',
            accept: () => {
                router.push('/info/projects');
            }
        });
    } catch (error) {
        console.error('Save failed', error);
        confirm.require({
            message: '저장 중 오류가 발생했습니다.',
            header: '오류',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
    }
};

/**
 * 저장 진입점: 필수 유효성 검사 후 executeSave 호출
 * 사업명이 비어있으면 경고 다이얼로그를 표시하고 중단합니다.
 */
const saveProject = () => {
    if (!form.value.prjNm) {
        confirm.require({
            message: '사업명을 입력해주세요.',
            header: '입력 확인',
            icon: 'pi pi-exclamation-triangle',
            rejectProps: { class: 'hidden' },
            acceptLabel: '확인'
        });
        return;
    }
    executeSave();
};

/**
 * 소요자원 행 추가
 * 기본값으로 초기화된 빈 소요자원 항목을 resourceItems에 추가합니다.
 */
const addResourceRow = () => {
    form.value.resourceItems.push({
        category: '개발비',
        item: '',
        quantity: 0,
        unitPrice: 0,
        currency: 'KRW',
        gclAmt: 0,
        basis: '',
        introDate: null,
        paymentCycle: '',
        infoProtection: 'N',
        integratedInfra: 'N'
    });
};

/**
 * 소요자원 행 삭제
 * 지정된 인덱스의 항목을 resourceItems에서 제거합니다.
 *
 * @param index - 삭제할 행의 인덱스
 */
const removeResourceRow = (index: number) => {
    form.value.resourceItems.splice(index, 1);
};

/**
 * 소요자원 단가 자동 계산 감시자
 * gclAmt(소계) 또는 quantity(수량)가 변경되면 unitPrice = gclAmt ÷ quantity를 자동 계산합니다.
 * deep 감시로 중첩 필드 변경도 감지합니다.
 */
watch(() => form.value.resourceItems, (items) => {
    if (!items) return;
    items.forEach(item => {
        if (item.quantity > 0 && item.gclAmt > 0) {
            item.unitPrice = Math.round(item.gclAmt / item.quantity);
        } else {
            item.unitPrice = 0;
        }
    });
}, { deep: true });

/**
 * 취소 처리
 * 이전 페이지로 이동합니다.
 */
const cancel = () => {
    router.back();
};
</script>

<template>
    <div class="space-y-6">
        <!-- 페이지 헤더: 신규 등록 / 수정 모드에 따라 제목 변경 -->
        <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {{ isEditMode ? '사업 정보 수정' : '신규 사업 등록' }}
            </h1>
        </div>

        <div
            class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <h3 class="text-xl font-semibold">사업명</h3>

            <!-- 사업명 섹션: 유형 + 상태(수정 모드) + 사업명 -->
            <div class="flex gap-6">
                <!-- 수정 모드에서만 진행 상태 선택 표시 -->
                <div v-if="isEditMode" class="grid grid-cols gap-2">
                    <Select v-model="form.prjSts" :options="statusOptions" placeholder="상태 선택" class="w-80" />
                </div>
                <!-- 사업 유형 선택 (신규/계속) -->
                <div class="flex flex-col gap-2">
                    <Select v-model="form.prjTp" :options="prjTypeOptions" placeholder="유형 선택" class="w-40" />
                </div>
                <!-- 사업명 텍스트 입력 -->
                <div class="flex flex-col gap-2 flex-1">
                    <InputText v-model="form.prjNm" placeholder="사업명을 입력하세요" fluid />
                </div>
            </div>

            <Divider />

            <!-- 사업 개요 섹션 -->
            <div class="space-y-6">
                <h3 class="text-xl font-semibold">사업 개요</h3>
                <!-- Rich Text 사업 상세 설명 -->
                <div class="flex flex-col gap-2">
                    <RichEditor v-model="form.prjDes" editorStyle="height: 150px" placeholder="사업 상세 내용을 입력하세요." />
                </div>
                <!-- 현황 / 필요성 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">현황</label>
                        <Textarea v-model="form.saf" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">필요성</label>
                        <Textarea v-model="form.ncs" style="height: 150px;" />
                    </div>
                </div>
                <!-- 기대효과 / 미추진 시 문제점 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">기대효과</label>
                        <Textarea v-model="form.xptEff" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">미추진 시 문제점</label>
                        <Textarea v-model="form.plm" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 사업 범위 섹션 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">사업범위</span>
                    <span class="text-sm text-zinc-500">전산 요구사항</span>
                </div>
                <div class="flex flex-col gap-2">
                    <RichEditor v-model="form.prjRng" editorStyle="height: 150px" />
                </div>
            </div>

            <Divider />

            <!-- 진행 상황 섹션: 추진 경과 / 향후 계획 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">진행상황</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">추진 경과</label>
                        <Textarea v-model="form.pulPsg" style="height: 150px;" />
                    </div>
                    <div class="flex flex-col gap-2 col-span-1">
                        <label class="font-semibold">향후 계획</label>
                        <Textarea v-model="form.hrfPln" style="height: 150px;" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 사업 구분 섹션: 업무구분/사업유형/기술유형/주요사용자 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">사업구분</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">업무 구분</label>
                        <InputText v-model="form.bzDtt" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">사업 유형</label>
                        <InputText v-model="form.prjTp" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">기술 유형</label>
                        <InputText v-model="form.tchnTp" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주요 사용자</label>
                        <InputText v-model="form.mnUsr" fluid />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 편성 기준 섹션: 중복여부/법규상완료시기 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">편성기준</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">중복 여부 (Y/N)</label>
                        <Select v-model="form.dplYn" :options="['Y', 'N']" fluid />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">법규상 완료시기</label>
                        <DatePicker v-model="form.lblFsgTlm" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 담당부서 섹션: 주관부문 → 주관부서 → IT부서 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">담당부서</span>
                </div>

                <!-- 주관부문 선택 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주관부문</label>
                        <Select v-model="form.svnHdq" :options="majorHdqs" placeholder="주관부문 선택" editable
                            class="w-80" />
                    </div>
                </div>

                <!-- 주관부서 + 팀장/담당자 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">주관부서</label>
                        <Select v-model="form.svnDpm" :options="majorDepartments" placeholder="주관 부서 선택" editable
                            class="w-40" />
                    </div>
                    <div class="flex flex-col  gap-2 flex-1">
                        <label class="font-semibold">담당팀장</label>
                        <InputText v-model="form.svnDpmTlr" placeholder="이름" fluid />
                    </div>
                    <div class="flex flex-col  gap-2 flex-1">
                        <label class="font-semibold">담당자</label>
                        <InputText v-model="form.svnDpmCgpr" placeholder="이름" fluid />
                    </div>
                </div>

                <!-- IT부서 + 팀장/담당자 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2">
                        <label class="font-semibold">IT부서</label>
                        <Select v-model="form.itDpm" :options="itDepartments" placeholder="IT부서 선택" editable
                            class="w-40" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당팀장</label>
                        <InputText v-model="form.itDpmTlr" placeholder="이름" fluid />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">담당자</label>
                        <InputText v-model="form.itDpmCgpr" placeholder="이름" fluid />
                    </div>
                </div>
            </div>

            <Divider />

            <!-- 추진시기 및 소요예산 섹션 -->
            <div class="space-y-6">
                <div class="flex items-end gap-2">
                    <span class="text-xl font-semibold">추진시기 및 소요예산</span>
                </div>

                <!-- 예산/전결권/보고상태 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">예산 (원)</label>
                        <InputNumber v-model="form.prjBg" mode="currency" currency="KRW" locale="ko-KR"
                            placeholder="예산 입력" fluid />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">전결권</label>
                        <InputText v-model="form.edrt" fluid />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">보고상태</label>
                        <InputText v-model="form.rprSts" fluid />
                    </div>
                </div>

                <!-- 시작일/종료일/추진가능성 -->
                <div class="flex gap-6">
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">시작일</label>
                        <DatePicker v-model="form.sttDt" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">종료일</label>
                        <DatePicker v-model="form.endDt" showIcon fluid dateFormat="yy-mm-dd" />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="font-semibold">사업추진 가능성</label>
                        <InputText v-model="form.prjPulPtt" fluid />
                    </div>
                </div>

                <Divider />

                <!-- 소요자원 상세내용 DataTable -->
                <div
                    class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-semibold">소요자원 상세내용</h3>
                        <Button label="품목 추가" icon="pi pi-plus" size="small" @click="addResourceRow" />
                    </div>

                    <div class="overflow-x-auto">
                        <DataTable :value="form.resourceItems" resizableColumns columnResizeMode="fit" showGridlines
                            size="small" class="resource-table">
                            <template #empty>
                                <div class="text-center text-zinc-500 py-4">
                                    등록된 소요자원이 없습니다. 품목 추가 버튼을 눌러 등록해주세요.
                                </div>
                            </template>

                            <!-- 구분: 카테고리 드롭다운 -->
                            <Column header="구분" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 120px">
                                <template #body="{ data }">
                                    <Select v-model="data.category" :options="resourceCategoryOptions" placeholder="선택"
                                        class="w-full" />
                                </template>
                            </Column>

                            <!-- 항목: 자동 줄바꿈 Textarea -->
                            <Column header="항목" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 200px">
                                <template #body="{ data }">
                                    <Textarea v-model="data.item" rows="1" autoResize class="w-full" />
                                </template>
                            </Column>

                            <!-- 수량 -->
                            <Column header="수량" headerClass="text-center justify-center [&>div]:justify-center"
                                style="width: 80px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.quantity" :min="0" class="w-full" />
                                </template>
                            </Column>

                            <!-- 단가: gclAmt ÷ quantity 자동 계산 (읽기 전용) -->
                            <Column header="단가" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 120px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.unitPrice" mode="currency"
                                        :currency="data.currency || 'KRW'" locale="ko-KR" readonly
                                        class="w-full bg-zinc-100 dark:bg-zinc-800" />
                                </template>
                            </Column>

                            <!-- 통화: KRW/USD/EUR 등 -->
                            <Column header="통화" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 100px">
                                <template #body="{ data }">
                                    <Select v-model="data.currency" :options="currencyOptions" class="w-full" />
                                </template>
                            </Column>

                            <!-- 소계: 직접 입력 → 단가 자동 역산 -->
                            <Column header="소계" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 120px">
                                <template #body="{ data }">
                                    <InputNumber v-model="data.gclAmt" mode="currency"
                                        :currency="data.currency || 'KRW'" locale="ko-KR" class="w-full" />
                                </template>
                            </Column>

                            <!-- 산정근거 -->
                            <Column header="산정근거" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 200px">
                                <template #body="{ data }">
                                    <Textarea v-model="data.basis" rows="1" autoResize class="w-full" />
                                </template>
                            </Column>

                            <!-- 도입시기/지급주기: 구분에 따라 다른 입력 컴포넌트 표시 -->
                            <Column header="도입시기/지급주기" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 150px">
                                <template #body="{ data }">
                                    <!-- 자본예산: 도입시기 DatePicker (월 단위) -->
                                    <div v-if="['개발비', '기계장치', '기타무형자산'].includes(data.category)">
                                        <DatePicker v-model="data.introDate" view="month" dateFormat="yy-mm" showIcon
                                            fluid placeholder="도입시기" class="w-full" />
                                    </div>
                                    <!-- 임차료/제비: 지급주기 드롭다운 -->
                                    <div v-else-if="['전산임차료', '전산제비'].includes(data.category)">
                                        <Select v-model="data.paymentCycle" :options="paymentCycleOptions"
                                            placeholder="지급주기" class="w-full" />
                                    </div>
                                </template>
                            </Column>

                            <!-- 정보보호 여부 (Y/N) -->
                            <Column header="정보보호" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 80px">
                                <template #body="{ data }">
                                    <Select v-model="data.infoProtection" :options="ynOptions" class="w-full" />
                                </template>
                            </Column>

                            <!-- 통합인프라 여부 (Y/N) -->
                            <Column header="통합인프라" headerClass="text-center justify-center [&>div]:justify-center"
                                style="min-width: 80px">
                                <template #body="{ data }">
                                    <Select v-model="data.integratedInfra" :options="ynOptions" class="w-full" />
                                </template>
                            </Column>

                            <!-- 행 삭제 버튼 -->
                            <Column header="" headerClass="text-center justify-center [&>div]:justify-center"
                                style="width: 50px">
                                <template #body="{ index }">
                                    <Button icon="pi pi-trash" text severity="danger"
                                        @click="removeResourceRow(index)" />
                                </template>
                            </Column>
                        </DataTable>
                    </div>
                </div>

                <!-- 최종 액션 버튼: 취소 / 저장 -->
                <div class="flex justify-end gap-2 pt-4">
                    <Button label="취소" severity="secondary" @click="cancel" />
                    <Button label="저장" @click="saveProject" />
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/** 소요자원 테이블 헤더 배경색 (라이트/다크 모드) */
:deep(.resource-table .p-datatable-thead > tr > th) {
    background-color: #f4f4f5 !important;
    /* zinc-100 */
}

:deep(.dark .resource-table .p-datatable-thead > tr > th) {
    background-color: #27272a !important;
    /* zinc-800 */
}

/** 소요자원 테이블 헤더 콘텐츠 중앙 정렬 */
:deep(.resource-table .p-datatable-thead > tr > th .p-column-header-content) {
    justify-content: center;
}
</style>
