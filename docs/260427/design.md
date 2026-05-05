# DESIGN — 협의회 결과 처리 완성 (2026-04-27)

## 1. 상태 전이 설계

```
RESULT_WRITING
  │  IT관리자 "결과서 확정" 클릭
  │  PUT /api/council/{asctId}/result/confirm
  ▼
RESULT_REVIEW
  │  평가위원 전원 "결과서 검토 확인" 클릭
  │  POST /api/council/{asctId}/result/review  (개별 호출)
  │  CFD_YN = 'Y' 전원 충족 시 자동 전이
  ▼
FINAL_APPROVAL
  │  IT관리자 "결재 요청" 클릭 (결재자 선택)
  │  POST /api/council/{asctId}/result/approval
  ▼
RESULT_APPROVAL_PENDING
  │  전자결재 시스템 콜백
  │  PATCH /api/council/{asctId}/approval
  ├─(승인)─▶ COMPLETED
  │              │  IT관리자 "통보" 클릭
  │              │  POST /api/council/{asctId}/notify
  │              ▼
  │           (종료)
  └─(반려)─▶ FINAL_APPROVAL  (재결재 요청 가능)
```

---

## 2. DB 설계

### 2.1 TAAABB_BCMMTM 컬럼 추가

| 컬럼명 | 타입 | NOT NULL | 기본값 | 설명 |
|--------|------|----------|--------|------|
| `CFD_YN` | `CHAR(1)` | Y | `'N'` | 결과서 검토 확인 여부 (`N` / `Y`) |

**변경 시점**: 위원 선정(`saveCommittee`) 시 신규 INSERT되는 행은 `CFD_YN = 'N'`으로 생성됩니다.
기존 데이터에는 ALTER TABLE로 기본값 'N' 컬럼 추가만 하면 됩니다.

---

## 3. API 설계

### 3.1 기존 API (변경 없음)

| Method | URL | 설명 |
|--------|-----|------|
| `PUT` | `/api/council/{asctId}/result/confirm` | 결과서 확정 (RESULT_WRITING → RESULT_REVIEW) |
| `PATCH` | `/api/council/{asctId}/approval` | 결재 콜백 (분기 로직 추가됨) |

### 3.2 신규 API

#### POST `/api/council/{asctId}/result/review`
- **호출자**: 평가위원 (MAND / CALL)
- **Request Body**: 없음
- **동작**:
  1. `RESULT_REVIEW` 상태 검증
  2. 호출자가 해당 협의회 MAND/CALL 위원인지 검증 (SECR 제외)
  3. `BCMMTM.CFD_YN = 'Y'` 업데이트
  4. 전체 MAND+CALL 위원의 CFD_YN 확인 → 전원 'Y'면 `FINAL_APPROVAL` 자동 전이
- **Response**: `200 OK` (body 없음)
- **오류**:
  - `400` — RESULT_REVIEW 상태 아님
  - `403` — 평가위원 아님 또는 간사

#### GET `/api/council/{asctId}/result/review/my`
- **호출자**: 평가위원 (페이지 진입 시 본인 확인 여부 조회)
- **Response**:
```json
true   // 이미 확인 완료
false  // 미확인
```

#### POST `/api/council/{asctId}/result/approval`
- **호출자**: IT관리자
- **Request Body**:
```json
{
  "approverEno": "K000001",   // 결재자(부장) 사번
  "rqsOpnn": "결재 요청합니다."  // 신청의견 (선택)
}
```
- **동작**:
  1. `FINAL_APPROVAL` 상태 검증
  2. 전자결재 시스템에 신청서 등록 (`ApplicationService.submit`)
     - 신청서명: `"협의회 개최결과서 결재 요청 - {사업명}"`
  3. `RESULT_APPROVAL_PENDING` 전환
- **Response**:
```json
{ "apfMngNo": "APF_202600000002" }
```

#### POST `/api/council/{asctId}/notify`
- **호출자**: IT관리자
- **Request Body**: 없음
- **동작**: `BPROJM.PRJ_STS` → `'요건 상세화'` 변경
- **Response**: `200 OK`

### 3.3 기존 API 변경 — `PATCH /api/council/{asctId}/approval` (콜백)

**변경 전**: `APPROVAL_PENDING` 상태만 처리
**변경 후**: 현재 상태에 따라 분기

```
현재 상태 = APPROVAL_PENDING  (타당성검토표 결재)
  → 승인: APPROVED
  → 반려: DRAFT

현재 상태 = RESULT_APPROVAL_PENDING  (개최결과서 결재)
  → 승인: COMPLETED
  → 반려: FINAL_APPROVAL
```

---

## 4. 백엔드 클래스 설계

### 4.1 Bcmmtm.java

