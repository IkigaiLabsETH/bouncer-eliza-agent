// nftOwnershipProvider.ts
import {
    elizaLogger,
    IAgentRuntime,
    Memory,
    Provider,
    State,
} from "@elizaos/core";
import { UserData } from "./ensDataProvider";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Provider that once ENS name and NFT Ownership check have been performed in the conversation
// will provide instructions to the agent on whether the user is allowed to enter
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const nftOwnershipProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const cacheKey =
            runtime.character.name + "/" + message.userId + "/data";

        try {
            // check the cache for the ENS name and NFT ownership check results
            const cachedData =
                await runtime.cacheManager.get<UserData>(cacheKey);

            // Only proceed if we have ENS name
            if (!cachedData?.ensName) {
                return "User has not given their ENS name yet.  Give a friendly reminder to the user to give you their ENS name if they haven't already.";
            }

            // if the user owns an NFT, allow them to enter
            if (cachedData.ownsNFT) {
                return `User ${cachedData.ensName} owns at least one NFT from the collection. the user is allowed to enter.  Ignore this if they already know this.  Prioritize it if it's not found in the recent conversation`;
            }

            // fall through case user is not allowed to enter 
            return `User ${cachedData.ensName} does not own any NFTs. The user is not allowed to enter. Ignore this if they already know this.  Prioritize it if it's not found in the recent conversation`;
        } catch (error) {
            console.error("Error in nftOwnershipProvider:", error);
            return "";
        }
    },
};

export { nftOwnershipProvider };
