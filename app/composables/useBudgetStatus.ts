/**
 * ============================================================================
 * [useBudgetStatus] 예산 현황 Composable
 * ============================================================================
 * 예산 현황 화면의 3개 탭 데이터를 조회하는 API 호출 함수를 제공합니다.
 * useApiFetch를 사용하여 반응형 데이터 조회 + 자동 인증을 지원합니다.
 *
 * [제공 기능]
 *  - fetchProjectStatus  : 정보화사업 예산 현황 조회
 *  - fetchCostStatus     : 전산업무비 예산 현황 조회
 *  - fetchOrdinaryStatus : 경상사업 예산 현황 조회
 *
 * // Design Ref: §4.8 — useBudgetStatus.ts
 * ============================================================================
 */

import type { Ref } from 'vue'
import type { ProjectStatusItem, CostStatusItem, OrdinaryStatusItem } from '~/types/budgetStatus'

/**
 * 예산 현황 API 호출 Composable
 *
 * @returns API 호출 함수 객체
 */
export const useBudgetStatus = () => {
    const config = useRuntimeConfig()
    const API_BASE_URL = `${config.public.apiBase}/api/budget/status`

    /**
     * 정보화사업 예산 현황 조회
     *
     * @param bgYy 예산년도 (Ref로 전달 시 값 변경에 자동 재조회)
     * @returns useApiFetch 반환값 ({ data, pending, error, refresh })
     */
    const fetchProjectStatus = (bgYy: Ref<string>) => {
        return useApiFetch<ProjectStatusItem[]>(`${API_BASE_URL}/projects`, {
            query: { bgYy }
        })
    }

    /**
     * 전산업무비 예산 현황 조회
     *
     * @param bgYy 예산년도 (Ref로 전달 시 값 변경에 자동 재조회)
     * @returns useApiFetch 반환값 ({ data, pending, error, refresh })
     */
    const fetchCostStatus = (bgYy: Ref<string>) => {
        return useApiFetch<CostStatusItem[]>(`${API_BASE_URL}/costs`, {
            query: { bgYy }
        })
    }

    /**
     * 경상사업 예산 현황 조회
     *
     * @param bgYy 예산년도 (Ref로 전달 시 값 변경에 자동 재조회)
     * @returns useApiFetch 반환값 ({ data, pending, error, refresh })
     */
    const fetchOrdinaryStatus = (bgYy: Ref<string>) => {
        return useApiFetch<OrdinaryStatusItem[]>(`${API_BASE_URL}/ordinary`, {
            query: { bgYy }
        })
    }

    return { fetchProjectStatus, fetchCostStatus, fetchOrdinaryStatus }
}
