/**
 * ============================================================================
 * [composables/useAdminTableEdit.ts] 관리자 테이블 조회/편집 모드 Composable
 * ============================================================================
 * /info/cost/index.vue 의 view/edit 패턴을 관리자 CRUD 테이블에서 재사용합니다.
 *
 * [편집 모드 흐름]
 *  1. enterEditMode(): sourceData 깊은 복사 → editRows 초기화 (스냅샷 저장)
 *  2. 셀 편집 시 markDirty() → _status='modified' 표시
 *  3. 삭제 아이콘 클릭 → deleteRow() → _status='deleted' (취소선 적용)
 *  4. 복구 아이콘 클릭 → deleteRow() 재호출 → _status 복원
 *  5. [저장] → saveAndExitEdit() → 신규/수정/삭제 분류 → onBatchSave 콜백
 *  6. [취소] → cancelEdit() → 스냅샷으로 복원
 *
 * [입력 파라미터]
 *  - sourceData : useApiFetch data Ref (읽기 전용 원본)
 *  - onBatchSave: 변경 행을 분류해서 API 호출 + refresh 까지 포함하는 콜백
 *  - toast      : PrimeVue Toast 인스턴스
 *  - makeBlankRow: (선택) 인라인 행 추가 시 빈 행 팩토리
 * ============================================================================
 */
import { ref, type Ref } from 'vue'
import type { ToastServiceMethods } from 'primevue/toastservice'

/** 행 변경 상태 */
export type AdminRowStatus = 'new' | 'modified' | 'deleted'

/** 변경 추적 메타 필드가 추가된 행 타입 */
export type WithAdminStatus<T> = T & {
    _status?: AdminRowStatus
    _localId?: string
}

/** onBatchSave 콜백에 전달되는 파라미터 */
export interface BatchSaveParams<T> {
    newRows: T[]
    modifiedRows: T[]
    deletedRows: T[]
}

interface UseAdminTableEditOptions<T extends object> {
    /** useApiFetch 의 data Ref (편집 전 원본, null 또는 undefined 모두 허용) */
    sourceData: Ref<T[] | null | undefined>
    /** 신규/수정/삭제 행을 API 호출 + refresh 처리하는 콜백 */
    onBatchSave: (params: BatchSaveParams<T>) => Promise<void>
    /** PrimeVue Toast 인스턴스 */
    toast: ToastServiceMethods
    /** (선택) 인라인 행 추가용 빈 행 팩토리 */
    makeBlankRow?: () => T
}

