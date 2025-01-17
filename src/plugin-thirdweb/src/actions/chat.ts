/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    elizaLogger,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    State,
    ServiceType,
    type Action,
} from "@elizaos/core";
import { ThirdwebNebulaApiService } from "../services/ThirdwebNebulaApiService";

export const blockchainChatAction: Action = {
    name: "BLOCKCHAIN_CHAT",
    similes: [
        "QUERY_BLOCKCHAIN",
        "CHECK_BLOCKCHAIN",
        "BLOCKCHAIN_SEARCH",
        "CRYPTO_LOOKUP",
        "WEB3_SEARCH",
        "BLOCKCHAIN_HISTORY_EXPLORER",
        "UNIVERSAL_BLOCKCHAIN_TRANSALTOR",
        "BLOCKCHAIN_DATA_PROVIDER",
        "HISTORICAL_BLOCKCHAIN_DATA",
        "TRACK_BLOCKCHAIN_TRANSACTIONS",
        "BLOCKCHAIN_INTERPRETER",
        "BLOCKCHAIN_TRANSACTION_DETAILS",
    ],
    description:
        "Call this to chat to get information, data and prices from a blockchain using natural language.  You can: \n" +
        "1) query and retrieve information on block and transaction data for a blockchain network, \n" +
        "2) read contract data from a blockchain, \n" +
        "3) get token price and exchange rate for tokens or cryptocurrencies, \n" +
        "4) detailed transaction information from the blockchain, \n" +
        "5) get wallet balances for tokens and NFTs, \n" +
        "6) resolve ENS name to wallet address",
    validate: async (
        runtime: IAgentRuntime,
        _message: Memory
    ): Promise<boolean> => {
        const secretKey =
            runtime.getSetting("THIRDWEB_SECRET_KEY") ??
            process.env.THIRDWEB_SECRET_KEY;
        return Boolean(secretKey);
    },
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state: State,
        _options: any,
        callback: HandlerCallback
    ): Promise<string> => {
        try {
            elizaLogger.log("Starting blockchain chat handler");

            const blockchainService = runtime.services.get(
                "nebula" as ServiceType
            ) as ThirdwebNebulaApiService;

            if (!blockchainService) {
                elizaLogger.error("Nebula blockchain service is not available");
                throw new Error("Nebula blockchain service is not available");
            }

            const response = await blockchainService.processChat(
                message.content.text
            );

            callback({ text: response, content: {} });
            return response;
        } catch (error) {
            elizaLogger.error("Nebula blockchain chat failed:", error);
            throw new Error(`Nebula blockchain chat failed: ${error.message}`);
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What's the ETH balance of vitalik.eth?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The current ETH balance of vitalik.eth (0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045) is 1,123.45 ETH",
                    action: "BLOCKCHAIN_CHAT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the latest block number on Base?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The latest block number on Base is 1234567890",
                    action: "BLOCKCHAIN_CHAT",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "What is the current price of Arb?",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "The current floor price for Arb is 3.25",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Show me tx with hash 0x1234567890 on Arbitrum Sepolia",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Here is the transaction details for 0x1234567890 on Arbitrum Sepolia: 1. Sent 1.5 ETH 2. Swapped tokens on Uniswap 3. Received 0.5 ETH",
                    action: "BLOCKCHAIN_CHAT",
                },
            },
        ],
    ],
} as Action;
