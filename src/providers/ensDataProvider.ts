// ensDataProvider.ts
import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

export interface UserData {
    ensName?: string;
    ownsNFT: boolean;
    lastUpdated?: number;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Provider that provides instructions to the agent on getting the user's ENS name
// and once ENS name is provided caches that information in the cache manager
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const ensDataProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const cacheKey =
            runtime.character.name + "/" + message.userId + "/data";

        try {
            const cachedData = (await runtime.cacheManager.get<UserData>(
                cacheKey
            )) || {
                lastUpdated: Date.now(),
                ownsNFT: false,
            };

            // if we don't have the ENS name, instruct the agent to ask the user for it
            if (!cachedData.ensName) {
                return (
                    "- You need to get the user's ENS name\n" +
                    "- Ask them what their ENS name is (.eth address)\n" +
                    "- If they mention an ENS name in their response, acknowledge it\n" +
                    "- If they don't have one or don't want to share, that's okay - just note that\n" +
                    "Current status: Need ENS name\n" +
                    "Cache state: " +
                    JSON.stringify(cachedData, null, 2)
                );
            }

            // if we already have the ENS name, provide instructions to check if the user owns any NFTs from the collection
            return (
                "You have the ens name of the user.  Thank the user for providing their ENS name and ask them if they own any NFTs from the VIP collection\n" +
                JSON.stringify(cachedData, null, 2)
            );
        } catch (error) {
            console.error("Error in ensDataProvider:", error);
            return "Error accessing user data";
        }
    },
};

export { ensDataProvider };
