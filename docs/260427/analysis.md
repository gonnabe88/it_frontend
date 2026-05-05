# 협의회 결과 처리 완성 — Gap Analysis

> **Feature**: council-result-completion
> **Date**: 2026-04-27
> **Phase**: Check
> **Scope**: 결과서 확정 → 평가위원 검토 → 결재 요청 → 통보 (단계 4~7)
> **Analyzer**: Claude Sonnet 4.6

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 협의회 결과 처리 후반부(RESULT_WRITING 이후) 미구현 상태 해소 |
| **WHO** | IT관리자(결과서 확정·결재요청·통보), 평가위원(결과서 검토 확인) |
| **RISK** | 기존 `processApprovalCallback` 분기 누락, `ResultReview.vue` 잘못된 엔드포인트, useFetch 키 충돌 |
| **SUCCESS** | RESULT_WRITING → RESULT_REVIEW → FINAL_APPROVAL → RESULT_APPROVAL_PENDING → COMPLETED 전이 완성 |
| **SCOPE** | 단계 4~7 + `ResultReview.vue` 버그 수정 + EvalSummaryPanel useFetch 키 충돌 수정 |

---

## 1. Executive Summary

| 항목 | 결과 |
|------|------|
| **분석 범위** | PLAN §3.2 REQ-01~REQ-05 (5개 요구사항) |
| **Match Rate** | **100%** |
| **Critical** | 0건 |
| **Important** | 0건 |
| **Minor** | 0건 |
| **버그 수정** | 2건 (EvalSummaryPanel useFetch 키 충돌, ResultReview.vue 잘못된 엔드포인트) |

---

## 2. Strategic Alignment Check

### 2.1 Plan 핵심 목표 충족 여부

| 목표 | 상태 | 근거 |
|------|------|------|
| 결과서 확정 버튼 (RESULT_WRITING → RESULT_REVIEW) | ✅ Met | `ResultForm.vue` `confirmable` prop + `handleConfirm()` |
| 평가위원 결과서 검토 확인 (개별 + 자동 전이) | ✅ Met | `ResultReview.vue` `reviewResult()` + `fetchMyResultReview()` |
| 결재 요청 Dialog (FINAL_APPROVAL → RESULT_APPROVAL_PENDING) | ✅ Met | `result/[id].vue` 결재 다이얼로그 + `requestResultApproval()` |
| 결재 콜백 분기 처리 | ✅ Met | `CouncilApprovalService.processApprovalCallback` 상태 분기 |
| 추진부서 통보 (COMPLETED → 사업상태 변경) | ✅ Met | `notifyCouncil()` + COMPLETED UI 블록 |

### 2.2 Success Criteria 평가

| ID | 요구사항 | 상태 | 근거 |
|----|---------|------|------|
| REQ-01 | 결과서 확정 (RESULT_WRITING → RESULT_REVIEW) | ✅ Met | `ResultForm.confirmable=true` → `PUT /result/confirm` |
| REQ-02 | 평가위원 결과서 확인 + 전원 완료 시 FINAL_APPROVAL 자동 전이 | ✅ Met | `POST /result/review` + `ReviewResult.reviewResult()` + 본인 상태 사전 조회 |
| REQ-03 | 결재 요청 (FINAL_APPROVAL → RESULT_APPROVAL_PENDING) | ✅ Met | `POST /result/approval` + 결재자 AutoComplete Dialog |
| REQ-04 | 결재 콜백 분기 (APPROVAL_PENDING / RESULT_APPROVAL_PENDING) | ✅ Met | `processApprovalCallback` if-else 분기 |
| REQ-05 | 통보 (COMPLETED, PRJ_STS '요건 상세화') | ✅ Met | `POST /notify` + `notifyCouncil()` |

---

## 3. Gap 분석 결과

### 3.1 Critical (0건)

없음.

---

### 3.2 Important (0건)

없음.

---

### 3.3 Minor (0건)

없음.

---

### 3.4 버그 수정 이력

| ID | 버그 | 원인 | 수정 방법 |
|----|------|------|-----------|
| BUG-01 | `EvalSummaryPanel` useFetch 키 충돌 → 페이지 로드 실패 | `result/[id].vue`와 `EvalSummaryPanel.vue` 모두 `fetchCommittee(asctId)` 호출 → Nuxt useFetch 동일 키 충돌 | `EvalSummaryPanel`에서 내부 fetch 제거 → `committeeData` prop 주입 방식으로 전환 |
| BUG-02 | `ResultReview.vue`에서 IT관리자 전용 엔드포인트 오호출 | `confirmResult()` (`PUT /result/confirm`) 호출 → `RESULT_WRITING → RESULT_REVIEW` 전이 함수를 평가위원이 호출 | `reviewResult()` (`POST /result/review`)로 교체 + `fetchMyResultReview()`로 본인 상태 사전 조회 |

---

## 4. 구현 적합성 검토

### 4.1 백엔드 변경 검토

