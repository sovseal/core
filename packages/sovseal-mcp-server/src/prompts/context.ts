export const contextPrompt = {
  name: "/sovseal:context",
  description: "Bootstraps a conversation with recent context from sovseal.",
};

export function getContextPrompt() {
  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: "Please read the recent context from sovseal://context/recent before we begin.",
        },
      },
    ],
  };
}
