"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateAnnotation = void 0;
const langgraph_1 = require("@langchain/langgraph");
exports.StateAnnotation = langgraph_1.Annotation.Root({
    chatId: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    userId: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    userMessage: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    aiPersona: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    manifestContext: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    messages: (0, langgraph_1.Annotation)({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    negotiatorResponse: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
    shouldUpdateManifest: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => false
    }),
    newManifestContent: (0, langgraph_1.Annotation)({
        reducer: (x, y) => y ?? x,
        default: () => ""
    }),
});
