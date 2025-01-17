import {
    Service,
    ServiceType,
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
} from "@elizaos/core";

export class ThirdwebNebulaApiService implements Service {
    private sessionId?: string;
    private readonly API_URL = "https://nebula-api.thirdweb.com";

    get serviceType(): ServiceType {
        return "nebula" as ServiceType;
    }

    name = "thirdweb-nebula-api-service";
    description =
        "Manages authentication and sessions with the thirdweb nebula api";

    async initialize(): Promise<void> {
        if (this.sessionId) return;

        const secretKey = process.env.THIRDWEB_SECRET_KEY;
        if (!secretKey) {
            throw new Error(
                "THIRDWEB_SECRET_KEY environment variable is required"
            );
        }

        try {
            const response = await fetch(`${this.API_URL}/session`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-secret-key": secretKey,
                },
                body: "{}",
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to initialize session: ${response.statusText}`
                );
            }

            const data = await response.json();
            this.sessionId = data.result.id;
            console.log(
                "Initialized thirdweb nebula api service with session:",
                this.sessionId
            );
        } catch (error) {
            console.error(
                "Failed to initialize thirdweb nebula api service:",
                error
            );
            throw error;
        }
    }

    async processChat(message: string): Promise<string> {
        if (!this.sessionId) {
            await this.initialize();
        }

        elizaLogger.log("Nebula processing chat: ", message);

        const response = await fetch(`${this.API_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-secret-key": process.env.THIRDWEB_SECRET_KEY || "",
            },
            body: JSON.stringify({
                message,
                user_id: "default-user",
                stream: false,
                session_id: this.sessionId,
            }),
        });

        if (!response.ok) {
            throw new Error(`Chat request failed: ${response.statusText}`);
        }

        const data = await response.json();
        elizaLogger.log("Nebula response:", data);
        return data?.message;
    }

    async handler(
        runtime: IAgentRuntime,
        message: Memory,
        _state?: State
    ): Promise<string> {
        try {
            return await this.processChat(message.content.text);
        } catch (error) {
            console.error("Error in ThirdwebNebulaApiService handler:", error);
            throw error;
        }
    }
}
