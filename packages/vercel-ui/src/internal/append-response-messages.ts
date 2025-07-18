import { AISDKError } from "@ai-sdk/provider";
import {
  type FileUIPart,
  type Message,
  type ReasoningUIPart,
  type StepStartUIPart,
  type TextUIPart,
  type ToolInvocation,
  type ToolInvocationUIPart,
  extractMaxToolInvocationStep,
} from "@ai-sdk/ui-utils";
import type { appendResponseMessages as baseAppendResponseMessages } from "ai";
import type { UIMessage } from "../types";
import { buildSubAgentData, convertDataContentToBase64String } from "./utils";

export type VercelResponseMessage = Parameters<
  typeof baseAppendResponseMessages
>[0]["responseMessages"][number];

/**
 * Appends the ResponseMessage[] from the response to a Message[] (for useChat).
 * The messages are converted to Messages before being appended.
 * Timestamps are generated for the new messages.
 *
 * NOTE: Original is copied from `@vercel/ai/packages/ai/core/prompt/append-response-messages.ts`
 *
 * @returns A new Message[] with the response messages appended.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: copied
export function appendResponseMessages({
  messages,
  responseMessages,
  _internal: { currentDate = () => new Date() } = {},
}: {
  messages: Message[];
  responseMessages: VercelResponseMessage[];

  /**
Internal. For test use only. May change without notice.
     */
  _internal?: {
    currentDate?: () => Date;
  };
}): Message[] {
  const clonedMessages = structuredClone(messages);

  for (const message of responseMessages) {
    const role = message.role;

    // check if the last message is an assistant message:
    const lastMessage = clonedMessages[clonedMessages.length - 1];
    const isLastMessageAssistant = lastMessage.role === "assistant";

    switch (role) {
      case "assistant": {
        function getToolInvocations(step: number) {
          return (
            typeof message.content === "string"
              ? []
              : message.content.filter((part) => part.type === "tool-call")
          ).map((call) => ({
            state: "call" as const,
            step,
            args: call.args,
            toolCallId: call.toolCallId,
            toolName: call.toolName,
          }));
        }

        const parts: Array<
          TextUIPart | ReasoningUIPart | ToolInvocationUIPart | FileUIPart | StepStartUIPart
        > = [{ type: "step-start" as const }]; // always start with a step-start part
        let textContent = "";
        let reasoningTextContent = undefined;

        if (typeof message.content === "string") {
          textContent = message.content;
          parts.push({
            type: "text" as const,
            text: message.content,
            ...buildSubAgentData(message),
          });
        } else {
          let reasoningPart: ReasoningUIPart | undefined = undefined;
          for (const part of message.content) {
            switch (part.type) {
              case "text": {
                reasoningPart = undefined; // reset the reasoning part

                textContent += part.text;
                parts.push({
                  type: "text" as const,
                  text: part.text,
                  ...buildSubAgentData(part),
                });
                break;
              }
              case "reasoning": {
                if (reasoningPart == null) {
                  reasoningPart = {
                    type: "reasoning" as const,
                    reasoning: "",
                    details: [],
                    ...buildSubAgentData(part),
                  };
                  parts.push(reasoningPart);
                }

                reasoningTextContent = (reasoningTextContent ?? "") + part.text;
                reasoningPart.reasoning += part.text;
                reasoningPart.details.push({
                  type: "text" as const,
                  text: part.text,
                  signature: part.signature,
                  ...buildSubAgentData(part),
                });
                break;
              }
              case "redacted-reasoning": {
                if (reasoningPart == null) {
                  reasoningPart = {
                    type: "reasoning" as const,
                    reasoning: "",
                    details: [],
                    ...buildSubAgentData(part),
                  };
                  parts.push(reasoningPart);
                }

                reasoningPart.details.push({
                  type: "redacted" as const,
                  data: part.data,
                  ...buildSubAgentData(part),
                });
                break;
              }
              case "tool-call":
                break;
              case "file":
                if (part.data instanceof URL) {
                  throw new AISDKError({
                    name: "InvalidAssistantFileData",
                    message: "File data cannot be a URL",
                  });
                }
                parts.push({
                  type: "file" as const,
                  mimeType: part.mimeType,
                  data: convertDataContentToBase64String(part.data),
                  ...buildSubAgentData(part),
                });
                break;
            }
          }
        }

        if (isLastMessageAssistant) {
          const maxStep = extractMaxToolInvocationStep(lastMessage.toolInvocations);

          lastMessage.parts ??= [];

          lastMessage.content = textContent;
          lastMessage.reasoning = reasoningTextContent;
          lastMessage.parts.push(...parts);

          lastMessage.toolInvocations = [
            ...(lastMessage.toolInvocations ?? []),
            ...getToolInvocations(maxStep === undefined ? 0 : maxStep + 1),
          ];

          getToolInvocations(maxStep === undefined ? 0 : maxStep + 1)
            .map((call) => ({
              type: "tool-invocation" as const,
              toolInvocation: call,
            }))
            .forEach((part) => {
              lastMessage.parts?.push(part);
            });
        } else {
          // last message was a user message, add the assistant message:
          clonedMessages.push({
            role: "assistant",
            id: message.id,
            createdAt: currentDate(), // generate a createdAt date for the message, will be overridden by the client
            content: textContent,
            reasoning: reasoningTextContent,
            toolInvocations: getToolInvocations(0),
            parts: [
              ...parts,
              ...getToolInvocations(0).map((call) => ({
                type: "tool-invocation" as const,
                toolInvocation: call,
              })),
            ],
          });
        }

        break;
      }

      case "tool": {
        // for tool call results, add the result to previous message:
        lastMessage.toolInvocations ??= []; // ensure the toolInvocations array exists

        if (lastMessage.role !== "assistant") {
          throw new Error(`Tool result must follow an assistant message: ${lastMessage.role}`);
        }

        lastMessage.parts ??= [];

        for (const contentPart of message.content) {
          // find the tool call in the previous message:
          const toolCall = lastMessage.toolInvocations.find(
            (call) => call.toolCallId === contentPart.toolCallId,
          );
          const toolCallPart: ToolInvocationUIPart | undefined = lastMessage.parts.find(
            (part): part is ToolInvocationUIPart =>
              part.type === "tool-invocation" &&
              part.toolInvocation.toolCallId === contentPart.toolCallId,
          );

          if (!toolCall) {
            throw new Error("Tool call not found in previous message");
          }

          // add the result to the tool call:
          toolCall.state = "result";
          const toolResult = toolCall as ToolInvocation & { state: "result" };
          toolResult.result = contentPart.result;

          if (toolCallPart) {
            toolCallPart.toolInvocation = {
              ...toolResult,
              ...buildSubAgentData(contentPart),
            };
          } else {
            lastMessage.parts.push({
              type: "tool-invocation" as const,
              toolInvocation: {
                ...toolResult,
                ...buildSubAgentData(contentPart),
              },
            });
          }
        }

        break;
      }

      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported message role: ${_exhaustiveCheck}`);
      }
    }
  }

  return clonedMessages as UIMessage[];
}
