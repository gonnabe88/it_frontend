# it_frontend — 정보화실무협의회 목록 개선 완료 보고서

> **Feature**: it_frontend (council 목록 개선)
> **Phase**: Report
> **Date**: 2026-04-05
> **Match Rate**: 100%
> **Iteration Count**: 0

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 관리자 계정(K230028)으로 결재완료 사업이 0건 조회되는 버그 및 카드 UI 정보 부족, Oracle JDBC 타입 불일치 오류 |
| **Solution** | 관리자 분기 쿼리 분리 + PRJ_STS 조건 추가, 8개 사업 상세 필드 카드 표출, 클릭 동작 분리, toLocalDate 헬퍼로 JDBC 버그 수정 |
| **Function UX Effect** | 관리자·일반사용자 모두 결재완료 사업을 정상 조회, 카드에서 사업 요약 정보 즉시 확인, 클릭 한 번으로 사업 상세 또는 협의회 신청 진입 |
| **Core Value** | 협의회 신청 프로세스 진입점 완성 — 권한별 사업 목록 정상화로 업무 연속성 확보 |

---

## 1. 요구사항 이행 결과

### 1.1 Success Criteria 최종 상태

| # | 성공 기준 | 상태 | 근거 |
|---|-----------|:----:|------|
| 1 | 관리자(K230028)도 결재완료 사업 조회 가능 | ✅ | `findProjectsForCouncilAll()` 신규 쿼리, 관리자 분기에 적용 |
| 2 | PRJ_STS 조건으로 신청 대상 사업만 필터 | ✅ | 미신청='예산 작성'+결재완료, 신청='정실협 진행중' |
| 3 | 카드에 사업 상세 8개 필드 표출 | ✅ | prjYy/prjTp/svnDpm/prjBg/sttDt/endDt/itDpm/prjDes |
| 4 | 카드 클릭 → 사업 상세 / 뱃지 클릭 → 협의회 | ✅ | `navigateToProject` / `openApplyDialog` / `navigateToCouncil` 분리 |
| 5 | Oracle DATE 캐스팅 오류 해결 | ✅ | `toLocalDate(Object val)` 헬퍼로 4가지 타입 방어 처리 |

**Overall Success Rate: 5/5 (100%)**

---

## 2. 변경 파일 목록

### 2.1 백엔드

| 파일 | 변경 유형 | 주요 내용 |
|------|-----------|-----------|
| `CouncilRepository.java` | 수정 | `findProjectsForCouncilAll()` 추가 (16컬럼, PRJ_STS 조건), `findProjectsForCouncilByDepartment()` 동일 조건 적용 |
| `CouncilService.java` | 수정 | 관리자 분기 쿼리 교체, `toListResponseFromRow()` rows[8]~[15] 매핑 추가, `toLocalDate()` 헬퍼 신규, `toListResponseFromEntity()` null 8개 추가 |
| `CouncilDto.java` | 수정 | `ListResponse` record에 prjYy/prjTp/svnDpm/prjBg/sttDt/endDt/itDpm/prjDes 8필드 추가 |

### 2.2 프론트엔드

| 파일 | 변경 유형 | 주요 내용 |
|------|-----------|-----------|
| `app/types/council.ts` | 수정 | `CouncilListItem`에 8개 필드 추가 (`string \| null`, `number \| null`) |
| `app/pages/info/council/index.vue` | 수정 | 헬퍼 함수 3개 추가(formatDate/formatBudget/getPrjTpLabel), 카드 하단 칩 UI 추가, 클릭 이벤트 3분기 처리 |

---

## 3. 핵심 결정 및 결과 (Decision Record)

| 결정 | 내용 | 결과 |
|------|------|------|
| 관리자용 별도 쿼리 분리 | `findProjectsForCouncilAll`로 SVN_DPM 필터 없는 전체 조회 | 관리자 0건 버그 해결 |
| Oracle DATE 타입 방어 처리 | `toLocalDate()` 헬퍼 — LocalDate/LocalDateTime/java.sql.Date/Timestamp 4가지 처리 | 400 오류 해결 |
| 클릭 동작 3분기 | 카드→사업상세, 신청뱃지→Dialog, 상태뱃지→협의회 단계페이지 | UX 명확성 향상 |
| 사업 상세 8필드 전부 포함 | 요청대로 전부 노출, null 자동 숨김 | 사용자가 필요 없는 필드는 직접 피드백으로 제거 예정 |

---

## 4. Gap Analysis 요약

- **Match Rate**: 100%
- **Critical Issues**: 0
- **Minor Observations**: 3 (기능 영향 없음, 향후 개선 고려)
  - svnDpm 부서코드 → 부서명 변환 (현재 코드 그대로 표출)
  - formatBudget 로컬 정의 vs utils/common.ts 중복 가능성
  - 평가위원 카드의 사업 상세 필드 null 처리 (의도된 설계)

---

## 5. 다음 단계

- svnDpm이 부서코드(숫자)로 보이는 경우 부서명 조인 추가 검토
- 카드 UI 필드 중 불필요한 항목은 사용자 피드백으로 순차 제거
- 협의회 신청 후 타당성검토표(Step 1) 연동 확인
