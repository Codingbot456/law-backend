export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type Awaitable<T> = T | Promise<T>;
export type RequestInput = {
    /**
     * The URL the request will use.
     */
    url: URL;
    /**
     * Options used to create a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request/Request).
     */
    options?: RequestInit | undefined;
};
export interface HTTPClientOptions {
    fetcher?: Fetcher;
}
export type BeforeRequestHook = (req: Request) => Awaitable<Request | void>;
export type RequestErrorHook = (err: unknown, req: Request) => Awaitable<void>;
export type ResponseHook = (res: Response, req: Request) => Awaitable<void>;
export declare class HTTPClient {
    private options;
    private fetcher;
    private requestHooks;
    private requestErrorHooks;
    private responseHooks;
    constructor(options?: HTTPClientOptions);
    request(request: Request): Promise<Response>;
    /**
     * Registers a hook that is called before a request is made. The hook function
     * can mutate the request or return a new request. This may be useful to add
     * additional information to request such as request IDs and tracing headers.
     */
    addHook(hook: "beforeRequest", fn: BeforeRequestHook): this;
    /**
     * Registers a hook that is called when a request cannot be made due to a
     * network error.
     */
    addHook(hook: "requestError", fn: RequestErrorHook): this;
    /**
     * Registers a hook that is called when a response has been received from the
     * server.
     */
    addHook(hook: "response", fn: ResponseHook): this;
    /** Removes a hook that was previously registered with `addHook`. */
    removeHook(hook: "beforeRequest", fn: BeforeRequestHook): this;
    /** Removes a hook that was previously registered with `addHook`. */
    removeHook(hook: "requestError", fn: RequestErrorHook): this;
    /** Removes a hook that was previously registered with `addHook`. */
    removeHook(hook: "response", fn: ResponseHook): this;
    clone(): HTTPClient;
}
export type StatusCodePredicate = number | string | (number | string)[];
export declare function matchStatusCode(response: Response, codes: StatusCodePredicate): boolean;
export declare function matchResponse(response: Response, code: StatusCodePredicate, contentTypePattern: string): boolean;
export declare function unpackHeaders(headers: Headers): Record<string, string[]>;
type ResponseMatcherSchema<T> = {
    parse: (data: unknown) => T;
} | {
    inboundSchema: {
        parse: (data: unknown) => T;
    };
};
type ResponsePredicateOptions = {
    /** Content type to match on. */
    ctype?: string;
    /** Pass HTTP headers to deserializer. */
    hdrs?: boolean;
} & ({
    /** The result key to store the deserialized value into. */
    key?: string;
    fail?: never;
    err?: never;
} | {
    /** Indicates the matched response must throw the built-in error. */
    fail: true;
    key?: never;
    err?: never;
} | {
    /** Indicates the matched response is a custom error. */
    err: true;
    key?: never;
    fail?: never;
});
export declare class ResponseMatcher<Result> {
    #private;
    private predicates;
    json<T extends Result | Error>(codes: StatusCodePredicate, schema: ResponseMatcherSchema<T>, opts?: ResponsePredicateOptions): this;
    bytes<T extends Result | Error>(codes: StatusCodePredicate, schema: ResponseMatcherSchema<T>, opts?: ResponsePredicateOptions): this;
    stream<T extends Result | Error>(codes: StatusCodePredicate, schema: ResponseMatcherSchema<T>, opts?: ResponsePredicateOptions): this;
    text<T extends Result | Error>(codes: StatusCodePredicate, schema: ResponseMatcherSchema<T>, opts?: ResponsePredicateOptions): this;
    sse<T extends Result | Error>(codes: StatusCodePredicate, schema: ResponseMatcherSchema<T>, opts?: Omit<ResponsePredicateOptions, "err" | "fail">): this;
    void<T extends Result | Error>(codes: StatusCodePredicate, schema: ResponseMatcherSchema<T>, opts?: Pick<ResponsePredicateOptions, "hdrs">): this;
    fail(codes: StatusCodePredicate): this;
    match(response: Response, options?: {
        resultKey?: string;
        extraFields?: Record<string, unknown>;
    }): Promise<[result: Result, rawData: unknown]>;
}
/**
 * Discards the response body to free up resources.
 *
 * To learn why this is need, see the undici docs:
 * https://undici.nodejs.org/#/?id=garbage-collection
 */
export declare function discardResponseBody(res: Response): Promise<void>;
export {};
//# sourceMappingURL=http.d.ts.map