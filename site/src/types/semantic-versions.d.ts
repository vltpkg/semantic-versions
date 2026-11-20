// The reference parser ships untyped JavaScript; this is the part of its API
// the site uses. See libraries/javascript/README.md for the whole.
declare module "semantic-versions" {
  export class Version {
    constructor(version: string | Version);
    context: string | null;
    major: number;
    minor: number;
    patch: number;
    prerelease: (string | number)[];
    build: string[];
    /** The bare version, without its context. */
    version: string;
    /** `context@version`, or the version when it has no context. */
    reference: string;
    compare(other: string | Version): -1 | 0 | 1;
    toString(): string;
  }
  export class Comparator {
    constructor(comp: string);
    operator: string;
    value: string;
    /** True for the empty comparator (`*`), which has no version. */
    ANY?: boolean;
    /** The build channel the comparator filters by; empty when it has none. */
    channel: string[];
    /** The comparator's version without its build: what the bound is compared on. */
    core: Version;
    test(version: string | Version): boolean;
  }
  export class Range {
    constructor(range: string);
    context: string | null;
    /** The desugared range: comparator sets joined by `||`. */
    range: string;
    set: Comparator[][];
    test(version: string | Version): boolean;
    intersects(other: Range): boolean;
  }
  export const splitReference: (str: string) => { context: string | null; rest: string };
  export const parse: (version: string) => Version | null;
  export const valid: (version: string) => string | null;
  export const validRange: (range: string) => string | null;
  export const satisfies: (version: string | Version, range: string | Range) => boolean;
  export const compare: (a: string | Version, b: string | Version) => -1 | 0 | 1;
  export const sort: (versions: (string | Version)[]) => (string | Version)[];
  export const rsort: (versions: (string | Version)[]) => (string | Version)[];
  export const maxSatisfying: (versions: string[], range: string) => string | null;
  export const minSatisfying: (versions: string[], range: string) => string | null;
  export const minimum: (range: string) => Version | null;
  export const diff: (a: string, b: string) => string | null;
  export const increment: (version: string, release: string, identifier?: string, identifierBase?: string | false) => string | null;
  export const intersects: (a: string, b: string) => boolean;
  export const subset: (sub: string, sup: string) => boolean;
  export const simplify: (versions: string[], range: string) => string;
}
