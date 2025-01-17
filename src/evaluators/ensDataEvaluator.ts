// ensDataEvaluator.ts
import {
    Evaluator,
    IAgentRuntime,
    Memory,
    ServiceType,
    State,
    stringToUuid,
} from "@elizaos/core";
import { UserData } from "../providers/ensDataProvider";
// TODO: should replace this with official plugin-thirdweb package once new version is released
import { ThirdwebNebulaApiService } from "../plugin-thirdweb/src/services/ThirdwebNebulaApiService";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Evaluator that checks for when an ENS name has been provided in the conversation
// once ENS name is detected, it will call the Nebula API to check if the user owns any NFTs from the collection
// and caches the result in the cache manager
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ensDataEvaluator: Evaluator = {
    name: "GET_USER_ENS_NAME",
    description: "Evaluates if user has provided an ENS name",
    alwaysRun: true,
    similes: ["GET_ENS_NAME", "EXTRACT_ENS_NAME"],
    examples: [
        {
            context: "User shares their ENS name",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "My ENS is vitalik.eth" },
                },
            ],
            outcome: `{
                ensName: "vitalik.eth",
                ownsNFT: true,
            }`,
        },
        {
            context: "User mentions ENS name in conversation",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "I just bought an NFT using punk.eth from the marketplace",
                    },
                },
            ],
            outcome: `{
                ensName: "punk.eth",
                ownsNFT: false,
            }`,
        },
        {
            context:
                "User mentions multiple ENS names, should capture first one",
            messages: [
                {
                    user: "{{user1}}",
                    content: {
                        text: "Between alex.eth and bob.eth, which one is better?",
                    },
                },
            ],
            outcome: `{
                ensName: "alex.eth",
                ownsNFT: false,
            }`,
        },
        // Negative examples
        {
            context: "No ENS name in message",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "Hello, how are you today?" },
                },
            ],
            outcome: `{
                ensName: null,
                ownsNFT: false
            }`,
        },
        {
            context: "Invalid ENS format",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "My name is .eth" },
                },
            ],
            outcome: `{
                ensName: null,
                ownsNFT: false
            }`,
        },
        {
            context: "Empty message",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "" },
                },
            ],
            outcome: `{
                ensName: null,
                ownsNFT: false
            }`,
        },
    ],
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const cacheKey = `${runtime.character.name}/${message.userId}/data`;

        try {
            // Add validation for message content
            if (!message.content?.text) {
                return false;
            }

            // since all we are looking for is an ENS name, we can use a simple regex to match it
            // TODO: can replace this with using LLM to extract the ENS name using composeContext + generateObject with template
            const ensMatch = message.content.text.match(/[\w-]+\.eth\b/i);
            if (!ensMatch) return false;

            // if ENS was found, we need to do the following:
            // 1. call Nebula API to do NFT ownership check
            // 2. cache the result in the cache manager
            // 3. create a new memory with the result in JSON format
            const ensName = ensMatch[0].toLowerCase();

            const blockchainService = runtime.services.get(
                "nebula" as ServiceType
            ) as ThirdwebNebulaApiService;

            //check if blockchain service is null
            if (!blockchainService) {
                console.error(
                    "ENS Evaluator Handler - Blockchain service is null"
                );
            }

            // send the natural language query to the Nebula API but make sure we get structured data back
            // since we are only looking for a boolean result, we can use a simple regex to match it
            const result = await blockchainService.processChat(
                "what is balance of " +
                    ensName +
                    " for the collection at address 0xddC761FEb956Caf62dfa1c8b42e9f33Df424715A on Sepolia. \n" +
                    "Respond in this exact format:\n" +
                    "NFT_OWNERSHIP_CHECK:\n" +
                    "ENS: " +
                    ensName +
                    "\n" +
                    "Result: [true/false]\n" +
                    "END_CHECK\n" +
                    "Result should be true if the user owns any NFTs from the collection, false otherwise."
            );

            const existingData = (await runtime.cacheManager.get<UserData>(
                cacheKey
            )) || {
                lastUpdated: Date.now(),
                ownsNFT: false,
            };

            const updatedData: UserData = {
                ...existingData,
                ensName,
                lastUpdated: Date.now(),
            };

            // check if the result is true or false
            if (result.includes("true")) {
                updatedData.ownsNFT = true;
            } else {
                updatedData.ownsNFT = false;
            }

            // update the cache with the new data
            await runtime.cacheManager.set(cacheKey, updatedData);

            var returnObject = JSON.stringify({
                ensName: updatedData.ensName,
                ownsNFT: updatedData.ownsNFT,
            });

            // create a new memory with the result in JSON format in case we need to use it later
            // var memoryID = stringToUuid("ENS_DATA_EVALUATOR");
            // await runtime.messageManager.createMemory({
            //     id: memoryID,
            //     userId: message.userId,
            //     agentId: runtime.agentId,
            //     roomId: message.roomId,
            //     content: {
            //         text: "NFT ownership check result: " + returnObject,
            //     },
            // }); 

            return true;
        } catch (error) {
            console.error("ENS Evaluator Handler - Error details:", {
                error,
                messageContent: message.content,
                messageText: message.content?.text,
            });
            return false;
        }
    },
    validate: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State
    ) => {
        try {
            const cacheKey =
                runtime.character.name + "/" + message.userId + "/data";

            const cachedData =
                await runtime.cacheManager.get<UserData>(cacheKey);

            // only need to run evaluator if an ENS name has not yet been cached from the conversation
            return !cachedData?.ensName;
        } catch (error) {
            console.error("Error in ensDataEvaluator validate:", error);
            return false;
        }
    },
};

export { ensDataEvaluator };
