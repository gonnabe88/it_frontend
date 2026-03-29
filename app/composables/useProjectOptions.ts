/**
 * [composables/useProjectOptions.ts] 프로젝트 폼 공통 선택지 옵션
 * 정보화사업/경상사업 폼에서 공통으로 사용하는 사업연도, 사업구분 옵션을 제공합니다.
 */
export const useProjectOptions = () => {
    const currentYear = new Date().getFullYear();
    /** 사업연도 선택지 (현재 연도, 내년) */
    const yearOptions = [currentYear, currentYear + 1];
    /** 사업구분 선택지 (신규/계속) */
    const prjTypeOptions = ['신규', '계속'];
    return { yearOptions, prjTypeOptions };
};
