import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const StateAnnotation = Annotation.Root({
  chatId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  userId: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  userMessage: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  aiPersona: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  manifestContext: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  negotiatorResponse: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
  shouldUpdateManifest: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false
  }),
  newManifestContent: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => ""
  }),
});

export type AgentState = typeof StateAnnotation.State;