```java
// 추가 필드
@Column(name = "CFD_YN", length = 1, nullable = false)
@Builder.Default
private String cfdYn = "N";

// 추가 메서드
public void confirmReview() {
    this.cfdYn = "Y";
}
```

### 4.2 CouncilDto.java

```java
// CommitteeMemberResponse — cfdYn 필드 추가
public record CommitteeMemberResponse(
    String eno, String usrNm, String bbrNm, String ptCNm,
    String vlrTp,
    String cfdYn   // ← 추가
) {}

// ResultApprovalRequest — 신규
public record ResultApprovalRequest(
    String approverEno,
    String rqsOpnn
) {}
```

### 4.3 ResultService.java

```java
// 신규 의존성 주입
private final CommitteeRepository committeeRepository;

// reviewResult(asctId, userDetails)
//   1. RESULT_REVIEW 상태 검증
//   2. 위원 레코드 조회 → SECR 제외 검증
//   3. member.confirmReview()
//   4. 전원 확인 시 FINAL_APPROVAL 전이

// getMyReviewStatus(asctId, userDetails) → boolean
//   committeeRepository에서 CFD_YN 조회
```

### 4.4 CouncilApprovalService.java

```java
// 신규 메서드
// requestResultApproval(asctId, request, userDetails)
//   1. FINAL_APPROVAL 상태 검증
//   2. ApplicationService.submit()
//   3. RESULT_APPROVAL_PENDING 전이

// processApprovalCallback — 분기 추가
// if APPROVAL_PENDING → 기존 로직
// if RESULT_APPROVAL_PENDING
//     승인 → COMPLETED
//     반려 → FINAL_APPROVAL
```

### 4.5 CouncilService.java

```java
// notifyCouncil(asctId)
//   COMPLETED 상태 검증
//   councilRepository.updateProjectStatus(prjMngNo, prjSno, "요건 상세화")
```

---

## 5. 프론트엔드 컴포넌트 설계

### 5.1 types/council.ts

```typescript
// CouncilStatus에 추가
| 'RESULT_APPROVAL_PENDING'  // 개최결과서 결재 대기

// CommitteeMember에 추가
export interface CommitteeMember {
  eno: string;
  usrNm: string | null;
  bbrNm: string | null;
  ptCNm: string | null;
  vlrTp: CommitteeType;
  cfdYn: 'Y' | 'N';   // ← 추가
}
```

### 5.2 useCouncil.ts — 신규 함수

```typescript
// 평가위원 결과서 검토 확인
const reviewResult = async (asctId: string): Promise<void> => {
    await $apiFetch(`${BASE}/${asctId}/result/review`, { method: 'POST' });
};

// 본인 결과서 확인 여부 조회
const fetchMyResultReview = (asctId: string) => {
    return useApiFetch<boolean>(`${BASE}/${asctId}/result/review/my`);
};

// 개최결과서 결재 요청 (IT관리자)
const requestResultApproval = async (
    asctId: string,
    approverEno: string,
    rqsOpnn?: string
): Promise<{ apfMngNo: string }> => {
    return await $apiFetch(`${BASE}/${asctId}/result/approval`, {
        method: 'POST',
        body: { approverEno, rqsOpnn },
    });
};

// 추진부서 통보
const notifyCouncil = async (asctId: string): Promise<void> => {
    await $apiFetch(`${BASE}/${asctId}/notify`, { method: 'POST' });
};
```

### 5.3 ResultForm.vue

**Props 추가**:
```typescript
interface Props {
    asctId: string;
    councilDetail: CouncilDetail | null;
    feasibility: FeasibilityData | null;
    readonly?: boolean;
    confirmable?: boolean;   // ← 추가: true이면 "결과서 확정" 버튼 노출
}
```

**Emits 추가**:
```typescript
(e: 'saved'): void;
(e: 'confirmed'): void;   // ← 추가
```

**버튼 영역 레이아웃**:
```
[ 결과서 저장 ]  [ 결과서 확정 ▶ ]
 ↑ 기존            ↑ confirmable=true 일 때만 표시
```

**결과서 확정 클릭 시**:
- `confirmResult(asctId)` 호출 (기존 PUT /result/confirm)
- 성공 시 토스트 "결과서가 확정되었습니다" + `emit('confirmed')`

### 5.4 ResultReview.vue

**변경점**:
- `readonly` prop 제거 (내부에서 직접 본인 확인 상태 조회)
- 페이지 진입 시 `fetchMyResultReview(asctId)` → `alreadyConfirmed` 결정
- 버튼 클릭 시 `confirmResult` → `reviewResult` 교체
- `alreadyConfirmed || confirmed` 이면 완료 상태 UI 표시

