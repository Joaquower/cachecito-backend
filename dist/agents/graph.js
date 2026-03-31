"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentGraph = void 0;
const langgraph_1 = require("@langchain/langgraph");
const state_1 = require("./state");
const nodes_1 = require("./nodes");
exports.agentGraph = new langgraph_1.StateGraph(state_1.StateAnnotation)
    .addNode("retriever", nodes_1.retrieverNode)
    .addNode("negotiator", nodes_1.negotiatorNode)
    .addNode("updater", nodes_1.updaterNode)
    .addEdge(langgraph_1.START, "retriever")
    .addEdge("retriever", "negotiator")
    .addConditionalEdges("negotiator", nodes_1.shouldUpdateEdge, {
    updater: "updater",
    __end__: langgraph_1.END
})
    .addEdge("updater", langgraph_1.END)
    .compile();
