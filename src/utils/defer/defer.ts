import { setDeferBase } from 'src/utils/defer/base';
import { errorLogger } from 'src/utils/errorLogger';
import { AnyFunc } from 'src/utils/function/types';

const SCOPE_KEY = 'def';

export const setDefer = (
    ctx: Window,
    fn: AnyFunc,
    timeOut: number,
    errorScope?: string,
) => {
    return setDeferBase(
        ctx,
        errorLogger(ctx, `d.err.${errorScope || SCOPE_KEY}`, fn),
        timeOut,
    );
};

export const setDeferInterval = (
    ctx: Window,
    fn: AnyFunc,
    timeOut: number,
    errorScope?: string,
) => {
    return ctx.setInterval(
        errorLogger(ctx, `i.err.${errorScope || SCOPE_KEY}`, fn),
        timeOut,
    );
};

export const clearDeferInterval = (ctx: Window, deferIntervalId: number) => {
    return ctx.clearInterval(deferIntervalId);
};
