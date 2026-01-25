import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

// 타입 re-export (기존 코드와의 호환성 유지)
export * from '~/types/auth';

export const useAuth = () => {
    const store = useAuthStore();
    
    // State를 ref로 변환하여 반응성 유지
    const { user, accessToken, refreshToken, isAuthenticated } = storeToRefs(store);

    return {
        user,
        accessToken,
        refreshToken,
        isAuthenticated, // getter도 storeToRefs로 가져올 수 있음
        login: store.login,
        logout: store.logout,
        refresh: store.refresh,
        restoreSession: store.restoreSession
    };
};
