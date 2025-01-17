import {
    INTERNAL_PARAMS_KEY,
    METHOD_NAME_PARAMS,
} from 'src/providers/params/const';
import { CounterOptions, getCounterKey } from 'src/utils/counterOptions';
import { ctxErrorLogger } from 'src/utils/errorLogger';
import { getConsole } from 'src/utils/console';
import { getCounterInstance } from 'src/utils/counter';
import { isNumber } from 'src/utils/number';
import { genPath } from 'src/utils/object';
import { isString } from 'src/utils/string';
import { noop } from 'src/utils/function';
import { AnyFunc } from 'src/utils/function/types';
import {
    METHOD_NAME_SET_USER_ID,
    SetUserIDHandler,
    USER_ID_PARAM,
} from './const';

export const rawSetUserID = (
    ctx: Window,
    counterOptions: CounterOptions,
): { [METHOD_NAME_SET_USER_ID]: SetUserIDHandler<void> } => {
    return {
        [METHOD_NAME_SET_USER_ID]: (
            id: unknown,
            callback?: AnyFunc,
            callbackCtx?: Window,
        ) => {
            if (!isString(id) && !isNumber(ctx, id)) {
                const ctxConsole = getConsole(
                    ctx,
                    getCounterKey(counterOptions),
                );
                ctxConsole.error('Incorrect user ID');
                return;
            }

            const counterInstance = getCounterInstance(ctx, counterOptions);
            const newData = genPath([INTERNAL_PARAMS_KEY, USER_ID_PARAM, id]);

            counterInstance![METHOD_NAME_PARAMS]!(
                newData,
                callback || noop,
                callbackCtx,
            );
        },
    };
};

/**
 * Method for transmitting the user ID set by the site owner
 * @param ctx - Current window
 * @param counterOptions - Counter options on initialization
 */
export const setUserID = ctxErrorLogger('suid.int', rawSetUserID);
