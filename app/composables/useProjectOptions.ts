/**
 * ============================================================================
 * [useProjectOptions] 프로젝트 폼 공통 선택지 옵션 Composable
 * ============================================================================
 * 정보화사업/전산업무비 폼에서 공통으로 사용하는 선택지 옵션을 제공합니다.
 *
 * [제공 옵션]
 *  - yearOptions    : 사업연도 선택지 (작년, 현재 연도, 내년)
 *  - prjTypeOptions : 사업구분 선택지 (신규/계속)
 *
 * [사용처]
 *  - pages/info/projects/form.vue : 프로젝트 등록/수정 폼
 *  - pages/info/cost/form.vue     : 전산업무비 등록/수정 폼
 * ============================================================================
 */

/**
 * 프로젝트 폼 공통 선택지 옵션 Composable 함수
 *
 * @returns 사업연도 및 사업구분 선택지 옵션 객체
 */
export const useProjectOptions = () => {
    const currentYear = new Date().getFullYear();
    /** 사업연도 선택지 (작년, 현재 연도, 내년 — 3개년) */
    const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
    /** 사업구분 선택지 (신규사업 / 계속사업) */
    const prjTypeOptions = ['신규', '계속'];
    return { yearOptions, prjTypeOptions };
};
