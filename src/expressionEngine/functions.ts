import { ExpressionError } from './types';

export type BuiltinFunction = (args: any[], sourceExpr: string) => any;

function assertMinArgs(name: string, args: any[], min: number, sourceExpr: string) {
    if (args.length < min) {
        throw new ExpressionError(`${name}() requires at least ${min} argument(s), got ${args.length}`, sourceExpr);
    }
}

function toStr(v: any): string {
    if (v === null || v === undefined) { return ''; }
    if (typeof v === 'object') { return JSON.stringify(v); }
    return String(v);
}

const builtins: Record<string, BuiltinFunction> = {
    eq(args, src) {
        assertMinArgs('eq', args, 2, src);
        return toStr(args[0]).toLowerCase() === toStr(args[1]).toLowerCase();
    },
    ne(args, src) {
        assertMinArgs('ne', args, 2, src);
        return toStr(args[0]).toLowerCase() !== toStr(args[1]).toLowerCase();
    },
    not(args, src) {
        assertMinArgs('not', args, 1, src);
        return !args[0];
    },
    and(args, src) {
        assertMinArgs('and', args, 2, src);
        return args.every((a: any) => !!a);
    },
    or(args, src) {
        assertMinArgs('or', args, 2, src);
        return args.some((a: any) => !!a);
    },
    xor(args, src) {
        assertMinArgs('xor', args, 2, src);
        return !!args[0] !== !!args[1];
    },
    contains(args, src) {
        assertMinArgs('contains', args, 2, src);
        const haystack = toStr(args[0]).toLowerCase();
        const needle = toStr(args[1]).toLowerCase();
        return haystack.includes(needle);
    },
    containsValue(args, src) {
        assertMinArgs('containsValue', args, 2, src);
        const collection = args[0];
        const target = toStr(args[1]).toLowerCase();
        if (Array.isArray(collection)) {
            return collection.some(item => toStr(item).toLowerCase() === target);
        }
        if (typeof collection === 'object' && collection !== null) {
            return Object.values(collection).some(val => toStr(val).toLowerCase() === target);
        }
        return false;
    },
    startsWith(args, src) {
        assertMinArgs('startsWith', args, 2, src);
        return toStr(args[0]).toLowerCase().startsWith(toStr(args[1]).toLowerCase());
    },
    endsWith(args, src) {
        assertMinArgs('endsWith', args, 2, src);
        return toStr(args[0]).toLowerCase().endsWith(toStr(args[1]).toLowerCase());
    },
    ge(args, src) {
        assertMinArgs('ge', args, 2, src);
        return Number(args[0]) >= Number(args[1]);
    },
    gt(args, src) {
        assertMinArgs('gt', args, 2, src);
        return Number(args[0]) > Number(args[1]);
    },
    le(args, src) {
        assertMinArgs('le', args, 2, src);
        return Number(args[0]) <= Number(args[1]);
    },
    lt(args, src) {
        assertMinArgs('lt', args, 2, src);
        return Number(args[0]) < Number(args[1]);
    },
    iif(args, src) {
        assertMinArgs('iif', args, 1, src);
        return !!args[0] ? (args[1] ?? null) : (args[2] ?? null);
    },
    format(args, src) {
        assertMinArgs('format', args, 1, src);
        let fmt = toStr(args[0]);
        for (let i = 1; i < args.length; i++) {
            fmt = fmt.replace(new RegExp(`\\{${i - 1}\\}`, 'g'), toStr(args[i]));
        }
        return fmt;
    },
    join(args, src) {
        assertMinArgs('join', args, 2, src);
        const sep = toStr(args[0]);
        const collection = args[1];
        if (!Array.isArray(collection)) {
            return toStr(collection);
        }
        return collection.map(toStr).join(sep);
    },
    split(args, src) {
        assertMinArgs('split', args, 2, src);
        return toStr(args[0]).split(toStr(args[1]));
    },
    coalesce(args, _src) {
        for (const a of args) {
            if (a !== null && a !== undefined && a !== '') {
                return a;
            }
        }
        return null;
    },
    convertToJson(args, src) {
        assertMinArgs('convertToJson', args, 1, src);
        return JSON.stringify(args[0]);
    },
    length(args, src) {
        assertMinArgs('length', args, 1, src);
        const v = args[0];
        if (Array.isArray(v)) { return v.length; }
        if (typeof v === 'string') { return v.length; }
        if (typeof v === 'object' && v !== null) { return Object.keys(v).length; }
        throw new ExpressionError('length() argument must be a string, array, or object', src);
    },
    counter(args, src) {
        assertMinArgs('counter', args, 2, src);
        // counter is runtime-only; return the seed value
        return typeof args[1] === 'number' ? args[1] : parseInt(toStr(args[1]), 10) || 0;
    },
    lower(args, src) {
        assertMinArgs('lower', args, 1, src);
        return toStr(args[0]).toLowerCase();
    },
    upper(args, src) {
        assertMinArgs('upper', args, 1, src);
        return toStr(args[0]).toUpperCase();
    },
    trim(args, src) {
        assertMinArgs('trim', args, 1, src);
        return toStr(args[0]).trim();
    },
    replace(args, src) {
        assertMinArgs('replace', args, 3, src);
        return toStr(args[0]).split(toStr(args[1])).join(toStr(args[2]));
    },
    in(args, src) {
        assertMinArgs('in', args, 2, src);
        const needle = toStr(args[0]).toLowerCase();
        for (let i = 1; i < args.length; i++) {
            if (toStr(args[i]).toLowerCase() === needle) { return true; }
        }
        return false;
    },
    notIn(args, src) {
        return !builtins.in(args, src);
    },
};

export function getBuiltinFunction(name: string): BuiltinFunction | undefined {
    return builtins[name];
}

export function isBuiltinFunction(name: string): boolean {
    return name in builtins;
}
