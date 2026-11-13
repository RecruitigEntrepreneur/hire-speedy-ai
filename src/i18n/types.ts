/** Form einer Übersetzungsdatei: dieselben Schlüssel wie die deutsche, Werte frei. */
export type Messages<T> = { [K in keyof T]: T[K] extends string ? string : Messages<T[K]> };
