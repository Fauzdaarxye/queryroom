const reserved = new Set(['admin', 'administrator', 'api', 'dashboard', 'google', 'guest', 'help', 'login', 'logout', 'onboarding', 'practice', 'profile', 'queryroom', 'root', 'settings', 'signup', 'support']);

export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter your profile details.');
  if (Object.keys(input).some(key => !['username', 'fullName', 'age', 'profession'].includes(key))) throw new Error('Only username, full name, age, and profession can be changed.');
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim().replace(/\s+/g, ' ') : '';
  const profession = typeof input.profession === 'string' ? input.profession.trim().replace(/\s+/g, ' ') : '';
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username) || reserved.has(username)) throw new Error('Choose a username with 3–24 letters, numbers, or underscores, starting with a letter. This username may be reserved.');
  if (!fullName || fullName.length > 100 || /[\u0000-\u001f\u007f]/.test(fullName)) throw new Error('Enter your full name using 1–100 characters.');
  if (!Number.isInteger(input.age) || input.age < 1 || input.age > 120) throw new Error('Enter a whole-number age between 1 and 120.');
  if (!profession || profession.length > 80 || /[\u0000-\u001f\u007f]/.test(profession)) throw new Error('Enter your profession using 1–80 characters.');
  return { username, fullName, age: input.age, profession };
}
