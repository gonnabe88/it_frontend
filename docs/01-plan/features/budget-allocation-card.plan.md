# 전산예산 카드 Planning Document

> **Summary**: `/info/plan/form` 계획 등록 화면의 '정보화사업' 카드 하단에 '전산예산' 카드를 추가. 비목별 편성 결과(`/budget/work` 참조)를 cell 병합 없는 5컬럼 테이블로 표시.
>
> **Project**: IT Portal System (IT 포털 시스템)
> **Version**: 1.0.0
> **Date**: 2026-05-05
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | `/info/plan/form` 미리보기에 정보화사업 현황은 있으나 비목별 전산예산 편성 현황(편성요청/조정/조정율/전년 비교)이 없어 계획 등록 시 예산 전체 그림 파악이 어렵다 |
| **Solution** | 미리보기 영역에 '전산예산' 카드를 추가하여 선택한 대상년도의 비목별 편성 결과를 5개 컬럼(편성요청·편성조정·조정율·26년 편성액·25년 편성액)으로 표시 |
| **Function/UX Effect** | 계획 등록 흐름에서 벗어나지 않고 당해/전년 편성 현황을 즉시 확인. cell 병합 없이 단순 평면 테이블로 정보 접근성 향상 |
| **Core Value** | 계획 등록 담당자가 전산예산 편성 맥락을 바탕으로 더 정확한 IT부문 계획을 수립할 수 있도록 지원 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 계획 등록 미리보기에서 비목별 전산예산 현황 부재 → 계획 수립 의사결정 지원 부족 |
| **WHO** | IT기획부 담당자 (정보기술부문 계획 등록자) |
| **RISK** | `/api/budget/work/summary` 해당 연도 데이터 없을 때 빈 카드 처리, 전년도 데이터 없을 때 '-' 처리 |
| **SUCCESS** | 미리보기([생성] 클릭 후) 영역에 '전산예산' 카드가 노출되고 5개 컬럼 데이터가 정확히 표시됨 |
| **SCOPE** | `pages/info/plan/form.vue` 수정만. API 신규 개발 없음(기존 `/api/budget/work/summary` 재사용) |

---

## 1. Overview

### 1.1 Purpose

`/info/plan/form` 화면의 미리보기 영역(생성 버튼 클릭 후 표시되는 `<template v-if="previewVisible">`)에서 '정보화사업' 카드 다음에 '전산예산' 카드를 추가한다.

카드 내용은 기존 `/budget/work` 페이지의 `BudgetSummaryResultTable`(비목별 편성 결과)과 동일한 데이터를 사용하되, 다음 차이를 적용한다:
- **cell 병합 없음**: bigNm/midNm 세로병합, capItem 가로병합 모두 제거
- **컬럼 5개**: 편성요청 / 편성조정 / 조정율 / '26년 편성액(본건) / '25년 편성액(전년도)

### 1.2 Background

기존 `BudgetSummaryResultTable`은 9개 컬럼(비목 3 + 요청금액 3 + 편성금액 3)과 복잡한 cell 병합을 가진다. 계획 등록 화면의 미리보기는 **읽기 전용 참고 정보**이므로, 단순하고 스캔하기 쉬운 평면 테이블이 더 적합하다.

---

## 2. Scope

### 2.1 In Scope

- [ ] `pages/info/plan/form.vue`: '전산예산' 카드 추가 (정보화사업 카드 바로 다음)
- [ ] 미리보기 생성 시(`handleGenerate`) `/api/budget/work/summary?bgYy={plnYy}` 및 `?bgYy={plnYy-1}` 호출
- [ ] 비목별 행 + 합계 행 표시 (summaryRows 로직 재사용 또는 간략화)
- [ ] 5개 컬럼: 편성요청, 편성조정, 조정율, '26년 편성액(본건), '25년 편성액(전년도)
- [ ] 조정율 계산: `편성조정 ÷ 편성요청 × 100` (편성요청=0이면 '-')
- [ ] 금액 표시: 기존 `formatBudget` + `selectedUnit` 활용
- [ ] 데이터 없음 처리: API 데이터 없을 때 빈 카드 대신 안내 문구 표시

### 2.2 Out of Scope

- API 신규 개발 (기존 `/api/budget/work/summary` 그대로 사용)
- cell 병합 (명시적 요구사항에서 제외)
- Excel 내보내기 (계획 등록 화면 특성상 불필요)
- 저장 로직 변경 (전산예산 카드는 읽기 전용 참고 정보)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-01 | [생성] 버튼 클릭 시 전산예산 카드 데이터 로드 (`/api/budget/work/summary` bgYy=당해/전년) | High |
| FR-02 | 정보화사업 카드 바로 다음에 '전산예산' 카드 위치 | High |
| FR-03 | 비목별 행 표시 (자본예산 개별 비목·합계, 일반관리비 세부비목·소계·합계) | High |
| FR-04 | cell 병합 없음 — 모든 셀 독립 렌더링 | High |
| FR-05 | 5개 컬럼: 편성요청 / 편성조정 / 조정율 / '26년 편성액(본건) / '25년 편성액(전년도) | High |
| FR-06 | 조정율 = 편성조정 ÷ 편성요청 × 100%. 편성요청 0이면 '-' 표시 | Medium |
| FR-07 | 금액은 `formatBudget(amount, selectedUnit)` 적용 (단위 선택기 연동) | Medium |
| FR-08 | API 데이터 없을 때 "편성 결과 데이터가 없습니다" 안내 문구 표시 | Low |

