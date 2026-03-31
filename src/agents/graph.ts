import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateAnnotation } from "./state";
import { retrieverNode, negotiatorNode, updaterNode, shouldUpdateEdge, tools, shouldContinue, manifestParserNode } from "./nodes";

const toolNode = new ToolNode(tools);

export const agentGraph = new StateGraph(StateAnnotation)
  .addNode("retriever", retrieverNode)
  .addNode("negotiator", negotiatorNode)
  .addNode("tools", toolNode)
  .addNode("parser", manifestParserNode)
  .addNode("updater", updaterNode)
  .addEdge(START, "retriever")
  .addEdge("retriever", "negotiator")
  .addConditionalEdges("negotiator", shouldContinue, {
    tools: "tools",
    parser: "parser"
  })
  .addEdge("tools", "negotiator")
  .addConditionalEdges("parser", shouldUpdateEdge, {
    updater: "updater",
    __end__: END
  })
  .addEdge("updater", END)
  .compile();
