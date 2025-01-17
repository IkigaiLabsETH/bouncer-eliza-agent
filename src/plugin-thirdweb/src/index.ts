import { Plugin } from "@elizaos/core";
import { blockchainChatAction } from "./actions/chat";
import { ThirdwebNebulaApiService } from "./services/ThirdwebNebulaApiService";

export const thirdwebPlugin: Plugin = {
    name: "PROVIDE_BLOCKCHAIN_DATA",
    description:
        "Search the blockchain with thirdweb Nebula for information about wallet addresses, token prices, token owners, transactions and their details.",
    actions: [blockchainChatAction],
    evaluators: [],
    providers: [],
    services: [new ThirdwebNebulaApiService()],
};
