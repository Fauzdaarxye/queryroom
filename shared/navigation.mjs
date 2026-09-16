export const pagePath = (view) =>
  ({
    admin: '/admin',
    login: '/login',
    dashboard: '/dashboard',
    questions: '/questions',
    leaderboard: '/leaderboard',
    practice: '/practice',
    onboarding: '/onboarding',
    profile: '/profile',
  })[view] || '/login';
export function resolvePage(pathname, user, hasProblem = false) {
  const requested =
    pathname === '/admin'
      ? 'admin'
      : hasProblem || pathname === '/practice'
        ? 'practice'
        : pathname === '/leaderboard'
          ? 'leaderboard'
          : pathname === '/questions'
            ? 'questions'
            : pathname === '/dashboard'
              ? 'dashboard'
              : pathname === '/profile'
                ? 'profile'
                : pathname === '/onboarding'
                  ? 'onboarding'
                  : 'login';
  if (requested === 'admin' && user?.role !== 'admin') return user ? 'dashboard' : 'login';
  if (user && !user.profileComplete) return 'onboarding';
  if (user && ['login', 'onboarding'].includes(requested)) return 'dashboard';
  if (!user && ['profile', 'onboarding'].includes(requested)) return 'login';
  return requested;
}