### 3.2 컬럼 상세 정의

| # | 컬럼명 | 데이터 소스 | 비고 |
|---|--------|-----------|------|
| 1 | 편성요청 | `SummaryItem.requestAmount` (bgYy=당해) | 결재완료 요청금액 합계 |
| 2 | 편성조정 | `SummaryItem.dupAmount` (bgYy=당해) | 편성금액(조정 후) |
| 3 | 조정율 | `dupAmount / requestAmount × 100` | 소수점 1자리 + `%` |
| 4 | '26년 편성액(본건) | `SummaryItem.dupAmount` (bgYy=당해) | 컬럼 2와 동일 소스로 추정 |
| 5 | '25년 편성액(전년도) | `SummaryItem.dupAmount` (bgYy=당해-1) | 전년도 편성금액 |

> **확인 필요**: 컬럼 2(편성조정)와 컬럼 4('26년 편성액(본건))가 동일한 `dupAmount` 값을 사용합니까?
> 또는 컬럼 4는 별도 계산(예: 최종 확정 편성액)을 사용합니까?

### 3.3 행 구조

`/budget/work`의 `summaryRows` 계산 로직을 재사용하여 다음 행 구성:

```
[자본예산 그룹]
  - 자본예산 개별 비목 행들 (capital=true)
  - 자본예산 합계 행 (rowType='total')
[일반관리비 그룹]
  - 각 중분류(전산임차료/전산여비/전산용역비/전산제비) 내 세부비목 행들
  - 중분류 소계 행 (rowType='subtotal')
  - 일반관리비 합계 행 (rowType='total')
```

---

## 4. Success Criteria

- [ ] FR-01~FR-08 모든 기능 요구사항 구현 완료
- [ ] 미리보기([생성] 클릭 후) '전산예산' 카드가 정보화사업 카드 다음에 표시됨
- [ ] 5개 컬럼 데이터가 `/api/budget/work/summary` API 값과 일치
- [ ] 조정율 계산 정확 (편성요청 0인 경우 '-' 처리 포함)
- [ ] `selectedUnit` 변경 시 금액 포맷 실시간 반영
- [ ] cell 병합 없음 확인
- [ ] TypeScript 오류 없음, `npm run typecheck` 통과
- [ ] 기존 저장 로직 영향 없음 (전산예산 카드는 읽기 전용)

---

## 5. Risks and Mitigation

| 리스크 | 영향도 | 대응방안 |
|--------|--------|---------|
| plnYy 연도에 `/api/budget/work/summary` 데이터 없음 | Medium | 안내 문구 표시 |
| 전년도 데이터 없음 (새 연도 초) | Low | 전년도 셀 '-' 표시 |
| `summaryRows` 로직 복제로 인한 중복 코드 | Low | 별도 composable 추출 or 인라인 간략화 (design 단계에서 결정) |
| `handleGenerate` 내 API 호출 추가로 생성 시간 증가 | Low | Promise.all 병렬 호출 적용 |

---

## 6. Impact Analysis

### 6.1 변경 파일

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `app/pages/info/plan/form.vue` | Modify | 전산예산 카드 추가, handleGenerate에 API 호출 추가 |

### 6.2 재사용 자원

| 자원 | 출처 | 재사용 방식 |
|------|------|-----------|
| `/api/budget/work/summary` | 기존 API | bgYy 파라미터로 당해/전년 조회 |
| `SummaryResponse`, `SummaryItem` | `types/budget-work.ts` | import 추가 |
| `summaryRows` 계산 로직 | `pages/budget/work.vue` | form.vue 내 인라인 또는 추출 |
| `formatBudget` 유틸 | `utils/common.ts` | 이미 import됨 |
| `StyledDataTable` | 공통 컴포넌트 | 기존 사용 중 |
| `selectedUnit` | form.vue 기존 ref | 그대로 활용 |

---

## 7. Architecture Considerations

### 7.1 구현 방식 옵션

| 옵션 | 설명 | 장단점 |
|------|------|--------|
| A. 인라인 구현 | form.vue에 직접 로직 추가 | 단순, 중복 코드 발생 |
| B. `BudgetSummaryResultTable` 재사용 | 기존 컴포넌트에 cell병합 비활성화 prop 추가 | 재사용성, but 기존 컴포넌트 수정 필요 |
| C. 신규 경량 컴포넌트 | `BudgetAllocationCard.vue` 신규 작성 | 관심사 분리, 파일 분산 |

→ **권장: A (인라인)** — 단일 파일 변경으로 범위 최소화.

---

## 8. Convention Prerequisites

- [x] `CLAUDE.md` 코딩 컨벤션 준수
- [x] `<script setup lang="ts">` 구조
- [x] `useApiFetch` / `$apiFetch` 패턴
- [x] `SummaryResponse` 타입 (`types/budget-work.ts`)
- [x] 한글 주석 필수

---

## 9. Next Steps

1. [ ] 컬럼 2/4 동일값 여부 확인 후 설계 반영
2. [ ] Design 문서 작성 (`/pdca design budget-allocation-card`)
3. [ ] `form.vue` 구현
4. [ ] TypeScript 검증 및 수동 테스트

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-05-05 | Initial draft |
