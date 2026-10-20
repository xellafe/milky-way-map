/** Lifecycle of a lazily fetched data file (#36, SPEC §10). */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
