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
  - 비목코드, 계약명, 계약구분, 계약상대처, 예산, 통화, 지급주기, 최초지급일, 담당자(직원조회), 사업코드, 유형, 구분
  - 담당부서·담당팀은 담당자 선택 시 자동입력 (입력폼에서 제거)
  - 행 추가 / 개별 행 삭제 버튼

[저장 로직]
  - itMngcNo 존재 시: updateCost (PUT) 호출
  - itMngcNo 없을 시: createCost (POST) 호출
  - fstDfrDt(Date 객체)는 YYYY-MM-01 문자열로 변환 후 전송
================================================================================
-->
<script setup lang="ts">
import { ref, onActivated } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useConfirm } from "primevue/useconfirm";
import { useCost, type ItCost } from '~/composables/useCost';
import { useAuth } from '~/composables/useAuth';
import CostFormTableSection from '~/components/cost/CostFormTableSection.vue';

const route = useRoute();
const router = useRouter();
const confirm = useConfirm();
const { removeTab } = useTabs();
const { fetchCostOnce, createCost, updateCost, fetchCostsBulk } = useCost();
const { user } = useAuth();

/* ── 공통코드 옵션 로드 ──────────────────────────────────── */
interface CodeOption { cdId: string; cdNm: string; }

const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();
const CCODEM_BASE = `${config.public.apiBase}/api/ccodem/type`;

/** 비목코드 옵션 (IOE_LEAFE · IOE_XPN · IOE_SEVS · IOE_IDR 병합) */
const ioeCOptions = ref<CodeOption[]>([]);
/** 구분 옵션 (PUL_DTT) */
const pulDttOptions = ref<CodeOption[]>([]);
/** 지급주기 옵션 (DFR_CLE) */
const dfrCleOptions = ref<CodeOption[]>([]);
/** 사업코드 옵션 (ABUS_C) */
const abusCOptions = ref<CodeOption[]>([]);

const title = '전산업무비 신청/수정';
definePageMeta({
    title,
    middleware: ['budget-period']
});

/** 현재 편집 중인 전산업무비 항목 목록 */
const costs = ref<ItCost[]>([]);

/** 현재 로그인 사용자의 부서/팀 정보 (신규 행 자동입력용) */
const currentUserDetail = ref<{ bbrC: string; bbrNm: string; temC: string; temNm: string } | null>(null);

/**
 * 초기 데이터 로드
 * 쿼리 파라미터(id/ids)에 따라 적절한 API를 호출합니다.
 *
 * - id가 있으면 단건 조회 후 rows에 추가
 * - ids가 있으면 복수 조회(Bulk) 후 rows에 추가
 * - 둘 다 없으면 빈 행 1개 추가 (신규 등록)
 */
onActivated(async () => {
    /* 공통코드 + 현재 사용자 상세정보 병렬 로드 */
    try {
        const userEno = user.value?.eno ?? '';
        const userBase = `${config.public.apiBase}/api/users`;
        const [ioeLeafe, ioeXpn, ioeSevs, ioeIdr, pulDttList, dfrCleList, abusCList, userDetail] = await Promise.all([
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_LEAFE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_XPN`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_SEVS`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/IOE_IDR`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/PUL_DTT`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/DFR_CLE`),
            $apiFetch<CodeOption[]>(`${CCODEM_BASE}/ABUS_C`),
            userEno ? $apiFetch<{ bbrC: string; bbrNm: string; temC: string; temNm: string }>(`${userBase}/${userEno}`) : Promise.resolve(null),
        ]);
        ioeCOptions.value   = [...ioeLeafe, ...ioeXpn, ...ioeSevs, ...ioeIdr];
        pulDttOptions.value = pulDttList;
        dfrCleOptions.value = dfrCleList;
        abusCOptions.value  = abusCList;
        if (userDetail) currentUserDetail.value = userDetail;
    } catch (e) {
        console.error('초기 데이터 로드 실패', e);
    }

    /* 재활성화 시 이전 데이터 초기화 (KeepAlive로 이전 데이터 잔존 방지) */
    costs.value = [];

    const id = route.query.id as string;
    const ids = route.query.ids as string;

    if (id) {
        /* 단건 수정 모드: 지정된 관리번호 1건 로드 */
        try {
            const costData = await fetchCostOnce(id);
            if (costData) {
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
 * 담당자·담당부서·담당팀은 현재 로그인 사용자 정보로 자동입력됩니다.
 */
const addCostRow = () => {
    costs.value.push({
        ioeC: '',
        cttNm: '',
        cttOpp: '',
        itMngcBg: 0,
        dfrCle: '',
        fstDfrDt: '',
        cur: 'KRW',
        xcr: 0,
        xcrBseDt: '',
        infPrtYn: 'N',
        indRsn: '',
        /* 담당자: 현재 로그인 사용자로 자동입력 */
        cgpr: user.value?.eno ?? '',
        cgprNm: user.value?.empNm ?? '',
        biceDpm: currentUserDetail.value?.bbrC ?? user.value?.bbrC ?? '',
        biceDpmNm: currentUserDetail.value?.bbrNm ?? '',
        biceTem: currentUserDetail.value?.temC ?? user.value?.temC ?? '',
        biceTemNm: currentUserDetail.value?.temNm ?? '',
        abusC: '',
        itMngcTp: 'IT_MNGC_TP_001',
        pulDtt: '',
        assetBg: 0,
        apfSts: '예산 작성',
        lstYn: 'Y',
        delYn: 'N'
    });
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
        if (!cost.ioeC) {
            alert('비목코드를 입력해주세요.');
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
            accept: async () => {
                await router.push('/info/cost');
                removeTab('/info/cost/form');
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

        <!-- 인라인 편집 DataTable (CostFormTableSection 컴포넌트) -->
        <div class="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CostFormTableSection
                v-model="costs"
                :ioe-c-options="ioeCOptions"
                :pul-dtt-options="pulDttOptions"
                :dfr-cle-options="dfrCleOptions"
                :abus-c-options="abusCOptions"
                :show-delete-column="true"
            />
        </div>
    </div>
</template>
