/**
 * ============================================================================
 * [tests/unit/composables/useProjectOptions.test.ts] 프로젝트 옵션 Composable 단위 테스트
 * ============================================================================
 * composables/useProjectOptions.ts를 직접 import하여 커버리지를 측정합니다.
 * 이 composable은 Vue/Nuxt 의존성이 없는 순수 함수이므로 Mock 없이 테스트합니다.
 */
import { describe, it, expect } from 'vitest';
import { useProjectOptions } from '~/composables/useProjectOptions';

describe('useProjectOptions', () => {
    it('yearOptions는 3개의 연도를 반환한다 (작년, 올해, 내년)', () => {
        const { yearOptions } = useProjectOptions();
        expect(yearOptions).toHaveLength(3);
    });

    it('yearOptions의 두 번째 항목은 현재 연도이다', () => {
        const { yearOptions } = useProjectOptions();
        const currentYear = new Date().getFullYear();
        expect(yearOptions[1]).toBe(currentYear);
    });

    it('yearOptions의 첫 번째 항목은 작년이다', () => {
        const { yearOptions } = useProjectOptions();
        const currentYear = new Date().getFullYear();
        expect(yearOptions[0]).toBe(currentYear - 1);
    });

    it('yearOptions의 세 번째 항목은 내년이다', () => {
        const { yearOptions } = useProjectOptions();
        const currentYear = new Date().getFullYear();
        expect(yearOptions[2]).toBe(currentYear + 1);
    });

    it('prjTypeOptions는 ["신규", "계속"] 두 항목을 포함한다', () => {
        const { prjTypeOptions } = useProjectOptions();
        expect(prjTypeOptions).toEqual(['신규', '계속']);
    });

    it('prjTypeOptions는 2개 항목을 갖는다', () => {
        const { prjTypeOptions } = useProjectOptions();
        expect(prjTypeOptions).toHaveLength(2);
    });
});
