import { defineStore } from 'pinia';
import type { LoginRequest, LoginResponse, User } from '~/types/auth';

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const accessToken = ref<string | null>(null);
    const refreshToken = ref<string | null>(null);

    const isAuthenticated = computed(() => !!accessToken.value && !!user.value);

    // API URL
    const config = useRuntimeConfig();
    const API_BASE_URL = `${config.public.apiBase}/api/auth`;

    // 로그인
    const login = async (credentials: LoginRequest): Promise<void> => {
        try {
            // Store 내부에서는 $fetch를 직접 사용하거나, 
            // 플러그인에서 주입된 $apiFetch를 사용해야 하는데, 
            // 여기서는 순환 참조를 피하기 위해 기본 $fetch를 사용하고
            // 요청 시 필요한 처리를 직접 합니다.
            const response = await $fetch<LoginResponse>(`${API_BASE_URL}/login`, {
                method: 'POST',
                body: credentials
            });

            // 상태 업데이트
            setAuth(response);

            // 로컬 스토리지 저장
            if (process.client) {
                saveToStorage();
            }
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    // 로그아웃
    const logout = async (): Promise<void> => {
        try {
            if (accessToken.value) {
                // 로그아웃 API 호출 (실패해도 무시)
                await $fetch(`${API_BASE_URL}/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken.value}`
                    }
                }).catch(err => {
                    console.log('Logout API call failed (expected if token expired):', err);
                });
            }
        } finally {
            // 상태 초기화
            clearAuth();
        }
    };

    // 토큰 갱신
    const refresh = async (): Promise<boolean> => {
        if (!refreshToken.value) {
            return false;
        }

        try {
            const response = await $fetch<LoginResponse>(`${API_BASE_URL}/refresh`, {
                method: 'POST',
                body: {
                    refreshToken: refreshToken.value
                }
            });

            // 새 토큰 저장
            accessToken.value = response.accessToken;
            refreshToken.value = response.refreshToken;
            
            if (process.client) {
                localStorage.setItem('accessToken', response.accessToken);
                localStorage.setItem('refreshToken', response.refreshToken);
            }

            return true;
        } catch (error) {
            console.error('Token refresh failed:', error);
            await logout();
            return false;
        }
    };

    // 세션 복원
    const restoreSession = (): void => {
        if (process.client) {
            const storedAccessToken = localStorage.getItem('accessToken');
            const storedRefreshToken = localStorage.getItem('refreshToken');
            const storedUser = localStorage.getItem('user');

            if (storedAccessToken && storedRefreshToken && storedUser) {
                try {
                    accessToken.value = storedAccessToken;
                    refreshToken.value = storedRefreshToken;
                    user.value = JSON.parse(storedUser);
                } catch {
                    clearAuth();
                }
            }
        }
    };

    // Helper: 인증 정보 설정
    const setAuth = (data: LoginResponse) => {
        accessToken.value = data.accessToken;
        refreshToken.value = data.refreshToken;
        user.value = {
            eno: data.eno,
            empNm: data.empNm
        };
    };

    // Helper: 로컬 스토리지 저장
    const saveToStorage = () => {
        if (accessToken.value) localStorage.setItem('accessToken', accessToken.value);
        if (refreshToken.value) localStorage.setItem('refreshToken', refreshToken.value);
        if (user.value) localStorage.setItem('user', JSON.stringify(user.value));
    };

    // Helper: 인증 정보 초기화
    const clearAuth = () => {
        accessToken.value = null;
        refreshToken.value = null;
        user.value = null;

        if (process.client) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        }
    };

    return {
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        login,
        logout,
        refresh,
        restoreSession
    };
});