**상태 흐름**:
```
진입
 ├─ fetchMyResultReview() = true  → 완료 UI 바로 표시
 └─ fetchMyResultReview() = false → "결과서 검토 확인" 버튼 표시
       클릭 → reviewResult() 호출
           → 성공: confirmed = true → 완료 UI / emit('confirmed')
```

### 5.5 result/[id].vue

**`resultReadonly` 수정**:
```typescript
// 변경 전: RESULT_WRITING, RESULT_REVIEW 모두 편집 가능
// 변경 후: RESULT_WRITING 상태에서만 편집 가능
const resultReadonly = computed(() =>
    !isAdminOnly.value || councilStatus.value !== 'RESULT_WRITING'
);

// 결과서 확정 버튼 노출 조건
const canConfirmResult = computed(() =>
    isAdminOnly.value && councilStatus.value === 'RESULT_WRITING'
);

// 결재 요청 버튼 노출 조건
const canRequestApproval = computed(() =>
    isAdminOnly.value && councilStatus.value === 'FINAL_APPROVAL'
);

// 통보 버튼 노출 조건
const canNotify = computed(() =>
    isAdminOnly.value && councilStatus.value === 'COMPLETED'
);
```

**신규 UI 블록 (IT관리자 섹션)**:

```
[ FINAL_APPROVAL 상태 ]
┌────────────────────────────────────────────┐
│  결재 요청                                  │
│  평가위원 전원 결과서 확인이 완료되었습니다.   │
│  [결재자 검색 AutoComplete]                  │
│  [신청의견 Textarea (선택)]                  │
│                          [결재 요청 버튼]   │
└────────────────────────────────────────────┘

[ RESULT_APPROVAL_PENDING 상태 ]
┌────────────────────────────────────────────┐
│  ⏳  결재 대기 중                            │
│  결재자의 승인을 기다리고 있습니다.            │
└────────────────────────────────────────────┘

[ COMPLETED 상태 ]
┌────────────────────────────────────────────┐
│  ✅  협의회가 완료되었습니다.                 │
│  추진부서 담당자에게 결과를 통보해 주세요.     │
│                              [통보 버튼]   │
└────────────────────────────────────────────┘
```

**결재 요청 다이얼로그 구조**:
```
Dialog "결재 요청"
  ├── AutoComplete (결재자 검색 — useEmployeeSearch)
  ├── Textarea "신청의견" (선택)
  └── Button "결재 요청" (결재자 선택 완료 시 활성)
```

---

## 6. 화면 흐름 설계

### 6.1 IT관리자 흐름

```
result/[id].vue (RESULT_WRITING)
  ├── CouncilResultForm (편집 가능, 확정 버튼 포함)
  │     └── "결과서 확정" → confirmResult() → RESULT_REVIEW 전환
  │
result/[id].vue (RESULT_REVIEW)
  ├── CouncilResultForm (읽기 전용)
  ├── 평가의견 현황 (EvalSummaryPanel)
  │
result/[id].vue (FINAL_APPROVAL)
  ├── CouncilResultForm (읽기 전용)
  ├── 결재 요청 섹션 표시
  │     └── "결재 요청" → Dialog → requestResultApproval() → RESULT_APPROVAL_PENDING
  │
result/[id].vue (RESULT_APPROVAL_PENDING)
  ├── CouncilResultForm (읽기 전용)
  ├── "결재 대기 중" 안내
  │
result/[id].vue (COMPLETED)
  ├── CouncilResultForm (읽기 전용)
  └── "통보" 버튼 → notifyCouncil() → 사업 상태 변경
```

### 6.2 평가위원 흐름

```
result/[id].vue (RESULT_REVIEW)
  ├── CouncilResultForm (읽기 전용)
  └── CouncilResultReview
        ├── 미확인: "결과서 검토 확인" 버튼 → reviewResult() → 완료 UI
        └── 확인 완료: 완료 UI (재진입 시에도 동일)
```

---

## 7. 예외 처리 설계

| 상황 | 처리 |
|------|------|
| 결과서 미작성 상태에서 확정 시도 | 백엔드 400 → 오류 토스트 "결과서를 먼저 저장해 주세요" |
| 간사(SECR)가 결과서 검토 확인 시도 | 버튼 미노출 (프론트 조건부 렌더링) |
| 이미 확인한 위원이 재진입 | `fetchMyResultReview` = true → 완료 UI 표시 |
| 결재 반려 후 재결재 요청 | `FINAL_APPROVAL` 복귀 → 결재 요청 버튼 재활성 |
| 이미 통보한 상태에서 재통보 | 버튼 제거 또는 비활성 (COMPLETED 이후 사업 상태 중복 변경 방지는 백엔드 멱등성으로 처리) |