| 파일 | 변경 | Design 일치 여부 |
|------|------|-----------------|
| `Bcmmtm.java` | `cfdYn` 필드 + `confirmReview()` 추가 | ✅ Design §4.1 일치 |
| `CouncilDto.java` | `CommitteeMemberResponse`에 `cfdYn` 추가, `ResultApprovalRequest` 신규 | ✅ Design §4.2 일치 |
| `CommitteeService.java` | `toMemberResponse`/`toMemberResponseFromEntity`에 `cfdYn` 포함 | ✅ Design §4.3 설계 반영 |
| `ResultService.java` | `reviewResult()`, `getMyReviewStatus()` 추가, `committeeRepository` 주입 | ✅ Design §4.3 일치 |
| `CouncilApprovalService.java` | `requestResultApproval()` 신규, `processApprovalCallback()` 분기 추가 | ✅ Design §4.4 일치 |
| `CouncilService.java` | `notifyCouncil()` 추가 | ✅ Design §4.5 일치 |
| `CouncilController.java` | 4개 엔드포인트 추가 (POST review, GET review/my, POST result/approval, POST notify) | ✅ Design §3.2 일치 |

### 4.2 프론트엔드 변경 검토

| 파일 | 변경 | Design 일치 여부 |
|------|------|-----------------|
| `types/council.ts` | `RESULT_APPROVAL_PENDING` 추가, `CommitteeMember.cfdYn` 추가 | ✅ Design §5.1 일치 |
| `useCouncil.ts` | `reviewResult`, `fetchMyResultReview`, `requestResultApproval`, `notifyCouncil` 추가 | ✅ Design §5.2 일치 |
| `ResultForm.vue` | `confirmable` prop, `confirmed` emit, "결과서 확정" 버튼 | ✅ Design §5.3 일치 |
| `ResultReview.vue` | `reviewResult` 교체, `fetchMyResultReview` 본인 상태 조회, `readonly` prop 제거 | ✅ Design §5.4 일치 |
| `result/[id].vue` | `resultReadonly` 수정, `canConfirmResult`/`canRequestApproval`/`canNotify` 추가, FINAL_APPROVAL·RESULT_APPROVAL_PENDING·COMPLETED UI 블록, 결재 Dialog | ✅ Design §5.5 일치 |

---

## 5. 예외 처리 검토

| 시나리오 | 처리 방법 | 구현 상태 |
|---------|----------|---------|
| 결과서 미작성 상태에서 확정 시도 | 백엔드 400 → 오류 토스트 | ✅ (ResultService.confirmResult 예외) |
| 간사(SECR)가 결과서 검토 확인 시도 | 버튼 미노출 (ResultReview.vue는 RESULT_REVIEW 상태에서만 평가위원에게 표시) + 백엔드 403 | ✅ |
| 이미 확인한 위원이 재진입 | `fetchMyResultReview()` = true → 완료 UI 표시 | ✅ |
| 결재 반려 후 재결재 요청 | `FINAL_APPROVAL` 복귀 → `canRequestApproval` = true → 결재 요청 버튼 재활성 | ✅ |
| 이미 통보한 상태에서 재통보 | 백엔드 멱등성 처리 (updateProjectStatus 중복 실행 무해) | ✅ |

---

## 6. 검증 항목 (PLAN §10 대비)

| # | 시나리오 | 기대 결과 | 구현 충족 여부 |
|---|----------|-----------|---------------|
| C-01 | IT관리자 결과서 확정 클릭 | RESULT_REVIEW 전환, 편집 불가 | ✅ `confirmResult()` + `resultReadonly` 수정 |
| C-02 | 평가위원 결과서 확인 버튼 클릭 | 본인 확인 완료, 완료 UI 표시 | ✅ `reviewResult()` + `justConfirmed` |
| C-03 | 마지막 평가위원 확인 | FINAL_APPROVAL 자동 전환 | ✅ 서버사이드 `allConfirmed` 체크 |
| C-04 | 평가위원 재진입 | 버튼 없이 완료 UI 표시 | ✅ `fetchMyResultReview()` = true → `alreadyConfirmed` |
| C-05 | IT관리자 결재 요청 → 결재자 선택 후 요청 | RESULT_APPROVAL_PENDING 전환 | ✅ `requestResultApproval()` + Dialog |
| C-06 | 결재 승인 콜백 | COMPLETED 전환 | ✅ `processApprovalCallback` 분기 |
| C-07 | 결재 반려 콜백 | FINAL_APPROVAL 복귀, 재결재 가능 | ✅ `processApprovalCallback` 분기 |
| C-08 | IT관리자 통보 버튼 클릭 | 사업 상태 '요건 상세화', 토스트 | ✅ `notifyCouncil()` + COMPLETED UI |
| C-09 | 미작성 결과서로 확정 시도 | 백엔드 400, 오류 토스트 | ✅ `ResultService.confirmResult` 예외 처리 |
| C-10 | 간사(SECR) 결과서 확인 시도 | 버튼 미노출 | ✅ `ResultReview.vue`는 평가위원 화면 내 표시 |

**Match Rate: 10/10 = 100%**

---

*Generated by Claude Sonnet 4.6 — 2026-04-27*
