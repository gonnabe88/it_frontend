<!--
================================================================================
[components/council/CouncilStatusBadge.vue] 협의회 진행상태 뱃지 컴포넌트
================================================================================
협의회의 진행상태(CouncilStatus)를 PrimeVue Tag로 표출하는 공통 컴포넌트입니다.
index.vue 사업목록 카드와 각 상세 페이지 헤더에서 공통으로 사용합니다.

[상태 → 색상 매핑]
  DRAFT            → kdb-tag-gray   (작성 중)
  SUBMITTED        → kdb-tag-yellow (작성 완료)
  APPROVAL_PENDING → kdb-tag-blue   (결재 대기)
  APPROVED         → kdb-tag-teal   (결재 완료)
  PREPARING        → kdb-tag-indigo (개최 준비)
  SCHEDULED        → kdb-tag-purple (일정 확정)
  IN_PROGRESS      → kdb-tag-orange (협의회 진행 중)
  EVALUATING       → kdb-tag-pink   (평가의견 작성 중)
  RESULT_WRITING   → kdb-tag-cyan   (결과서 작성 중)
  RESULT_REVIEW    → kdb-tag-rose   (결과서 검토 중)
  FINAL_APPROVAL   → kdb-tag-blue   (결과보고 결재 중)
  COMPLETED        → kdb-tag-green  (완료)

[Props]
  status  : 협의회 상태 코드 (CouncilStatus)
  size    : 태그 크기 ('sm' | 'md') — 기본값 'md'
================================================================================
-->
<script setup lang="ts">
import { computed } from 'vue';
import { getCouncilTagClass } from '~/utils/common';
import type { CouncilStatus } from '~/types/council';

interface Props {
    /** 협의회 진행상태 코드 */
    status: CouncilStatus | string;
    /** 태그 크기 ('sm': 소형, 'md': 일반) */
    size?: 'sm' | 'md';
}

const props = withDefaults(defineProps<Props>(), {
    size: 'md',
});

/** CCODEM 기반 코드 변환 */
const { getStatusLabel } = useCouncilCodes();

/** 상태 코드 → 한글 레이블 (CCODEM 조회) */
const label = computed(() => getStatusLabel(props.status));

/** 상태 코드 → CSS 클래스 */
const tagClass = computed(() => getCouncilTagClass(props.status));

/** 크기에 따른 추가 CSS 클래스 */
const sizeClass = computed(() => props.size === 'sm' ? 'text-xs py-0.5 px-2' : '');
</script>

<template>
    <!--
        협의회 진행상태 Tag
        - PrimeVue Tag 컴포넌트 기반
        - kdb-tag-* 커스텀 색상 클래스 적용
        - size 'sm'인 경우 텍스트/패딩 축소
    -->
    <Tag
        :value="label"
        :class="[tagClass, sizeClass]"
    />
</template>
