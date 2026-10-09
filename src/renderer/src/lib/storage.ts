/**
 * Profil başına ayrılmış localStorage anahtarları.
 * Aynı bilgisayarda birden çok profil olduğu için bağlam, Pomodoro durumu gibi küçük tercihler de
 * profiller arasında paylaşılmaz: "cc:<profilId>:<ad>".
 */

let profileId = 'anon'

export function setStorageProfile(id: string | null): void {
  profileId = id ?? 'anon'
}

export const skey = (name: string): string => `cc:${profileId}:${name}`

export function sget(name: string): string | null {
  try {
    return localStorage.getItem(skey(name))
  } catch {
    return null
  }
}

export function sset(name: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(skey(name))
    else localStorage.setItem(skey(name), value)
  } catch {
    // gizli modda saklanamaz; sadece bu oturum için geçerli
  }
}
