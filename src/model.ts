export type IconRef = { kind: 'emoji'; value: string } | { kind: 'mdi'; value: string }; // mdi value e.g. "mdi:gift"

export interface Jar { id: string; name: string; icon: IconRef; current: number; goal: number }

export interface SharedJar { id: string; name: string; icon: IconRef; goal: number; contributions: Record<string, number> } // kidId -> points

/** Present when TaskMate reports the kid's birthday today; `age` only when TaskMate gives one. */
export interface KidBirthday { age?: number }

export interface Kid { id: string; name: string; colour: string; avatar: IconRef; avatarImage?: string; points: number; jars: Jar[]; found: boolean; birthday?: KidBirthday }

export interface BoardModel { status: 'ok' | 'missing'; kids: Kid[]; sharedJars: SharedJar[] }
