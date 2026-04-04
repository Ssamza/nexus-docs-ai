import es from "../locales/es.json";

type DeepValue<T> = T extends object
  ? { [K in keyof T]: DeepValue<T[K]> }
  : T;

export const t = es as DeepValue<typeof es>;
