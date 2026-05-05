# PLAN — 협의회 결과 처리 완성 (2026-04-27)

## 1. 배경 및 목적

협의회 워크플로우 3단계(개최) 중 **결과 처리 후반부**가 미구현 상태입니다.
현재 구현된 1~3단계(평가 현황 확인 → 협의회 완료 → 결과서 작성)에 이어,
결과서 확정부터 최종 통보까지의 흐름을 완성합니다.

---

## 2. 협의회 전체 상태 흐름 (참고)

```
DRAFT → SUBMITTED → APPROVAL_PENDING → APPROVED
  → PREPARING → SCHEDULED → IN_PROGRESS → EVALUATING
  → RESULT_WRITING → RESULT_REVIEW → FINAL_APPROVAL
  → RESULT_APPROVAL_PENDING → COMPLETED
```

---

## 3. 구현 범위

### 3.1 현재 구현 완료 (1~3단계)

| 단계 | 기능 | 담당자 |
|------|------|--------|
| 1 | `result/[id].vue` — 평가의견 현황 패널에서 전원 완료 확인 | IT관리자 |
| 2 | `prepare/[id].vue` — 협의회 완료 버튼 → `RESULT_WRITING` 전환 | IT관리자 |
| 3 | `result/[id].vue` — 개최결과서 작성 (`CouncilResultForm` 편집 가능) | IT관리자 |

### 3.2 이번 구현 대상 (4~7단계)

| 단계 | 기능 | 담당자 | 상태 전이 |
|------|------|--------|-----------|
| 4 | **결과서 확정** — 결과서 작성 완료 후 확정 버튼 클릭 | IT관리자 | `RESULT_WRITING → RESULT_REVIEW` |
| 5 | **평가위원 결과서 확인** — 전원 확인 완료 시 자동 전이 | 평가위원 (MAND + CALL) | `RESULT_REVIEW → FINAL_APPROVAL` |
| 6 | **결재 요청** — IT관리자가 부장(결재자) 지정 후 결재 요청 | IT관리자 | `FINAL_APPROVAL → RESULT_APPROVAL_PENDING` |
| 6-1 | **결재 완료/반려 콜백** — 전자결재 시스템 콜백 처리 | 시스템 | `RESULT_APPROVAL_PENDING → COMPLETED / FINAL_APPROVAL` |
| 7 | **통보** — `COMPLETED` 도달 시 IT관리자가 추진부서에 통보 | IT관리자 | 상태 변경 없음 (알림 발송) |

---

## 4. 요구사항 상세

### REQ-01. 결과서 확정 (단계 4)

- **조건**: `RESULT_WRITING` 상태, IT관리자, 종합의견이 입력된 결과서가 존재할 것
- **동작**: "결과서 확정" 버튼 클릭 → `PUT /api/council/{asctId}/result/confirm` 호출
- **성공**: `RESULT_REVIEW` 전환 + 토스트 "결과서가 확정되었습니다"
- **실패 조건**: 결과서 미작성 시 백엔드 400 반환 → 토스트 오류 표시
- **UI 위치**: `CouncilResultForm` 내 저장 버튼 옆에 "결과서 확정" 버튼 추가
- **엔드포인트**: 백엔드 이미 존재 (`ResultService.confirmResult`)

### REQ-02. 평가위원 결과서 확인 (단계 5)

- **조건**: `RESULT_REVIEW` 상태, 해당 협의회의 평가위원(MAND/CALL)만 해당, 간사(SECR) 제외
- **동작**: "결과서 검토 확인" 버튼 클릭 → `POST /api/council/{asctId}/result/review`
- **성공**: 개별 확인 완료 → 버튼 비활성(완료 표시)
- **자동 전이**: 전체 평가위원(MAND+CALL) 전원 확인 완료 시 → `FINAL_APPROVAL` 자동 전환
- **중복 방지**: 이미 확인한 위원이 재진입 시 버튼 대신 완료 상태 표시 (페이지 진입 시 본인 확인 여부 조회)
- **개별 추적**: `BCMMTM` 테이블에 `CFD_YN` 컬럼 추가 (N→Y)
- **엔드포인트 (신규)**: `POST /api/council/{asctId}/result/review`, `GET /api/council/{asctId}/result/review/my`
- **기존 버그**: `ResultReview.vue`가 IT관리자용 `confirmResult` 엔드포인트를 잘못 호출 → 수정 필요

### REQ-03. 결재 요청 (단계 6)

- **조건**: `FINAL_APPROVAL` 상태, IT관리자
- **동작**: "결재 요청" 버튼 클릭 → 결재자(부장) 검색 다이얼로그 → `POST /api/council/{asctId}/result/approval`
- **성공**: `RESULT_APPROVAL_PENDING` 전환 + 토스트 "결재가 요청되었습니다"
- **결재자 선택**: `useEmployeeSearch` AutoComplete + 사번/이름/부서 표시
- **신청의견**: 선택 입력 (Textarea)
- **엔드포인트 (신규)**: `POST /api/council/{asctId}/result/approval`

### REQ-04. 결재 콜백 (단계 6-1)

- **조건**: `RESULT_APPROVAL_PENDING` 상태
- **승인**: `COMPLETED` 전환
- **반려**: `FINAL_APPROVAL` 전환 (재결재 요청 가능)
- **구현**: 기존 `PATCH /api/council/{asctId}/approval` 콜백을 상태에 따라 분기 처리

### REQ-05. 통보 (단계 7)

