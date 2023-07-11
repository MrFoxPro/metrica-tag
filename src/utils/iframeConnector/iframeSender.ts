import { CounterOptions, getCounterKey } from 'src/utils/counterOptions';
import { cFilter, includes, cForEach } from 'src/utils/array';
import {
    pipe,
    firstArg,
    memo,
    asSideEffect,
    bindArg,
    secondArg,
    bindArgs,
} from 'src/utils/function';
import { errorLogger } from 'src/utils/errorLogger';
import { cKeys, mix } from 'src/utils/object';
import { PolyPromise } from 'src/utils';
import { setDefer, clearDefer } from 'src/utils/defer';
import { createKnownError } from 'src/utils/errorLogger/knownError';
import { counterIframeConnector } from './iframeConnector';
import { parseDecimalInt } from '../number';
import {
    IframeCollection,
    IframeInfo,
    MessageData,
    MessageHandler,
    BufferItem,
} from './types';

import {
    SEND_TIMEOUT,
    INIT_MESSAGE_PARENT,
    INIT_MESSAGE,
    IFRAME_MESSAGE_COUNTER_ID,
    IFRAME_MESSAGE_TO_COUNTER,
} from './const';

export const sendToMany = (
    ctx: Window,
    sendToFrame: (win: Window, m: MessageData, h: MessageHandler) => void,
    dict: IframeCollection,
    item: BufferItem,
    data: MessageData,
): Promise<MessageData> => {
    const newItem = item;
    const promise = new PolyPromise<MessageData>((resolve, reject) => {
        const counterList = cKeys(dict);
        const resolveAll = pipe(
            newItem.resolve ? newItem.resolve : firstArg,
            asSideEffect(resolve),
        );
        const rejectAll = pipe(
            newItem.reject ? newItem.reject : firstArg,
            asSideEffect(reject),
        );
        newItem.resolve = resolveAll;
        newItem.reject = rejectAll;
        cForEach((counterId: string) => {
            newItem.tryTo.push(+counterId);
            const childInfo = dict[counterId];
            const timeOut = setDefer(
                ctx,
                bindArg(createKnownError(), rejectAll),
                SEND_TIMEOUT + 100,
                'is.m',
            );
            sendToFrame(
                childInfo.window,
                mix(data, {
                    [IFRAME_MESSAGE_TO_COUNTER]: parseDecimalInt(counterId),
                }),
                (_, frameData) => {
                    clearDefer(ctx, timeOut);
                    newItem.sendedTo.push(counterId);
                    if (newItem.resolve) {
                        newItem.resolve(frameData);
                    }
                },
            );
        }, counterList);
    });
    return promise.catch(errorLogger(ctx, 'if.b'));
};

export const resend = (
    sendToManyFn: (
        dict: IframeCollection,
        newItem: BufferItem,
        data: MessageData,
    ) => Promise<MessageData>,
    itemList: BufferItem[],
    iframeInfo: IframeInfo,
) => {
    const items = cFilter((val: BufferItem) => {
        return !includes(iframeInfo.info[IFRAME_MESSAGE_COUNTER_ID], val.tryTo);
    }, itemList);
    cForEach((newItem: BufferItem) => {
        if (!iframeInfo.info[IFRAME_MESSAGE_COUNTER_ID]) {
            return;
        }
        sendToManyFn(
            {
                [iframeInfo.info[IFRAME_MESSAGE_COUNTER_ID]!]: iframeInfo,
            },
            newItem,
            newItem.data,
        );
    }, items);
};

export const iframeSender = (ctx: Window, options: CounterOptions) => {
    const iframeConnectorData = counterIframeConnector(ctx, options);

    const buffer: {
        children: BufferItem[];
        parent: BufferItem[];
    } = {
        children: [],
        parent: [],
    };

    if (!iframeConnectorData) {
        return null;
    }
    const sendToManyFn = bindArgs(
        [ctx, iframeConnectorData.sendToFrame],
        sendToMany,
    ) as (
        dict: IframeCollection,
        item: BufferItem,
        data: MessageData,
    ) => Promise<MessageData>;
    const resendFn = bindArg(sendToManyFn, resend);

    iframeConnectorData.emitter
        .on([INIT_MESSAGE_PARENT], ([, message]) => {
            resendFn(
                buffer.children,
                iframeConnectorData.children[
                    message[IFRAME_MESSAGE_COUNTER_ID]!
                ],
            );
        })
        .on([INIT_MESSAGE], ([, message]) => {
            resendFn(
                buffer.parent,
                iframeConnectorData.parents[
                    message[IFRAME_MESSAGE_COUNTER_ID]!
                ],
            );
        });
    return {
        emitter: iframeConnectorData.emitter,
        sendToIframe: (iframeCtx: Window, frameData: MessageData) => {
            return new PolyPromise((resolve, reject) => {
                iframeConnectorData.sendToFrame(
                    iframeCtx,
                    frameData,
                    (e, data) => {
                        resolve([e, data]);
                    },
                );
                setDefer(
                    ctx,
                    bindArg(createKnownError(), reject),
                    SEND_TIMEOUT + 100,
                    'is.o',
                );
            });
        },
        sendToChildren: (data: MessageData): Promise<MessageData> => {
            const newItem: BufferItem = {
                sendedTo: [],
                tryTo: [],
                data,
            };
            buffer.children.push(newItem);
            return sendToManyFn(iframeConnectorData.children, newItem, data);
        },
        sendToParents: (data: MessageData): Promise<MessageData> => {
            const newItem: BufferItem = {
                sendedTo: [],
                tryTo: [],
                data,
            };
            buffer.parent.push(newItem);
            return sendToManyFn(iframeConnectorData.parents, newItem, data);
        },
    };
};
export const counterIframeSender = memo(
    iframeSender,
    pipe(secondArg, getCounterKey),
);
