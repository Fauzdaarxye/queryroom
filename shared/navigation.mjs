export const pagePath = view => ({login:'/login', dashboard:'/dashboard', questions:'/questions', leaderboard:'/leaderboard', practice:'/practice', onboarding:'/onboarding', profile:'/profile'}[view] || '/login');
export function resolvePage(pathname, user, hasProblem = false) {
  const requested = hasProblem || pathname === '/practice' ? 'practice'
    : pathname === '/leaderboard' ? 'leaderboard' : pathname === '/questions' ? 'questions' : pathname === '/dashboard' ? 'dashboard' : pathname === '/profile' ? 'profile'
      : pathname === '/onboarding' ? 'onboarding' : 'login';
  if (user && !user.profileComplete) return 'onboarding';
  if (user && ['login', 'onboarding'].includes(requested)) return 'dashboard';
  if (!user && ['profile', 'onboarding'].includes(requested)) return 'login';
  return requested;
}