- **조건**: `COMPLETED` 상태, IT관리자
- **동작**: "통보" 버튼 클릭 → 확인 다이얼로그 → `POST /api/council/{asctId}/notify`
- **성공**: 토스트 "추진부서에 통보되었습니다" (백엔드: 추진부서 담당자에게 알림 또는 사업 상태 변경)
- **구현 범위**: MVP — 사업 상태를 '요건 상세화'로 변경 (`BPROJM.PRJ_STS`)

---

## 5. 신규 추가 상태

| 코드 | 설명 |
|------|------|
| `RESULT_APPROVAL_PENDING` | 개최결과서 결재 대기 중 (결재 요청 후~결재 완료 전) |

---

## 6. 신규 API 설계

| Method | URL | 호출자 | 설명 |
|--------|-----|--------|------|
| `POST` | `/api/council/{asctId}/result/review` | 평가위원 | 결과서 검토 확인 (개별, CFD_YN=Y) |
| `GET` | `/api/council/{asctId}/result/review/my` | 평가위원 | 본인 결과서 확인 여부 조회 |
| `POST` | `/api/council/{asctId}/result/approval` | IT관리자 | 개최결과서 결재 요청 |
| `POST` | `/api/council/{asctId}/notify` | IT관리자 | 추진부서 통보 처리 |

---

## 7. DB 변경사항

| 테이블 | 컬럼 | 타입 | 기본값 | 설명 |
|--------|------|------|--------|------|
| `TAAABB_BCMMTM` | `CFD_YN` | `CHAR(1)` | `'N'` | 결과서 검토 확인 여부 |

---

## 8. 변경 파일 목록

### 백엔드 (`it_backend`)

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `entity/Bcmmtm.java` | 수정 | `cfdYn` 필드 추가, `confirmReview()` 메서드 추가 |
| `dto/CouncilDto.java` | 수정 | `CommitteeMemberResponse`에 `cfdYn` 추가, `ResultApprovalRequest` 신규 추가 |
| `service/CommitteeService.java` | 수정 | `toMemberResponseFromEntity` — `cfdYn` 포함 |
| `service/ResultService.java` | 수정 | `reviewResult()`, `getMyReviewStatus()` 신규 추가, `committeeRepository` 주입 |
| `service/CouncilApprovalService.java` | 수정 | `requestResultApproval()` 추가, `processApprovalCallback()` 분기 처리 |
| `service/CouncilService.java` | 수정 | `notifyCouncil()` 추가 |
| `controller/CouncilController.java` | 수정 | 4개 신규 엔드포인트 추가 |

### 프론트엔드 (`it_frontend`)

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `types/council.ts` | 수정 | `RESULT_APPROVAL_PENDING` 상태 추가, `CommitteeMember.cfdYn` 추가 |
| `composables/useCouncil.ts` | 수정 | `reviewResult`, `fetchMyResultReview`, `requestResultApproval`, `notifyCouncil` 추가 |
| `components/council/result/ResultForm.vue` | 수정 | `confirmable` prop 추가, "결과서 확정" 버튼 추가, `confirmed` emit 추가 |
| `components/council/result/ResultReview.vue` | 수정 | `confirmResult` → `reviewResult` 교체, 본인 확인 여부 사전 조회 |
| `pages/info/council-request/result/[id].vue` | 수정 | `resultReadonly` 수정, FINAL_APPROVAL/결재/통보 UI 추가, 결재 다이얼로그 추가 |

---

## 9. 구현 순서

```
1. [BE] Bcmmtm.java - cfdYn 필드 추가           ← 완료
2. [BE] CouncilDto.java - CommitteeMemberResponse, ResultApprovalRequest
3. [BE] CommitteeService.java - cfdYn 응답 포함
4. [BE] ResultService.java - reviewResult, getMyReviewStatus
5. [BE] CouncilApprovalService.java - requestResultApproval, 콜백 분기
6. [BE] CouncilService.java - notifyCouncil
7. [BE] CouncilController.java - 4개 엔드포인트
8. [FE] types/council.ts
9. [FE] useCouncil.ts
10. [FE] ResultForm.vue
11. [FE] ResultReview.vue
12. [FE] result/[id].vue
```

---

## 10. 검증 항목 (CHECK 단계 기준)

| # | 시나리오 | 기대 결과 |
|---|----------|-----------|
| C-01 | IT관리자가 결과서 저장 후 "결과서 확정" 클릭 | `RESULT_REVIEW` 전환, 결과서 편집 불가 |
| C-02 | 평가위원이 결과서 확인 버튼 클릭 | 본인 확인 완료, 버튼 비활성 |
| C-03 | 마지막 평가위원이 확인 버튼 클릭 | `FINAL_APPROVAL` 자동 전환 |
| C-04 | 평가위원이 재진입 | 버튼 없이 완료 상태 표시 |
| C-05 | IT관리자 "결재 요청" → 결재자 선택 후 요청 | `RESULT_APPROVAL_PENDING` 전환 |
| C-06 | 결재 승인 콜백 | `COMPLETED` 전환 |
| C-07 | 결재 반려 콜백 | `FINAL_APPROVAL` 복귀, 재결재 가능 |
| C-08 | IT관리자 "통보" 버튼 클릭 | 사업 상태 '요건 상세화' 변경, 토스트 |
| C-09 | 미작성 결과서로 확정 시도 | 백엔드 400, 오류 토스트 |
| C-10 | 간사(SECR)가 결과서 확인 시도 | 버튼 미노출 |