export function useAdminTableEdit<T extends object>({
    sourceData,
    onBatchSave,
    toast,
    makeBlankRow,
}: UseAdminTableEditOptions<T>) {
    const viewMode = ref<'view' | 'edit'>('view')
    // 편집 모드에서의 작업 복사본
    const editRows = ref<WithAdminStatus<T>[]>([]) as Ref<WithAdminStatus<T>[]>
    // 체크박스 선택 행
    const selectedRows = ref<WithAdminStatus<T>[]>([]) as Ref<WithAdminStatus<T>[]>
    const saving = ref(false)
    // 취소 시 복원용 JSON 스냅샷
    let snapshot = '[]'
    let localIdSeq = 0

    /**
     * 편집 모드 진입: sourceData 깊은 복사 후 스냅샷 저장
     */
    const enterEditMode = () => {
        const cloned = JSON.parse(JSON.stringify(sourceData.value ?? []))
        editRows.value = cloned
        snapshot = JSON.stringify(cloned)
        selectedRows.value = []
        viewMode.value = 'edit'
    }

    /**
     * 편집 취소: JSON 스냅샷으로 editRows 복원
     */
    const cancelEdit = () => {
        editRows.value = JSON.parse(snapshot)
        selectedRows.value = []
        viewMode.value = 'view'
    }

    /** 행 변경 상태 반환 */
    const rowStatus = (row: WithAdminStatus<T>): AdminRowStatus | undefined => row._status

    /**
     * row-class 함수: 삭제 표시 행에 'row-deleted' 반환
     * StyledDataTable 이 'row-deleted' 클래스를 회색 배경 + 취소선으로 자동 처리
     */
    const rowClass = (row: WithAdminStatus<T>): string | undefined =>
        row._status === 'deleted' ? 'row-deleted' : undefined

    /**
     * 행 편집 가능 여부: 편집 모드이고 삭제 표시가 아닌 경우 true
     * InlineEditCell 의 :force-edit 과 :readonly 에 사용
     */
    const isRowEditing = (row: WithAdminStatus<T>): boolean =>
        viewMode.value === 'edit' && row._status !== 'deleted'

    /**
     * 행을 '수정' 상태로 표시 (신규/삭제 상태는 유지)
     * InlineEditCell 의 @save 이벤트에 연결
     */
    const markDirty = (row: WithAdminStatus<T>) => {
        if (!row._status) row._status = 'modified'
    }

    /**
     * 삭제 토글:
     *  - _status='new'     → editRows 에서 즉시 제거
     *  - _status='deleted' → _status 복원(undefined)
     *  - 그 외            → _status='deleted'
     */
    const deleteRow = (row: WithAdminStatus<T>) => {
        if (row._status === 'new') {
            editRows.value = editRows.value.filter(r => r !== row)
            selectedRows.value = selectedRows.value.filter(r => r !== row)
        } else if (row._status === 'deleted') {
            row._status = undefined
        } else {
            row._status = 'deleted'
        }
    }

    /** 체크박스로 선택된 행 일괄 삭제 표시 */
    const deleteSelectedRows = () => {
        for (const row of [...selectedRows.value]) {
            if (row._status === 'new') {
                editRows.value = editRows.value.filter(r => r !== row)
            } else {
                row._status = 'deleted'
            }
        }
        selectedRows.value = []
    }

    /**
     * 인라인 행 추가: makeBlankRow 미제공 시 no-op
     * _status='new', _localId 할당 후 editRows 맨 앞에 삽입
     */
    const addRow = () => {
        if (!makeBlankRow) return
        const blank = makeBlankRow() as WithAdminStatus<T>
        blank._status = 'new'
        blank._localId = `_new_${++localIdSeq}`
        editRows.value = [blank, ...editRows.value]
    }

    /** 내부 메타 필드(_status, _localId) 제거 후 순수 데이터 반환 */
    const cleanRow = (row: WithAdminStatus<T>): T => {
        const cleaned = { ...row } as Record<string, unknown>
        delete cleaned._status
        delete cleaned._localId
        return cleaned as unknown as T
    }

    /**
     * 일괄 저장:
     *  - 변경 없으면 단순 모드 전환
     *  - 변경 있으면 onBatchSave 콜백 호출 (실패 시 에러 토스트, 모드는 유지)
     */
    const saveAndExitEdit = async () => {
        const newRows = editRows.value.filter(r => r._status === 'new').map(cleanRow)
        const modifiedRows = editRows.value.filter(r => r._status === 'modified').map(cleanRow)
        const deletedRows = editRows.value.filter(r => r._status === 'deleted').map(cleanRow)

        if (!newRows.length && !modifiedRows.length && !deletedRows.length) {
            viewMode.value = 'view'
            selectedRows.value = []
            return
        }

        saving.value = true
        try {
            await onBatchSave({ newRows, modifiedRows, deletedRows })
            viewMode.value = 'view'
            selectedRows.value = []
        } catch {
            toast.add({ severity: 'error', summary: '저장 실패', detail: '일괄 저장 중 오류가 발생했습니다.', life: 5000 })
        } finally {
            saving.value = false
        }
    }

    return {
        viewMode: viewMode as Ref<'view' | 'edit'>,
        editRows,
        selectedRows,
        saving,
        enterEditMode,
        cancelEdit,
        saveAndExitEdit,
        addRow,
        rowStatus,
        rowClass,
        isRowEditing,
        markDirty,
        deleteRow,
        deleteSelectedRows,
    }
}
